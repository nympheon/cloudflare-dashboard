import { describe, expect, it } from 'vitest';
import { metrics, products } from '../../shared/catalog';
import type { Observation } from '../../shared/dashboard';
import { mergeMetric } from '../../worker/metrics/state';
import { visibleMetrics, visibleProducts } from '../../shared/visibility';

const base: Observation = {
  usage: '0',
  status: 'ok',
  coverage: 'complete',
  at: '2026-10-23T08:00:00Z',
  source: 'fixture',
  period: {
    kind: 'billing_cycle',
    start: '2026-10-15T00:00:00Z',
    end: '2026-11-15T00:00:00Z',
    timeZone: 'UTC',
  },
};
describe('only show metrics with available data', () => {
  it('hides unavailable metrics and their product navigation, including old visible snapshots', () => {
    const unknown = mergeMetric(metrics[0], undefined, {
      ...base,
      usage: null,
      status: 'partial',
      coverage: 'unverified',
    });
    const denied = mergeMetric(metrics[1], undefined, {
      ...base,
      usage: null,
      status: 'error',
      coverage: 'unverified',
    });
    unknown.capability.visibility = 'visible';
    const views = { [unknown.id]: unknown, [denied.id]: denied };
    expect(visibleMetrics(views)).toEqual([]);
    expect(visibleProducts(products, views)).toEqual([]);
  });
  it('keeps confirmed zero, empty responses, and reported billing amounts', () => {
    const zero = mergeMetric(metrics[0], undefined, base);
    const empty = mergeMetric(metrics[1], undefined, {
      ...base,
      usage: null,
      status: 'no_records',
    });
    const billed = mergeMetric(metrics[2], undefined, {
      ...base,
      usage: null,
      status: 'partial',
      coverage: 'partial',
      reportedCost: '0.75',
    });
    expect(visibleMetrics({ zero, empty, billed }).map((v) => v.id)).toEqual([
      zero.id,
      empty.id,
      billed.id,
    ]);
    expect(visibleProducts(products, { zero, empty, billed }).map((p) => p.id)).toEqual([
      'workers',
    ]);
  });
  it('keeps same-period last-success data through a transient failure, but not across periods', () => {
    const ok = mergeMetric(metrics[0], undefined, base);
    const failed = {
      ...base,
      usage: null,
      status: 'error' as const,
      coverage: 'unverified' as const,
    };
    const preserved = mergeMetric(metrics[0], ok, failed);
    expect(visibleMetrics({ preserved })).toHaveLength(1);
    const nextPeriod = mergeMetric(metrics[0], ok, {
      ...failed,
      period: { ...base.period, start: '2026-11-15T00:00:00Z' },
    });
    expect(visibleMetrics({ nextPeriod })).toHaveLength(0);
  });
  it('shows a source again when a later refresh succeeds and hides disabled products', () => {
    const missing = mergeMetric(metrics[0], undefined, { ...base, usage: null, status: 'error' });
    const recovered = mergeMetric(metrics[0], missing, base);
    const disabled = mergeMetric(metrics[1], undefined, {
      ...base,
      usage: null,
      status: 'not_enabled',
    });
    expect(visibleMetrics({ recovered, disabled }).map((v) => v.id)).toEqual([recovered.id]);
  });
  it('does not revive an invalid estimate and preserves newer partial billing through a failure', () => {
    const old = mergeMetric(metrics[0], undefined, { ...base, usage: '500' });
    const invalid = mergeMetric(metrics[0], old, {
      ...base,
      usage: null,
      status: 'partial',
      coverage: 'partial',
    });
    const failed = { ...base, usage: null, status: 'error' as const };
    expect(visibleMetrics({ failed: mergeMetric(metrics[0], invalid, failed) })).toHaveLength(0);
    const billed = mergeMetric(metrics[0], old, {
      ...base,
      usage: '10',
      status: 'partial',
      coverage: 'partial',
      reportedCost: '0',
    });
    const preserved = mergeMetric(metrics[0], billed, failed);
    expect(preserved.lastSuccess?.usage).toBe('10');
    expect(preserved.lastSuccess?.coverage).toBe('partial');
    expect(visibleMetrics({ preserved })).toHaveLength(1);
  });
});
