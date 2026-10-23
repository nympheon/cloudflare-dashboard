import { env } from 'cloudflare:workers';
import { reset } from 'cloudflare:test';
import { it, expect } from 'vitest';
import sql from '../../migrations/0001_dashboard.sql?raw';
import lease from '../../migrations/0002_refresh_lease.sql?raw';
import { Repository } from '../../worker/storage/repository';
import { demoSnapshot } from '../../src/demo';
it('measures primary-key bootstrap and refresh scans/writes and keeps singleton state', async () => {
  await reset();
  for (const s of (sql + lease).split(';').filter((s) => s.trim())) await env.DB.prepare(s).run();
  const bootstrap = new Repository(env.DB);
  await Promise.all([bootstrap.settings(), bootstrap.snapshot()]);
  expect(bootstrap.diagnostics).toMatchObject({ rowsRead: 2, rowsWritten: 0 });
  const refresh = new Repository(env.DB);
  expect(await refresh.acquireRefresh('fixture')).toBe(true);
  await Promise.all([refresh.settings(), refresh.snapshot()]);
  const snapshot = demoSnapshot('normal');
  snapshot.settingsRevision = 0;
  await refresh.saveSnapshot(snapshot, 0, 'fixture');
  expect(refresh.diagnostics.rowsWritten).toBe(2);
  expect(refresh.diagnostics.rowsRead).toBeGreaterThanOrEqual(4);
  const plan = await env.DB.prepare(
    'EXPLAIN QUERY PLAN SELECT data FROM dashboard_state WHERE id = 1',
  ).all();
  expect(JSON.stringify(plan.results)).toContain('INTEGER PRIMARY KEY');
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM dashboard_state').first<{
    total: number;
  }>();
  expect(count?.total).toBe(1);
  console.info(
    'D1 actual meta',
    JSON.stringify({
      bootstrap: bootstrap.diagnostics,
      refresh: refresh.diagnostics,
      queryPlan: plan.results,
    }),
  );
});
