import { mkdir, writeFile } from 'node:fs/promises';
import type { DashboardSnapshot } from '../shared/dashboard';
const base = 'http://127.0.0.1:5173';
const samples = [];
for (const scenario of ['manual-refresh', 'repeat-unchanged-usage']) {
  const start = performance.now();
  const response = await fetch(base + '/api/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'manual' }),
  });
  if (!response.ok) throw new Error(`Local measurement failed: HTTP ${response.status}`);
  const body = await response.text(),
    snapshot = JSON.parse(body) as DashboardSnapshot;
  samples.push({
    scenario,
    environment: 'local workerd + local D1',
    responseBytes: new TextEncoder().encode(body).byteLength,
    elapsedMs: Math.round(performance.now() - start),
    ...snapshot.diagnostics,
    metrics: Object.keys(snapshot.metrics).length,
  });
}
const start = performance.now();
const responses = await Promise.all(
  [1, 2].map(() =>
    fetch(base + '/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"reason":"manual"}',
    }).then((r) => r.json() as Promise<DashboardSnapshot>),
  ),
);
samples.push({
  scenario: 'two-concurrent-refreshes',
  environment: 'local workerd + local D1',
  elapsedMs: Math.round(performance.now() - start),
  sourceRuns: responses.filter((r) => r.diagnostics).length,
  returnedRevisions: responses.map((r) => r.revision),
});
await mkdir('.private/acceptance', { recursive: true });
await writeFile(
  '.private/acceptance/local-performance.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      note: 'Elapsed time includes network I/O and is not production billable CPU. Rows are actual D1 meta counters. Concurrent followers reuse the prior snapshot without polling.',
      samples,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(samples, null, 2));
