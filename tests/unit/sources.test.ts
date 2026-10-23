// Fixture identities, billing dates and quantities are synthetic.
import { describe, it, expect } from 'vitest';
import { CloudflareReadClient } from '../../worker/cloudflare/client';
import { aggregateBillable, billableMetricId } from '../../worker/cloudflare/adapters/billing';
import { mapR2Operations } from '../../worker/cloudflare/adapters/storage';
import { resolveDefinitions } from '../../worker/cloudflare/discovery';
import { ReadSources } from '../../worker/cloudflare/sources';
import { collectDataset, datasets } from '../../worker/cloudflare/adapters/analytics';
import { metrics } from '../../shared/catalog';
import { collectAccount } from '../../worker/cloudflare/adapters/account';
import { mergeMetric } from '../../worker/metrics/state';
import { isMetricVisible } from '../../shared/visibility';
describe('read-only source validation', () => {
  it('rejects GraphQL errors, malformed empty REST lists and mutations', async () => {
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({ errors: [{ message: 'denied' }], data: {} }),
    );
    await expect(client.query('{viewer{accounts{__typename}}}')).rejects.toThrow();
    await expect(client.query('mutation {anything}')).rejects.toThrow();
    const empty = new CloudflareReadClient('fixture', async () =>
      Response.json({ success: true, result: {} }),
    );
    await expect(empty.list('/accounts')).rejects.toThrow('不完整');
  });
  it('retains integers above Number.MAX_SAFE_INTEGER losslessly', async () => {
    const c = new CloudflareReadClient(
      'fixture',
      async () => new Response('{"result":{"usage":9007199254740993},"success":true}'),
    );
    expect(await c.get('/accounts/example')).toEqual({ usage: '9007199254740993' });
  });
  it('falls back to the other configured token only for recognized access failures', async () => {
    let accountCalls = 0,
      userCalls = 0;
    const account = new CloudflareReadClient('account-fixture', async () => {
      accountCalls++;
      return Response.json({ result: { usage: 12 } });
    });
    const user = new CloudflareReadClient('user-fixture', async () => {
      userCalls++;
      return new Response('', { status: 403 });
    });
    const sources = new ReadSources({ account, user });
    expect(await sources.get('/accounts/test/billable-usage')).toEqual({ usage: '12' });
    expect(userCalls).toBe(1);
    expect(accountCalls).toBe(1);
    const rateLimited = new CloudflareReadClient(
      'rate-limit',
      async () => new Response('', { status: 429 }),
    );
    await expect(
      new ReadSources({ account, user: rateLimited }).get('/accounts/test/billable-usage'),
    ).rejects.toThrow('频率');
    expect(accountCalls).toBe(1);
  });
});
describe('billing sources', () => {
  const row = {
    ServiceName: 'D1 - Rows Read (first 25 billion included)',
    BillingPeriodStart: '2026-10-15T00:00:00Z',
    ChargePeriodEnd: '2026-10-08T00:00:00Z',
    ConsumedQuantity: '4',
    BilledCost: '0.1',
    BillingCurrency: 'USD',
    CumulatedContractedCost: '0.1',
  };
  it('sums period rows, never sums cumulative costs and deduplicates rows', () => {
    const second = {
      ...row,
      ChargePeriodEnd: '2026-10-09T00:00:00Z',
      ConsumedQuantity: '6',
      BilledCost: '0.2',
      CumulatedContractedCost: '0.3',
    };
    const result = aggregateBillable([row, second, row], '2026-10-15T00:00:00.000Z');
    expect(result.d1_rows_read).toMatchObject({ usage: '10', cost: '0.3' });
  });
  it('recognizes correct meters and ignores old billing cycles', () => {
    expect(billableMetricId('Workers CPU ms (first 30M are included)')).toBe(
      'worker_standard_cpu_ms',
    );
    expect(aggregateBillable([row], '2026-11-15T00:00:00.000Z')).toEqual({});
  });
  it('matches the documented Workers Standard name to the existing request meter', () => {
    const result = aggregateBillable(
      [
        {
          ...row,
          ServiceName: 'Workers Standard',
          ServiceFamilyName: 'Workers',
          ConsumedUnit: 'Count',
          ConsumedQuantity: '12500000',
          BilledCost: '0.75',
        },
      ],
      row.BillingPeriodStart,
    );
    expect(Object.keys(result)).toEqual(['worker_standard_request']);
    expect(result.worker_standard_request.cost).toBe('0.75');
  });
});
describe('operation and discovery semantics', () => {
  it('hides a previously accepted R2 estimate when new operations invalidate its billing mapping', async () => {
    const dataset = datasets.find((d) => d.ids.includes('r2_class_a_operations'))!;
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [
              {
                [dataset.name]: [
                  {
                    dimensions: { actionType: 'UnknownOperation', storageClass: 'Standard' },
                    sum: { requests: '10' },
                  },
                ],
              },
            ],
          },
        },
        errors: null,
      }),
    );
    const r = await collectDataset(
      dataset,
      {
        accountId: 'a'.repeat(32),
        clients: { account: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    const def = metrics.find((m) => m.id === 'r2_class_a_operations')!;
    const current = r[def.id];
    const old = mergeMetric(def, undefined, {
      ...current,
      usage: '12',
      status: 'ok',
      coverage: 'complete',
    });
    const unverified = mergeMetric(def, old, current);
    expect(isMetricVisible(unverified)).toBe(false);
    expect(isMetricVisible(mergeMetric(def, unverified, { ...current, status: 'error' }))).toBe(
      false,
    );
  });
  it('does not infer IA storage charges from a zero capacity peak because minimum duration charges can remain', async () => {
    const dataset = datasets.find((d) => d.ids.includes('r2_ia_storage'))!;
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [{ [dataset.name]: [{ max: { payloadSize: '0', metadataSize: '0' } }] }],
          },
        },
        errors: null,
      }),
    );
    const r = await collectDataset(
      dataset,
      {
        accountId: 'a'.repeat(32),
        clients: { account: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    expect(r.r2_storage.usage).toBe('0');
    expect(r.r2_ia_storage.status).toBe('partial');
    expect(r.r2_ia_storage.usage).toBeNull();
  });
  it.each([
    'pipelines_sql_transforms',
    'email_sent',
    'analytics_data_points',
    'r2_data_catalog_bytes_processed',
  ])('does not expose raw events as the billable %s meter', async (id) => {
    const dataset = datasets.find((d) => d.ids.includes(id))!;
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [
              {
                [dataset.name]: [
                  {
                    count: '20',
                    sum: { bytesIn: '2000000000', inputBytes: '2000000000', filesProcessed: '4' },
                  },
                ],
              },
            ],
          },
        },
        errors: null,
      }),
    );
    const r = await collectDataset(
      dataset,
      {
        accountId: 'a'.repeat(32),
        clients: { account: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    expect(r[id].status).toBe('partial');
    expect(r[id].usage).toBeNull();
  });
  it('does not treat unnormalized DO invocation analytics as billing requests', async () => {
    const dataset = datasets.find((d) => d.ids.includes('worker_durable_objects_requests'))!;
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: { viewer: { accounts: [{ [dataset.name]: [{ sum: { requests: '2000000' } }] }] } },
        errors: null,
      }),
    );
    const r = await collectDataset(
      dataset,
      {
        accountId: 'a'.repeat(32),
        clients: { account: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    expect(r.worker_durable_objects_requests.status).toBe('partial');
    expect(r.worker_durable_objects_requests.usage).toBeNull();
  });
  it('does not certify an empty dataset as a verified billing meter when its mapping is unverified', async () => {
    const dataset = datasets.find((d) => d.ids.includes('artifacts_storage'))!;
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: { viewer: { accounts: [{ [dataset.name]: [] }] } },
        errors: null,
      }),
    );
    const r = await collectDataset(
      dataset,
      {
        accountId: 'a'.repeat(32),
        clients: { account: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    expect(r.artifacts_storage.status).toBe('partial');
    expect(r.artifacts_storage.coverage).toBe('partial');
    expect(r.artifacts_storage.usage).toBeNull();
  });
  it('counts actual Zero Trust seat flags instead of all user records', async () => {
    const client = new CloudflareReadClient('fixture', async (input) => {
      const url = String(input);
      return Response.json({
        success: true,
        result: url.includes('/access/users')
          ? [
              { access_seat: true, gateway_seat: true },
              { access_seat: false, gateway_seat: false },
            ]
          : url.includes('/secrets_store/quota')
            ? { secrets: { usage: 0, quota: 100 } }
            : url.includes('/images/v1/stats')
              ? { count: { current: 0 } }
              : url.includes('/stream/storage-usage')
                ? { totalStorageMinutes: 0 }
                : url.includes('/observability/usage')
                  ? { events: 0 }
                  : [],
      });
    });
    const r = await collectAccount(
      {
        accountId: 'a'.repeat(32),
        clients: { account: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
      [
        {
          id: 'zt',
          name: 'Zero Trust Free',
          planId: 'teams_free',
          price: '0',
          currency: 'USD',
          frequency: 'not-applicable',
          start: null,
          end: null,
          state: 'Paid',
          components: [{ name: 'users', label: 'Users', kind: 'sum', value: '50' }],
        },
      ],
    );
    expect(r.zero_trust_seats.usage).toBe('1');
    expect(r.zero_trust_seats.included).toBe('50');
  });
  it('distinguishes a verified zero storage peak over the whole cycle from absent records', async () => {
    const d = datasets.find((x) => x.ids.includes('r2_storage'))!;
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [
              { r2StorageAdaptiveGroups: [{ max: { payloadSize: '0', metadataSize: '0' } }] },
            ],
          },
        },
        errors: null,
      }),
    );
    const r = await collectDataset(
      d,
      {
        accountId: 'a'.repeat(32),
        clients: { user: client },
        now: new Date('2026-10-23T08:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    expect(r.r2_storage.usage).toBe('0');
    expect(r.r2_storage.coverage).toBe('complete');
  });
  it('does not turn a null aggregate from a successful query into zero', async () => {
    const client = new CloudflareReadClient('fixture', async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [
              { workersInvocationsAdaptive: [{ sum: { requests: null, cpuTimeUs: '0' } }] },
            ],
          },
        },
        errors: null,
      }),
    );
    const result = await collectDataset(
      datasets[0],
      {
        accountId: 'a'.repeat(32),
        clients: { user: client },
        now: new Date('2026-10-23T00:00:00Z'),
        cycle: { start: '2026-10-15T00:00:00Z', end: '2026-11-15T00:00:00Z' },
      },
      metrics,
    );
    expect(result.worker_standard_request.usage).toBeNull();
    expect(result.worker_standard_request.status).toBe('error');
  });
  it('classifies billable R2 operations and storage class; excludes free API activity', () => {
    const rows = [
      { dimensions: { actionType: 'PutObject', storageClass: 'Standard' }, sum: { requests: '2' } },
      {
        dimensions: { actionType: 'GetObject', storageClass: 'InfrequentAccess' },
        sum: { requests: '3' },
      },
      {
        dimensions: { actionType: 'DeleteObject', storageClass: 'Standard' },
        sum: { requests: '7' },
      },
    ];
    expect(mapR2Operations(rows)).toMatchObject({
      r2_class_a_operations: '2',
      r2_ia_class_b_operations: '3',
    });
    expect(mapR2Operations(rows).r2_class_b_operations).toBe('0');
  });
  it('registers newly discovered subscription meters with unknown units', () => {
    const defs = resolveDefinitions([
      {
        id: 'test',
        name: 'New product',
        planId: 'custom',
        price: '0',
        currency: 'USD',
        frequency: 'monthly',
        start: null,
        end: null,
        state: 'Paid',
        components: [
          { name: 'new_unfamiliar_meter', label: 'New meter', kind: 'usage', value: '1' },
        ],
      },
    ]);
    expect(defs.find((m) => m.id === 'new_unfamiliar_meter')?.unit).toBe('待核实');
  });
});
