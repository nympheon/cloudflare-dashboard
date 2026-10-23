import type { MetricView } from '../../../shared/dashboard';
import { QuotaRing } from './QuotaRing';
import {
  compact,
  number,
  money,
  periodLabel,
  dateTime,
  date,
  displayObservation,
  quotaFor,
  statusLabel,
} from '../../lib/format';
import { costParts } from '../../../worker/billing/calculate';
import { CircleAlert, ExternalLink } from 'lucide-react';
export function MetricPanel({
  view,
  color,
  compactMode = false,
}: {
  view: MetricView;
  color?: string;
  compactMode?: boolean;
}) {
  const d = view.definition,
    o = displayObservation(view),
    q = quotaFor(view),
    included = o.included ?? d.included;
  const unavailable = view.current.status === 'partial' || view.current.status === 'error';
  const costs = costParts(o, d.pricing);
  return (
    <article
      className={`metric-panel ${compactMode ? 'compact-metric' : ''} ${q.level === 'exceeded' ? 'is-exceeded' : ''}`}
    >
      <div className="metric-panel-heading">
        <h3>{d.label}</h3>
        <span className={`metric-status ${unavailable ? 'muted-status' : q.level}`}>
          {statusLabel(view)}
        </span>
      </div>
      <div className="metric-main">
        <QuotaRing quota={q} color={color} size={compactMode ? 102 : 126} label={d.label} />
        <div className="metric-amount">
          <strong>
            {compact(o.usage)}
            <small>{d.unit}</small>
          </strong>
          <p>
            {included === undefined
              ? '无已核实包含额度'
              : `${d.hardLimit ? '平台上限' : '包含'} ${compact(included)} ${d.unit}`}
          </p>
          <span>{periodLabel[d.period]}</span>
        </div>
      </div>
      <div className="quota-details">
        <span>{q.excess !== null && Number(q.excess) > 0 ? '超出额度' : '剩余额度'}</span>
        <strong>
          {q.excess !== null && Number(q.excess) > 0 ? compact(q.excess) : compact(q.remaining)}
          <small>{included === undefined ? '' : d.unit}</small>
        </strong>
      </div>
      {!compactMode ? (
        <>
          <div className="metric-detail-row">
            <span>
              {o.coverage === 'partial'
                ? '部分用量 / 包含'
                : d.hardLimit
                  ? '当前 / 上限'
                  : '已用 / 包含'}
            </span>
            <span>
              {number(o.usage)} / {number(included)} {d.unit}
            </span>
          </div>
          <div className="metric-detail-row">
            <span>{o.reportedCost !== undefined ? '已报告部分' : '超额费用估算'}</span>
            <span>
              {o.reportedCost !== undefined
                ? money(o.reportedCost)
                : costs.unpriced
                  ? '尚未计价'
                  : money(costs.estimated)}
              {d.hardLimit ? ' · 硬性限制' : ''}
            </span>
          </div>
          {o.reportedCost !== undefined && o.chargeCoverage === 'partial' ? (
            <>
              <div className="metric-detail-row">
                <span>尚未入账部分估算</span>
                <span>{costs.unpriced ? '尚未计价' : money(costs.estimated)}</span>
              </div>
              <p className="pricing-note">
                已入账至 {dateTime(o.chargeThrough)}；用量与金额更新时间不同。
              </p>
            </>
          ) : null}
          {o.period.start ? (
            <div className="metric-detail-row">
              <span>{periodLabel[d.period]} · 北京时间</span>
              <span>
                {date(o.period.start)} — {date(o.period.end)}
              </span>
            </div>
          ) : null}
          <div className="metric-detail-row">
            <span>数据时间</span>
            <span>{dateTime(o.at)}</span>
          </div>
          {o.rangeStart && o.period.start && new Date(o.rangeStart) > new Date(o.period.start) ? (
            <p className="pricing-note">本套餐生效后统计：{dateTime(o.rangeStart)} 起</p>
          ) : null}
          {d.pricing ? (
            <p className="pricing-note">
              超出后 ${d.pricing.rate} / {compact(d.pricing.per)} {d.unit}
              {d.pricing.roundUp ? '（向上进位）' : ''}
              {d.pricing.roundNearest ? '（账期累计时长四舍五入）' : ''}
            </p>
          ) : null}
        </>
      ) : null}
      {view.current.message && unavailable ? (
        <p className="metric-message">
          <CircleAlert size={13} />
          {view.current.message}
          {view.lastSuccess && view.current.status === 'error'
            ? ` · 数据时间 ${dateTime(view.lastSuccess.at)}`
            : ''}
        </p>
      ) : null}
      {!compactMode ? (
        <div className="metric-source">
          <span title={o.source}>来源 · {o.source.split('?')[0].split('/').at(-1)}</span>
          <a href={d.source} target="_blank" rel="noreferrer">
            口径
            <ExternalLink size={11} />
          </a>
        </div>
      ) : null}
    </article>
  );
}
