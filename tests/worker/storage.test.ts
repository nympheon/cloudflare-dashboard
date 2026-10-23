// Fixture identities, billing dates and quantities are synthetic.
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshDashboard } from '../../worker/refresh';
import { demoSnapshot } from '../../src/demo';
import { encryptToken } from '../../worker/settings/crypto';
import { reset } from 'cloudflare:test';
import sql from '../../migrations/0001_dashboard.sql?raw';
import leaseSql from '../../migrations/0002_refresh_lease.sql?raw';
import { Repository } from '../../worker/storage/repository';
import { saveCredential, deleteCredential, publicSettings } from '../../worker/settings/service';
import worker from '../../worker/index';
import { CloudflareReadClient } from '../../worker/cloudflare/client';
const fixtureAccount = 'a'.repeat(32),
  fixtureToken = 'fixture_token_without_any_real_access';
const transport: typeof fetch = async (input) =>
  Response.json({
    success: true,
    result: String(input).includes('/verify')
      ? { status: 'active' }
      : [{ id: fixtureAccount, name: 'Test Account' }],
  });
beforeEach(async () => {
  await reset();
  for (const statement of (sql + leaseSql).split(';').filter((s) => s.trim()))
    await env.DB.prepare(statement).run();
});
describe('encrypted settings and revision gates in D1', () => {
  it('saves two tokens independently and never returns plaintext', async () => {
    const repo = new Repository(env.DB);
    await saveCredential(repo, 'account', fixtureToken, env.TOKEN_ENCRYPTION_KEY, transport);
    const s = await saveCredential(
      repo,
      'user',
      fixtureToken + '2',
      env.TOKEN_ENCRYPTION_KEY,
      transport,
    );
    expect(Object.keys(s.credentials)).toEqual(['account', 'user']);
    expect(JSON.stringify(s)).not.toContain(fixtureToken);
    const row = await env.DB.prepare('SELECT data FROM dashboard_settings WHERE id=1').first<{
      data: string;
    }>();
    expect(row!.data).not.toContain(fixtureToken);
    await deleteCredential(repo, 'account', true);
    expect(publicSettings(await repo.settings(), true).credentials.user).toBeDefined();
  });
  it('rejects mismatched accounts and does not overwrite a saved credential', async () => {
    const repo = new Repository(env.DB);
    await saveCredential(repo, 'account', fixtureToken, env.TOKEN_ENCRYPTION_KEY, transport);
    const other: typeof fetch = async () =>
      Response.json({ success: true, result: [{ id: 'b'.repeat(32), name: 'Other' }] });
    await expect(
      saveCredential(repo, 'user', fixtureToken, env.TOKEN_ENCRYPTION_KEY, other),
    ).rejects.toThrow('同一个');
    expect((await repo.settings()).revision).toBe(1);
  });
  it('rejects stale settings updates', async () => {
    const repo = new Repository(env.DB),
      a = await repo.settings(),
      b = await repo.settings();
    await repo.saveSettings(a, 0);
    await expect(repo.saveSettings(b, 0)).rejects.toThrow('更新');
  });
  it('never reuses a prior account subscription if a new account subscription read fails', async () => {
    const repo = new Repository(env.DB),
      previous = demoSnapshot('normal');
    previous.account = { id: fixtureAccount, name: 'Account A' };
    previous.settingsRevision = 0;
    await repo.saveSnapshot(previous, 0);
    const settings = await repo.settings();
    settings.account = { id: 'b'.repeat(32), name: 'Account B' };
    settings.credentials.user = {
      encrypted: await encryptToken(fixtureToken, env.TOKEN_ENCRYPTION_KEY),
      suffix: 'test',
      verifiedAt: new Date().toISOString(),
    };
    await repo.saveSettings(settings, 0);
    vi.stubGlobal('fetch', async () => new Response('unavailable', { status: 503 }));
    try {
      const next = await refreshDashboard('manual', env);
      expect(next.subscriptions).toEqual([]);
      expect(next.billingPeriod.start).toBeNull();
      expect(next.costs.fixed).toBeNull();
      expect(next.metrics.subscription_count.current.status).toBe('error');
      expect(next.metrics.platforms_subscription.current.status).toBe('error');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('keeps annual fixed fees and daily AI estimates out of the subscription-cycle total', async () => {
    const repo = new Repository(env.DB);
    await saveCredential(repo, 'user', fixtureToken, env.TOKEN_ENCRYPTION_KEY, transport);
    const subscriptions = [
      {
        id: 'monthly',
        rate_plan: { id: 'workers_paid', public_name: 'Workers Paid' },
        price: 5,
        currency: 'USD',
        frequency: 'monthly',
        current_period_start: '2026-10-15T00:00:00Z',
        current_period_end: '2026-11-15T00:00:00Z',
        state: 'Paid',
      },
      {
        id: 'annual',
        rate_plan: { id: 'annual', public_name: 'Annual Plan' },
        price: 20,
        currency: 'USD',
        frequency: 'yearly',
        current_period_start: '2026-01-01T00:00:00Z',
        current_period_end: '2027-01-01T00:00:00Z',
        state: 'Paid',
      },
    ];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/graphql')) {
        const q = JSON.parse(String(init?.body)).query as string;
        const name = q.match(/(\w+)\(limit:/)?.[1] ?? '';
        return Response.json({
          data: {
            viewer: {
              accounts: [
                {
                  [name]:
                    name === 'aiInferenceAdaptiveGroups' && q.includes('totalNeurons')
                      ? [{ sum: { totalNeurons: '12000' } }]
                      : [],
                },
              ],
            },
          },
          errors: null,
        });
      }
      return Response.json({
        success: true,
        result: String(input).includes('/subscriptions') ? subscriptions : [],
        result_info: { total_pages: 1 },
      });
    });
    try {
      const next = await refreshDashboard('manual', env);
      expect(next.costs.fixed).toBe('5');
      expect(next.costs.fixedOther).toEqual([{ frequency: 'yearly', amount: '20' }]);
      expect(next.costs.dailyEstimated).toBe('0.022');
      expect(next.costs.estimated).toBe('0');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('deduplicates concurrent refreshes using a bounded D1 lease and releases it', async () => {
    const repo = new Repository(env.DB);
    expect(await repo.acquireRefresh('first', 1000)).toBe(true);
    expect(await repo.acquireRefresh('second', 1001)).toBe(false);
    await repo.releaseRefresh('first');
    expect(await repo.acquireRefresh('second', 1002)).toBe(true);
  });
  it('uses INTEGER PRIMARY KEY and measured D1 metadata', async () => {
    const repo = new Repository(env.DB);
    await repo.settings();
    expect(repo.diagnostics.rowsRead).toBe(1);
    expect(repo.diagnostics.rowsWritten).toBe(0);
    const q = await env.DB.prepare(
      'EXPLAIN QUERY PLAN SELECT data FROM dashboard_settings WHERE id = 1',
    ).all();
    expect(JSON.stringify(q.results)).toContain('INTEGER PRIMARY KEY');
    const s = await repo.settings();
    await repo.saveSettings(s, s.revision);
    expect(repo.diagnostics.rowsWritten).toBe(1);
  });
});
describe('API routes', () => {
  it('invokes fetch without binding the client as the runtime receiver', async () => {
    const strictTransport: typeof fetch = async function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Response.json({ success: true, result: { ok: true } });
    };
    expect(
      await new CloudflareReadClient('fixture', strictTransport).get('/accounts/test'),
    ).toEqual({ ok: true });
  });
  it('provides bootstrap without credentials and refuses cross-origin writes', async () => {
    const a = await worker.fetch(new Request('http://example.test/api/bootstrap'), env);
    expect(a.status).toBe(200);
    expect(JSON.stringify(await a.json())).not.toContain('ciphertext');
    const b = await worker.fetch(
      new Request('http://example.test/api/tokens/user', {
        method: 'PUT',
        headers: { Origin: 'https://outside.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fixtureToken }),
      }),
      env,
    );
    expect(b.status).toBe(403);
  });
  it('does not accept invalid refresh reasons', async () => {
    const r = await worker.fetch(
      new Request('http://example.test/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"reason":"timer"}',
      }),
      env,
    );
    expect(r.status).toBe(400);
  });
});
