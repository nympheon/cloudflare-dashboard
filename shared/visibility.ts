import type { MetricView, Product } from './dashboard';
export function isMetricVisible(view: MetricView): boolean {
  const o = view.current.status === 'error' && view.lastSuccess ? view.lastSuccess : view.current;
  if (o.status === 'not_enabled') return false;
  return (
    o.reportedCost !== undefined ||
    ((o.status === 'ok' || o.status === 'partial') && o.usage !== null) ||
    (o.status === 'no_records' && o.coverage === 'complete')
  );
}
export function visibleMetrics(metrics: Record<string, MetricView>): MetricView[] {
  return Object.values(metrics).filter(isMetricVisible);
}
export function visibleProducts(
  products: Product[],
  metrics: Record<string, MetricView>,
): Product[] {
  const ids = new Set(visibleMetrics(metrics).map((v) => v.definition.productId));
  return products.filter((p) => ids.has(p.id));
}
