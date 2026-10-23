import type { MetricDefinition, MetricView, Observation } from '../../shared/dashboard';
import { samePeriod } from './periods';
export function mergeMetric(
  definition: MetricDefinition,
  previous: MetricView | undefined,
  current: Observation,
): MetricView {
  const successful =
    (current.status === 'ok' || current.status === 'partial') &&
    current.coverage !== 'unverified' &&
    current.usage !== null;
  const previousSuccess =
    // An invalidated billing mapping must not reappear after a later network error.
    !(
      current.status === 'partial' &&
      (current.coverage === 'unverified' || current.usage === null)
    ) &&
    previous?.lastSuccess &&
    samePeriod(previous.lastSuccess.period, current.period) &&
    (current.period.kind === 'instant' || previous.lastSuccess.rangeStart === current.rangeStart)
      ? previous.lastSuccess
      : null;
  return {
    id: definition.id,
    definition,
    current,
    lastSuccess: successful ? current : previousSuccess,
    capability: previous?.capability ?? {
      visibility: 'visible',
      reason: '来源能力待核查',
      checkedAt: current.at,
      evidence: definition.source,
    },
  };
}
