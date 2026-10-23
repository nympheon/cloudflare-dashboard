import Decimal from 'decimal.js';
import type { MetricView, Observation } from '../../shared/dashboard';
import { deriveQuota } from '../../worker/billing/calculate';
export const number = (value: string | null | undefined, maxDigits = 2) => {
  if (value == null) return '—';
  const decimal = new Decimal(value),
    threshold = new Decimal(10).pow(-maxDigits);
  if (decimal.gt(0) && decimal.lt(threshold)) return '<' + threshold.toFixed(maxDigits);
  const [whole, fraction] = decimal.toDecimalPlaces(maxDigits).toFixed().split('.');
  return new Intl.NumberFormat('zh-CN').format(BigInt(whole)) + (fraction ? '.' + fraction : '');
};
export const addAmounts = (...values: Array<string | null | undefined>) =>
  values.some((v) => v == null)
    ? null
    : values.reduce<Decimal>((sum, v) => sum.plus(v!), new Decimal(0)).toString();
export const compact = (value: string | null | undefined) => {
  if (value == null) return '—';
  const v = new Decimal(value);
  for (const [threshold, suffix] of [
    ['100000000', '亿'],
    ['10000', '万'],
  ] as const)
    if (v.gte(threshold)) return `${v.div(threshold).toDecimalPlaces(2).toString()}${suffix}`;
  return number(value);
};
export const money = (v: string | null | undefined) => {
  if (v == null) return '—';
  const d = new Decimal(v);
  if (d.gt(0) && d.lt('0.0001')) return '<$0.0001';
  const [whole, fraction] = d.toDecimalPlaces(4).toFixed(4).split('.');
  return (
    '$' +
    new Intl.NumberFormat('en-US').format(BigInt(whole)) +
    '.' +
    fraction.replace(/0+$/, '').padEnd(2, '0')
  );
};
export const dateTime = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(v))
    : '—';
export const date = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(v))
    : '待获取';
export const periodLabel = {
  billing_cycle: '订阅账期',
  calendar_month: '自然月',
  day: '今日 · UTC',
  instant: '当前容量',
};
export function displayObservation(view: MetricView): Observation {
  return view.current.status === 'error' && view.lastSuccess ? view.lastSuccess : view.current;
}
export function quotaFor(view: MetricView) {
  const o = displayObservation(view);
  return deriveQuota(
    o.coverage === 'complete' ? o.usage : null,
    o.included ?? view.definition.included ?? null,
  );
}
export function statusLabel(view: MetricView) {
  const current = view.current;
  if (current.status === 'error') return view.lastSuccess ? '读取失败 · 保留上次数据' : '暂未获取';
  if (current.status === 'partial') return '范围待核实';
  if (current.status === 'no_records') return '暂无记录';
  if (current.status === 'not_enabled') return '未开通';
  const q = quotaFor(view);
  return q.level === 'exceeded'
    ? '已经超额'
    : q.level === 'danger'
      ? '额度紧张'
      : q.level === 'warning'
        ? '接近额度'
        : '正常';
}
