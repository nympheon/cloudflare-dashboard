import Decimal from 'decimal.js';
import { obj, text, numeric, type Json } from '../json';
import type { Subscription } from '../../../shared/dashboard';
const aliases: Array<[RegExp, string]> = [
  [/Workers CPU ms/i, 'worker_standard_cpu_ms'],
  [/Workers.*(?:Standard.*Requests|Requests.*Standard)/i, 'worker_standard_request'],
  [/D1.*Rows Read/i, 'd1_rows_read'],
  [/D1.*Rows Writ/i, 'd1_rows_written'],
  [/D1.*Storage/i, 'd1_storage'],
  [/Durable Objects.*(?:SQL|SQLite).*Storage/i, 'worker_durable_objects_sql_storage'],
  [/Durable Objects.*(?:SQL|SQLite).*Read/i, 'worker_durable_objects_sql_rows_read'],
  [/Durable Objects.*(?:SQL|SQLite).*Writ/i, 'worker_durable_objects_sql_rows_written'],
  [/Durable Objects.*Request/i, 'worker_durable_objects_requests'],
  [/Durable Objects.*Duration/i, 'worker_durable_objects_duration'],
  [/R2.*(?:IA|Infrequent).*Class A/i, 'r2_ia_class_a_operations'],
  [/R2.*(?:IA|Infrequent).*Class B/i, 'r2_ia_class_b_operations'],
  [/R2.*(?:IA|Infrequent).*Retriev/i, 'r2_ia_data_retrieval'],
  [/R2.*(?:IA|Infrequent).*Storage/i, 'r2_ia_storage'],
  [/R2.*Class A/i, 'r2_class_a_operations'],
  [/R2.*Class B/i, 'r2_class_b_operations'],
  [/R2.*Storage/i, 'r2_storage'],
  [/KV.*Read/i, 'worker_kv_reads'],
  [/KV.*Writ/i, 'worker_kv_writes'],
  [/KV.*Delet/i, 'worker_kv_deletes'],
  [/KV.*List/i, 'worker_kv_lists'],
  [/KV.*Stor/i, 'worker_kv_storage'],
  [/Build.*Minute/i, 'worker_build_minute'],
  [/Observability.*Event|Workers Logs/i, 'worker_observability_events'],
  [/Queue.*Operation/i, 'queues_standard_operations'],
  [/Image.*Unique.*Transform/i, 'image_unique_transformations'],
  [/Image.*Deliver/i, 'image_delivered_per_hundred_thousand'],
  [/Stream.*View|Stream.*Deliver/i, 'stream_viewed_thousand_minutes'],
  [/Browser.*Hour/i, 'browser_rendering_total_browser_hours'],
  [/Zaraz.*Load/i, 'zaraz_loads'],
];
export function billableMetricId(name: string): string | null {
  return aliases.find(([r]) => r.test(name))?.[1] ?? null;
}
export interface BillableAggregate {
  usage: string;
  cost: string;
  through: string;
  unit: string;
  name: string;
  currency: string;
}
export function aggregateBillable(
  rows: Json[],
  cycleStart: string,
): Record<string, BillableAggregate> {
  const out: Record<string, BillableAggregate> = {};
  const seen = new Set<string>();
  for (const raw of rows) {
    const r = obj(raw);
    const start = text(r.BillingPeriodStart);
    if (!start || new Date(start).getTime() !== new Date(cycleStart).getTime()) continue;
    const signature = JSON.stringify(r);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const name = text(r.ServiceName);
    const id =
      billableMetricId(name) ??
      `billing_${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .slice(0, 120)}`;
    const usage = numeric(r.ConsumedQuantity),
      cost = numeric(r.BilledCost);
    if (usage === null || cost === null) continue;
    const old = out[id];
    out[id] = {
      usage: new Decimal(old?.usage ?? 0).plus(usage).toString(),
      cost: new Decimal(old?.cost ?? 0).plus(cost).toString(),
      through: [old?.through ?? '', text(r.ChargePeriodEnd)].sort().at(-1)!,
      unit: text(r.ConsumedUnit) || text(r.PricingUnit),
      name,
      currency: text(r.BillingCurrency),
    };
  }
  return out;
}
export function normalizeSubscriptions(rows: Json[]): Subscription[] {
  return rows.map((raw) => {
    const r = obj(raw),
      plan = obj(r.rate_plan);
    return {
      id: text(r.id),
      name: text(plan.public_name) || text(obj(r.product).public_name),
      planId: text(plan.id),
      price: numeric(r.price) ?? '0',
      currency: text(r.currency) || 'USD',
      frequency: text(r.frequency),
      start: text(r.current_period_start) || null,
      end: text(r.current_period_end) || null,
      state: text(r.state),
      effectiveAt: text(r.created_date) || text(r.initial_period_start) || null,
      components: (Array.isArray(r.component_values) ? r.component_values : []).map((c) => {
        const v = obj(c);
        return {
          name: text(v.name),
          label: text(v.display_name),
          kind: text(v.kind),
          value: text(v.value),
        };
      }),
    };
  });
}
