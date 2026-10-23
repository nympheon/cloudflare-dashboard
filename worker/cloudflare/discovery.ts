import { metrics } from '../../shared/catalog';
import type { MetricDefinition, Subscription } from '../../shared/dashboard';
export const componentAliases: Record<string, string> = {
  worker_durable_objects_srs_stored_data: 'worker_durable_objects_sql_storage',
  worker_durable_objects_srs_storage_reads: 'worker_durable_objects_sql_rows_read',
  worker_durable_objects_srs_storage_writes: 'worker_durable_objects_sql_rows_written',
  workflow_storage: 'workflows_storage',
  workflow_steps: 'workflows_steps',
  email_service_emails_sent: 'email_sent',
  dynamic_workers_daily: 'dynamic_workers_count',
  workers_ai_regular_twitch_neurons: 'workers_ai_neurons',
  workers_ai_fast_twitch_neurons: 'workers_ai_neurons',
  worker_unbound_request: 'worker_standard_request',
  worker_unbound_duration: 'worker_standard_cpu_ms',
  worker_bundled_request: 'worker_standard_request',
};
export function resolveDefinitions(subscriptions: Subscription[]): MetricDefinition[] {
  const defs = [...metrics],
    ids = new Set(defs.map((x) => x.id));
  for (const sub of subscriptions)
    for (const c of sub.components) {
      if (c.kind !== 'usage' || ids.has(c.name) || componentAliases[c.name]) continue;
      const productId = c.name.startsWith('web3_')
        ? 'subscriptions'
        : c.name.startsWith('worker_durable')
          ? 'durable-objects'
          : c.name.startsWith('r2')
            ? 'r2'
            : c.name.startsWith('worker')
              ? 'workers'
              : 'subscriptions';
      defs.push({
        id: c.name,
        productId,
        label: c.label,
        unit: '待核实',
        period: 'billing_cycle',
        source: 'https://developers.cloudflare.com/api/resources/billing/',
        note: '账户订阅发现的计费维度；使用账单来源核查单位、额度和金额',
      });
      ids.add(c.name);
    }
  return defs;
}
