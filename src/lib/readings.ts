import { products } from '../../shared/catalog';
import type { MetricView, Product } from '../../shared/dashboard';
import { visibleMetrics } from '../../shared/visibility';
import { displayObservation, periodLabel, quotaFor, statusLabel } from './format';

export const productGroups = ['Workers Paid', 'AI 与媒体', '网络与订阅'] as const;
export const quotaRisk = { normal: 0, unknown: 0, warning: 1, danger: 2, exceeded: 3 };

export function readMetric(view: MetricView) {
  const { definition } = view;
  const observation = displayObservation(view);
  const quota = quotaFor(view);
  const exceeded = Number(quota.excess ?? 0) > 0;
  return {
    view,
    definition,
    observation,
    quota,
    included: observation.included ?? definition.included,
    balance: exceeded ? quota.excess : quota.remaining,
    exceeded,
    status: statusLabel(view, quota.level),
    period: periodLabel[observation.period.kind],
  };
}

export type Reading = ReturnType<typeof readMetric>;
export type ProductReadings = { product: Product; readings: Reading[]; primary: Reading };

export function collectReadings(metrics: Record<string, MetricView>) {
  const readings = visibleMetrics(metrics).map(readMetric);
  const byProduct = new Map<string, Reading[]>();
  for (const reading of readings) {
    const id = reading.definition.productId;
    const list = byProduct.get(id);
    if (list) list.push(reading);
    else byProduct.set(id, [reading]);
  }
  const available = products.flatMap((product): ProductReadings[] => {
    const list = byProduct.get(product.id);
    if (!list?.length) return [];
    const first = list.find(({ observation }) => observation.usage !== null) ?? list[0];
    const primary = list.reduce(
      (best, reading) =>
        Number(reading.quota.percent ?? -1) > Number(best.quota.percent ?? -1) ? reading : best,
      first,
    );
    return [{ product, readings: list, primary }];
  });
  return { readings, available };
}
