import { metrics } from '../shared/catalog';
import { periodFor } from '../worker/metrics/periods';
import { mergeMetric } from '../worker/metrics/state';
import type { DashboardSnapshot, PublicSettings } from '../shared/dashboard';
export const demoSettings: PublicSettings = {
  revision: 1,
  account: { id: 'demo', name: '演示账户' },
  credentials: {
    account: { suffix: 'DEMO', verifiedAt: '2025-01-01T00:00:00Z' },
    user: { suffix: 'DEMO', verifiedAt: '2025-01-01T00:00:00Z' },
  },
  encryptionReady: true,
};
export function demoSnapshot(scenario: string): DashboardSnapshot {
  const now = new Date(),
    month = periodFor('calendar_month', now),
    cycle = { start: month.start!, end: month.end! };
  const values: Record<string, string> = {
    worker_standard_request: '6200000',
    worker_standard_cpu_ms: '11400000',
    d1_rows_written: '10500000',
    d1_rows_read: '3400000000',
    d1_capacity: '0.0092',
    r2_class_a_operations: '24',
    r2_class_b_operations: '11',
    worker_build_minute: '280',
    secrets_count: '0',
    worker_durable_objects_duration: '10.84',
    worker_durable_objects_requests: '3000',
    queues_standard_operations: '180000',
    vectorize_queried_dimensions: '15000000',
    images_storage_per_hundred_thousand: '0',
    stream_storage_thousand_minutes: '0',
  };
  if (scenario === 'warning') values.worker_standard_request = '8500000';
  if (scenario === 'danger') values.worker_standard_request = '9500000';
  if (scenario === 'overage') values.worker_standard_request = '12500000';
  const views = Object.fromEntries(
    metrics.map((d) => {
      const usage = values[d.id] ?? null;
      const observation = {
        usage,
        status: usage === null ? ('no_records' as const) : ('ok' as const),
        coverage: 'complete' as const,
        period: periodFor(d.period, now, cycle),
        at: now.toISOString(),
        source: '独立演示数据',
      };
      const view = mergeMetric(d, undefined, observation);
      if (scenario === 'error' && d.productId === 'workers')
        view.current = {
          ...view.current,
          usage: null,
          status: 'error',
          message: '演示：模拟网络暂时失败，仍保留上次成功值',
        };
      return [d.id, view];
    }),
  );
  return {
    revision: 1,
    settingsRevision: 1,
    attemptedAt: now.toISOString(),
    succeededAt: now.toISOString(),
    account: demoSettings.account!,
    billingPeriod: periodFor('billing_cycle', now, cycle),
    subscriptions: [
      {
        id: 'demo',
        name: 'Workers Paid',
        planId: 'workers_paid',
        price: '5',
        currency: 'USD',
        frequency: 'monthly',
        start: cycle.start,
        end: cycle.end,
        state: 'Paid',
        components: [],
      },
    ],
    metrics: views,
    costs: {
      fixed: '5',
      reported: '0',
      estimated: scenario === 'overage' ? '0.75' : '0',
      unpriced: 12,
      complete: false,
      currency: 'USD',
      note: '示例数据',
    },
    warnings: [],
  };
}
