import type { Period, PeriodKind } from '../../shared/dashboard';
export function periodFor(
  kind: PeriodKind,
  now: Date,
  cycle?: { start: string; end: string },
): Period {
  if (kind === 'instant') return { kind, start: null, end: null, timeZone: 'UTC' };
  if (kind === 'billing_cycle')
    return {
      kind,
      start: cycle ? new Date(cycle.start).toISOString() : null,
      end: cycle ? new Date(cycle.end).toISOString() : null,
      timeZone: 'UTC',
    };
  const y = now.getUTCFullYear(),
    m = now.getUTCMonth(),
    d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, kind === 'day' ? d : 1));
  const end = new Date(Date.UTC(y, kind === 'day' ? m : m + 1, kind === 'day' ? d + 1 : 1));
  return { kind, start: start.toISOString(), end: end.toISOString(), timeZone: 'UTC' };
}
export function samePeriod(a: Period, b: Period) {
  return a.kind === b.kind && a.start === b.start && a.end === b.end;
}
export function collectionStart(period: Period, now: Date, paidSince?: string): string | null {
  if (period.kind === 'instant') return new Date(now.getTime() - 3600e3).toISOString();
  if (!period.start) return null;
  return paidSince && new Date(paidSince) > new Date(period.start)
    ? new Date(paidSince).toISOString()
    : period.start;
}
