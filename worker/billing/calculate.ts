import Decimal from 'decimal.js';
import type { Observation, PricingRule, QuotaDisplay } from '../../shared/dashboard';
Decimal.set({ precision: 40 });
export function deriveQuota(usage: string | null, included: string | null): QuotaDisplay {
  if (usage === null || included === null)
    return { percent: null, remaining: null, excess: null, level: 'unknown' };
  const u = new Decimal(usage),
    q = new Decimal(included),
    excess = Decimal.max(0, u.minus(q)).toString(),
    remaining = Decimal.max(0, q.minus(u)).toString();
  const p = q.gt(0) ? u.div(q).mul(100) : null;
  return {
    percent: p?.toString() ?? null,
    remaining,
    excess,
    level: p
      ? p.gt(100)
        ? 'exceeded'
        : p.gte(90)
          ? 'danger'
          : p.gte(80)
            ? 'warning'
            : 'normal'
      : u.gt(0) && q.eq(0)
        ? 'exceeded'
        : 'unknown',
  };
}
export function meterCost(metric: Observation, rule: PricingRule): string | null {
  if (metric.reportedCost !== undefined) return metric.reportedCost;
  if (rule.effectiveUntil && new Date(metric.at) >= new Date(rule.effectiveUntil)) return null;
  if (
    metric.usage === null ||
    metric.estimationBlocked ||
    metric.coverage !== 'complete' ||
    metric.status !== 'ok' ||
    rule.hardLimit ||
    metric.period.kind === 'instant' ||
    rule.sharedWith
  )
    return null;
  // Browser Run rounds the accumulated billing-cycle hours, never each session/day.
  const usage = rule.roundNearest
    ? new Decimal(metric.usage)
        .div(rule.per)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .mul(rule.per)
    : new Decimal(metric.usage);
  const units = Decimal.max(0, usage.minus(rule.included)).div(rule.per);
  return (rule.roundUp ? units.ceil() : units).mul(rule.rate).toString();
}
export function costParts(
  metric: Observation,
  rule: PricingRule | undefined,
): { reported: string; estimated: string; unpriced: boolean } {
  const reported = metric.reportedCost ?? '0';
  if (
    metric.status === 'no_records' &&
    metric.coverage === 'complete' &&
    rule &&
    (!rule.effectiveUntil || new Date(metric.at) < new Date(rule.effectiveUntil))
  )
    return { reported, estimated: '0', unpriced: false };
  if (metric.reportedCost !== undefined && metric.chargeCoverage === 'complete')
    return { reported, estimated: '0', unpriced: false };
  if (!rule) return { reported, estimated: '0', unpriced: metric.status !== 'not_enabled' };
  const currentCost = meterCost({ ...metric, reportedCost: undefined }, rule);
  if (currentCost === null)
    return { reported, estimated: '0', unpriced: metric.status !== 'not_enabled' };
  if (metric.reportedCost === undefined)
    return { reported: '0', estimated: currentCost, unpriced: false };
  const billedCost =
    metric.reportedUsage === undefined
      ? null
      : meterCost({ ...metric, usage: metric.reportedUsage, reportedCost: undefined }, rule);
  return {
    reported,
    estimated:
      billedCost === null
        ? '0'
        : Decimal.max(0, new Decimal(currentCost).minus(billedCost)).toString(),
    unpriced: billedCost === null,
  };
}
export function tieredCost(
  usage: string,
  tiers: Array<{ upTo: string | null; rate: string }>,
): string {
  let remaining = new Decimal(usage),
    lower = new Decimal(0),
    cost = new Decimal(0);
  for (const t of tiers) {
    const amount =
      t.upTo === null ? remaining : Decimal.min(remaining, new Decimal(t.upTo).minus(lower));
    cost = cost.plus(amount.mul(t.rate));
    remaining = remaining.minus(amount);
    if (t.upTo !== null) lower = new Decimal(t.upTo);
    if (remaining.lte(0)) break;
  }
  return cost.toString();
}
