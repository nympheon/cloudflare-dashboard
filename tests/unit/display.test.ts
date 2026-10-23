// Fixture identities, billing dates and quantities are synthetic.
import { it, expect } from 'vitest';
import { metrics } from '../../shared/catalog';
import { mergeMetric } from '../../worker/metrics/state';
import { quotaFor, number, money } from '../../src/lib/format';
it('does not display a full-period balance for partial usage', () => {
  const view = mergeMetric(metrics[0], undefined, {
    usage: '10',
    status: 'partial',
    coverage: 'partial',
    period: {
      kind: 'billing_cycle',
      start: '2026-10-15T00:00:00Z',
      end: '2026-11-15T00:00:00Z',
      timeZone: 'UTC',
    },
    at: '2026-10-23T08:00:00Z',
    source: 'test',
  });
  expect(quotaFor(view).percent).toBeNull();
  expect(quotaFor(view).remaining).toBeNull();
});
it('formats large integers without rounding and tiny positive fees without showing zero', () => {
  expect(number('9007199254740993', 0)).toBe('9,007,199,254,740,993');
  expect(money('0.00000001')).toBe('<$0.0001');
});
