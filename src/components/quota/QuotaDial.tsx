import { ArrowUpRight } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { products } from '../../../shared/catalog';
import type { DashboardViewState } from '../layout/Shell';
import { compact, dateTime, percentage, quantity } from '../../lib/format';
import type { Reading } from '../../lib/readings';

const names = new Map(products.map(({ id, name }) => [id, name]));

function titleFor(reading: Reading) {
  return [names.get(reading.definition.productId), reading.definition.label]
    .filter(Boolean)
    .join(' ');
}

function balanceLabel({ exceeded }: Reading) {
  return exceeded ? '超出额度' : '剩余额度';
}

function QuotaArcs({
  readings,
  active,
  select,
}: {
  readings: Reading[];
  active: string;
  select: (id: string) => void;
}) {
  const rings = readings
    .filter(({ quota }) => quota.percent !== null)
    .map((reading, index, all) => {
      const radius = 119 - (all.length > 1 ? (84 * index) / (all.length - 1) : 0);
      const y = 133 - radius;
      // Each track spans three quarters of a circle, leaving room for its label.
      const path = `M 133 ${y} A ${radius} ${radius} 0 1 0 ${133 + radius} 133`;
      const percent = Math.min(100, Math.max(0, Number(reading.quota.percent)));
      return { reading, y, path, percent };
    });
  if (!rings.length) return null;
  return (
    <div className="quota-arcs" role="group" aria-label="核心额度刻度">
      <svg viewBox="0 0 365 270" aria-hidden="true">
        {rings.map(({ reading, path, percent }) => (
          <g
            key={reading.view.id}
            data-level={reading.quota.level}
            data-selected={reading.view.id === active}
            onClick={() => select(reading.view.id)}
          >
            <path className="arc-track" d={path} />
            {percent > 0 && (
              <path
                className="arc-fill"
                d={path}
                pathLength={100}
                strokeDasharray={`${percent} ${100 - percent}`}
              />
            )}
          </g>
        ))}
      </svg>
      {rings.map(({ reading, y }) => {
        const id = reading.view.id;
        const percent = percentage(reading.quota.percent);
        return (
          <button
            key={id}
            type="button"
            className="arc-label"
            aria-pressed={id === active}
            aria-label={titleFor(reading) + ' ' + percent}
            title={titleFor(reading)}
            style={{ top: `${(y / 270) * 100}%` }}
            onClick={() => select(id)}
          >
            <span>{titleFor(reading)}</span>
            <b data-level={reading.quota.level}>{percent}</b>
          </button>
        );
      })}
    </div>
  );
}

export function QuotaDial({ readings }: { readings: Reading[] }) {
  const { selectedMetric, setSelectedMetric } = useOutletContext<DashboardViewState>();
  const active = readings.find(({ view }) => view.id === selectedMetric) ?? readings[0];
  if (!active) return null;
  const { view, observation, definition, included, quota, balance } = active;
  const product = names.get(definition.productId);
  const unavailable = view.current.status === 'error' || view.current.status === 'partial';
  const hasRings = readings.some(({ quota }) => quota.percent !== null);
  return (
    <>
      <div className="dial-stage" data-has-rings={hasRings}>
        <QuotaArcs readings={readings} active={view.id} select={setSelectedMetric} />
        <div className="dial-focus">
          <div aria-live="polite" aria-atomic="true">
            <p className="dial-context">
              {active.period} <span data-level={quota.level}>· {active.status}</span>
            </p>
            <h3>{titleFor(active)}</h3>
            <p className="dial-number">
              {compact(observation.usage)}
              {observation.usage !== null && <small>{definition.unit}</small>}
            </p>
            <dl className="dial-stats">
              <div>
                <dt>已用比例</dt>
                <dd>{percentage(quota.percent)}</dd>
              </div>
              <div>
                <dt>{definition.hardLimit ? '平台上限' : '包含额度'}</dt>
                <dd>{quantity(included, definition.unit)}</dd>
              </div>
              <div>
                <dt>{balanceLabel(active)}</dt>
                <dd>{quantity(balance, definition.unit)}</dd>
              </div>
            </dl>
            {unavailable && (
              <p className="dial-note">
                {view.current.message ?? active.status}
                {view.current.status === 'error' &&
                  view.lastSuccess &&
                  ' · 数据时间 ' + dateTime(observation.at)}
              </p>
            )}
          </div>
          <Link className="text-link" to={'/products/' + definition.productId}>
            查看 {product ?? '产品'} 全部指标 <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="quota-readings" role="group" aria-label="核心额度完整读数">
        <div className="quota-reading-head" aria-hidden="true">
          <span>核心指标 / 周期</span>
          <span>已用 / 额度</span>
          <span>剩余或超出</span>
          <span>状态</span>
        </div>
        {readings.map((reading) => {
          const { view, definition, quota, included, observation } = reading;
          return (
            <button
              key={view.id}
              type="button"
              className="quota-reading"
              aria-pressed={view.id === active.view.id}
              onClick={() => setSelectedMetric(view.id)}
            >
              <span>
                <b>{titleFor(reading)}</b>
                <small>{reading.period}</small>
              </span>
              <span>
                {quantity(observation.usage, definition.unit)}
                <small>
                  {included === undefined
                    ? '无已核实包含额度'
                    : (definition.hardLimit ? '上限 ' : '额度 ') +
                      quantity(included, definition.unit)}
                </small>
              </span>
              <span>
                {reading.exceeded ? '超出 ' : '剩余 '}
                {quantity(reading.balance, definition.unit)}
                <small>{percentage(quota.percent)}</small>
              </span>
              <span data-level={quota.level}>
                {reading.status}
                {view.current.status === 'error' && view.lastSuccess && (
                  <small>{dateTime(observation.at)}</small>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
