// Fixture identities, billing dates and quantities are synthetic.
import { describe, expect, it } from 'vitest';
import { products, metrics } from '../../shared/catalog';
import { periodFor, collectionStart } from '../../worker/metrics/periods';
import { deriveQuota, meterCost, tieredCost } from '../../worker/billing/calculate';
import { mergeMetric } from '../../worker/metrics/state';
import { encryptToken, decryptToken } from '../../worker/settings/crypto';
import type { Observation } from '../../shared/dashboard';

const period = {
  kind: 'billing_cycle' as const,
  start: '2026-10-15T00:00:00.000Z',
  end: '2026-11-15T00:00:00.000Z',
  timeZone: 'UTC' as const,
};
const observation = (usage: string | null, status: Observation['status'] = 'ok'): Observation => ({
  usage,
  status,
  period,
  coverage: 'complete',
  at: '2026-10-23T08:00:00Z',
  source: 'test',
});
describe('catalogue', () => {
  it('has unique product and meter IDs and resolvable sources', () => {
    expect(new Set(metrics.map((m) => m.id)).size).toBe(metrics.length);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    for (const m of metrics) {
      expect(products.some((p) => p.id === m.productId)).toBe(true);
      expect(m.source).toMatch(/^https:/);
    }
    expect(metrics.length).toBeGreaterThan(60);
  });
});
describe('quota and precise billing', () => {
  const rule = { included: '10000000', per: '1000000', rate: '0.30' };
  it('computes exact threshold, zero, unknown, overage and decimal cost', () => {
    expect(deriveQuota('10000000', '10000000').percent).toBe('100');
    expect(deriveQuota('12500000', '10000000')).toMatchObject({
      percent: '125',
      excess: '2500000',
      remaining: '0',
    });
    expect(deriveQuota(null, '10000000').percent).toBeNull();
    expect(deriveQuota('4', '0').percent).toBeNull();
    expect(meterCost(observation('12500000'), rule)).toBe('0.75');
    expect(meterCost(observation('10000000'), rule)).toBe('0');
    expect(meterCost({ ...observation('12500000'), coverage: 'partial' }, rule)).toBeNull();
  });
  it('does not bill Free service limits, instantaneous capacity or missing records', () => {
    expect(
      meterCost(observation('100'), { included: '0', rate: '1', per: '1', hardLimit: true }),
    ).toBeNull();
    expect(
      meterCost({ ...observation('10'), period: { ...period, kind: 'instant' } }, rule),
    ).toBeNull();
    expect(meterCost(observation(null, 'no_records'), rule)).toBeNull();
  });
  it('does not keep estimating after an announced price-rule change', () => {
    expect(
      meterCost(
        { ...observation('12500000'), at: '2026-12-01T00:00:00Z' },
        { ...rule, effectiveUntil: '2026-12-01T00:00:00Z' },
      ),
    ).toBeNull();
  });
  it('rounds billable units and supports tiered and unsafe-integer quantities', () => {
    expect(meterCost(observation('10000001'), { ...rule, roundUp: true })).toBe('0.3');
    expect(
      meterCost(observation('9007199254740993'), { included: '0', per: '1', rate: '0.01' }),
    ).toBe('90071992547409.93');
    expect(
      tieredCost('150', [
        { upTo: '100', rate: '0.1' },
        { upTo: null, rate: '0.05' },
      ]),
    ).toBe('12.5');
  });
});
describe('UTC periods', () => {
  it('does not apply Paid pricing to usage from before a mid-cycle upgrade', () => {
    expect(collectionStart(period, new Date('2026-10-23T08:00:00Z'), '2026-10-20T12:00:00Z')).toBe(
      '2026-10-20T12:00:00.000Z',
    );
  });
  it('resets day and month at UTC midnight', () => {
    expect(periodFor('day', new Date('2026-10-23T16:05:00Z')).start).toBe(
      '2026-10-23T00:00:00.000Z',
    );
    expect(periodFor('calendar_month', new Date('2028-02-29T16:05:00Z')).end).toBe(
      '2028-03-01T00:00:00.000Z',
    );
  });
  it('uses authoritative subscription boundaries and leaves unknown cycle unknown', () => {
    expect(
      periodFor('billing_cycle', new Date(), { start: period.start!, end: period.end! }),
    ).toEqual(period);
    expect(periodFor('billing_cycle', new Date()).start).toBeNull();
  });
});
describe('stable last-success observations', () => {
  const definition = () => metrics[0];
  it('retains last successful values after errors and never removes the metric', () => {
    const first = mergeMetric(definition(), undefined, observation('12'));
    const failed = mergeMetric(definition(), first, observation(null, 'error'));
    expect(failed.lastSuccess?.usage).toBe('12');
    expect(failed.current.usage).toBeNull();
    expect(failed.id).toBe(first.id);
    expect(mergeMetric(definition(), failed, observation('0')).lastSuccess?.usage).toBe('0');
  });
  it('does not use prior-period data as current usage', () => {
    const first = mergeMetric(definition(), undefined, observation('12'));
    const next = mergeMetric(definition(), first, {
      ...observation(null, 'error'),
      period: { ...period, start: '2026-11-15T00:00:00.000Z' },
    });
    expect(next.lastSuccess).toBeNull();
  });
});
describe('AES-GCM credential storage', () => {
  const key = 'ab'.repeat(32);
  it('uses randomized nonces, round trips, and rejects the wrong key', async () => {
    const a = await encryptToken('fixture-only-token', key);
    const b = await encryptToken('fixture-only-token', key);
    expect(a.nonce).not.toBe(b.nonce);
    expect(JSON.stringify(a)).not.toContain('fixture-only-token');
    expect(await decryptToken(a, key)).toBe('fixture-only-token');
    await expect(decryptToken(a, 'cd'.repeat(32))).rejects.toThrow();
  });
});
