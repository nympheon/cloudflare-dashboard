// Fixture identities, billing dates and quantities are synthetic.
import { describe, it, expect } from 'vitest';
import { costParts } from '../../worker/billing/calculate';
import type { Observation } from '../../shared/dashboard';
const rule = { included: '10000000', rate: '0.3', per: '1000000' };
const base: Observation = {
  usage: '12500000',
  status: 'ok',
  coverage: 'complete',
  period: {
    kind: 'billing_cycle',
    start: '2026-10-15T00:00:00Z',
    end: '2026-11-15T00:00:00Z',
    timeZone: 'UTC',
  },
  at: '2026-10-23T08:00:00Z',
  source: 'analytics',
  reportedCost: '0',
  reportedUsage: '9000000',
  chargeCoverage: 'partial',
  chargeThrough: '2026-10-23T00:00:00Z',
};
describe('lagging billing amounts', () => {
  it('keeps no-record usage unknown while pricing its verified empty scope as a zero estimate', () => {
    expect(
      costParts(
        {
          ...base,
          usage: null,
          status: 'no_records',
          reportedCost: undefined,
          reportedUsage: undefined,
        },
        rule,
      ),
    ).toEqual({ reported: '0', estimated: '0', unpriced: false });
  });
  it('estimates only the additional charge after the billed consumption', () => {
    expect(costParts(base, rule)).toEqual({ reported: '0', estimated: '0.75', unpriced: false });
    expect(costParts({ ...base, reportedCost: '0.3', reportedUsage: '11000000' }, rule)).toEqual({
      reported: '0.3',
      estimated: '0.45',
      unpriced: false,
    });
  });
  it('retains an incomplete-cost flag when current usage or pricing is missing', () => {
    expect(costParts({ ...base, coverage: 'partial' }, rule).unpriced).toBe(true);
    expect(costParts(base, undefined).unpriced).toBe(true);
  });
});
