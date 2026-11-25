import { useMemo, type CSSProperties } from 'react';
import { ArrowUpRight, LayoutGrid, ListOrdered, Table2 } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { useDashboard } from '../app/DashboardProvider';
import { ConnectionPanel } from '../components/layout/ConnectionPanel';
import { ProductIcon } from '../components/layout/ProductIcon';
import type { DashboardViewState, UsageGroup, UsageView } from '../components/layout/Shell';
import { dateTime, percentage, quantity } from '../lib/format';
import {
  collectReadings,
  productGroups,
  type ProductReadings,
  type Reading,
} from '../lib/readings';
import '../styles/usage.css';

const modes = [
  { id: 'matrix', label: '产品矩阵', icon: LayoutGrid },
  { id: 'ranking', label: '额度排行', icon: ListOrdered },
  { id: 'metrics', label: '指标明细', icon: Table2 },
] as const;
const descriptions: Record<UsageView, string> = {
  matrix: '主要用量、剩余额度与数据状态',
  ranking: '按各产品已知的最高额度使用率排序',
  metrics: '按指标查看用量、额度、周期与数据状态',
};
const fromUsage = { from: '/usage' };
const productPath = ({ product }: ProductReadings) => '/products/' + product.id;
const noRecords = ({ view }: Reading) => view.current.status === 'no_records';
const noProductRecords = ({ readings }: ProductReadings) => readings.every(noRecords);

function headline({ quota, observation, definition }: Reading) {
  return quota.percent === null
    ? quantity(observation.usage, definition.unit)
    : percentage(quota.percent);
}
function amountPair({ observation, included, definition }: Reading) {
  const used = quantity(observation.usage, '');
  const limit = quantity(included, definition.unit);
  return used + ' / ' + limit;
}
function balanceText({ balance, exceeded, definition }: Reading) {
  return balance === null
    ? ''
    : (exceeded ? '超出 ' : '剩余 ') + quantity(balance, definition.unit);
}
function readingStatus(reading: Reading) {
  if (reading.view.current.status === 'error' && reading.view.lastSuccess) {
    return reading.status + ' · 数据时间 ' + dateTime(reading.observation.at);
  }
  return reading.status === '正常' && reading.quota.percent === null ? '已读取' : reading.status;
}

function MissingProducts({ items, expanded }: { items: ProductReadings[]; expanded: boolean }) {
  if (!items.length) return null;
  return (
    <details className="usage-absent" open={expanded || undefined}>
      <summary>
        暂无记录的产品 <b>{items.length}</b>
      </summary>
      <div className="quiet-products">
        {items.map((item) => (
          <Link key={item.product.id} to={productPath(item)} state={fromUsage}>
            <b>{item.product.name}</b>
            <small>
              {item.product.description} · {item.readings.length} 项 <ArrowUpRight size={12} />
            </small>
          </Link>
        ))}
      </div>
    </details>
  );
}

function ProductMatrix({ items }: { items: ProductReadings[] }) {
  const measured = items.filter((item) => !noProductRecords(item));
  return (
    <>
      {measured.length > 0 && (
        <div className="usage-matrix">
          {measured.map((item) => {
            const { product, readings, primary } = item;
            const secondary = readings.find(
              (reading) => reading !== primary && reading.observation.usage !== null,
            );
            const status = readingStatus(primary);
            const balance = balanceText(primary);
            return (
              <Link
                className="usage-tile"
                key={product.id}
                to={productPath(item)}
                state={fromUsage}
              >
                <span className="usage-tile-head">
                  <span>
                    <ProductIcon product={product} small />
                    <b>{product.name}</b>
                  </span>
                  <small>
                    {readings.length} 项 <ArrowUpRight size={12} />
                  </small>
                </span>
                <span className="usage-tile-description">{product.description}</span>
                <strong className="usage-tile-value" data-level={primary.quota.level}>
                  {headline(primary)}
                </strong>
                <span className="usage-tile-label">
                  {primary.definition.label} · {primary.period}
                </span>
                {primary.included !== undefined && <span>{amountPair(primary)}</span>}
                <b className="usage-tile-balance" data-level={primary.quota.level}>
                  {balance}
                  {balance && status !== '正常' ? ' · ' : ''}
                  {(!balance || status !== '正常') && status}
                </b>
                {secondary && (
                  <span className="usage-tile-secondary">
                    <span>
                      {secondary.definition.label}
                      {secondary.status !== '正常' && <small>{readingStatus(secondary)}</small>}
                    </span>
                    <b>{headline(secondary)}</b>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <MissingProducts items={items.filter(noProductRecords)} expanded={!measured.length} />
    </>
  );
}

function UsageRanking({ items }: { items: ProductReadings[] }) {
  const ranked = items
    .filter(({ primary }) => primary.quota.percent !== null)
    .sort((a, b) => Number(b.primary.quota.percent) - Number(a.primary.quota.percent));
  const unresolved = items.filter(
    (item) => item.primary.quota.percent === null && !noProductRecords(item),
  );
  const max = Math.max(
    100,
    ...ranked.map(({ primary }) => Math.ceil(Number(primary.quota.percent) / 25) * 25),
  );
  return (
    <>
      {ranked.length > 0 && (
        <div
          className="usage-ranking"
          style={{ '--warning-at': `${(80 / max) * 100}%` } as CSSProperties}
        >
          <p className="ranking-key">80% 预警线</p>
          <div className="ranking-row ranking-head">
            <b>产品 / 主指标</b>
            <span className="ranking-axis">
              <span>0%</span>
              <span>{max}%</span>
            </span>
            <span>已用 / 额度</span>
          </div>
          {ranked.map((item) => {
            const { product, primary } = item;
            const percent = Number(primary.quota.percent);
            const status = readingStatus(primary);
            return (
              <Link
                key={product.id}
                to={productPath(item)}
                state={fromUsage}
                className="ranking-row"
                data-level={primary.quota.level}
              >
                <span>
                  <b>{product.name}</b>
                  <small>
                    {primary.definition.label} · {primary.period}
                  </small>
                </span>
                <span className="ranking-amount">
                  <span className="ranking-track" aria-hidden="true">
                    <span style={{ width: `${(percent / max) * 100}%` }} />
                  </span>
                  <b>{headline(primary)}</b>
                </span>
                <span className="ranking-reading">
                  {amountPair(primary)}
                  <small>
                    {balanceText(primary)}
                    {status !== '正常' && ' · ' + status}
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {unresolved.length > 0 && (
        <section className="ranking-unresolved">
          <h3>额度比例未知</h3>
          {unresolved.map((item) => (
            <Link
              key={item.product.id}
              to={productPath(item)}
              state={fromUsage}
              className="ranking-row"
            >
              <b>{item.product.name}</b>
              <span>
                {item.primary.definition.label} · {item.primary.period}
              </span>
              <span data-level={item.primary.quota.level}>
                {headline(item.primary)}
                <small>
                  {[balanceText(item.primary), readingStatus(item.primary)]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
            </Link>
          ))}
        </section>
      )}
      <MissingProducts
        items={items.filter(noProductRecords)}
        expanded={!ranked.length && !unresolved.length}
      />
    </>
  );
}

type MetricRow = { item: ProductReadings; reading: Reading };

function MetricTable({ rows, label }: { rows: MetricRow[]; label: string }) {
  if (!rows.length) return null;
  return (
    <div className="usage-table-wrap" tabIndex={0} role="region" aria-label={label}>
      <table className="usage-table">
        <thead>
          <tr>
            {['产品 / 指标', '计量周期', '已用', '额度', '剩余 / 超出', '占比 / 状态'].map(
              (column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, reading }) => {
            const { view, observation, definition, included, quota, period, exceeded, balance } =
              reading;
            return (
              <tr key={view.id}>
                <th scope="row">
                  <Link to={productPath(item)} state={fromUsage}>
                    {item.product.name} <ArrowUpRight size={12} />
                  </Link>
                  <small>{definition.label}</small>
                </th>
                <td>{period}</td>
                <td>{quantity(observation.usage, definition.unit, true)}</td>
                <td>
                  {quantity(included, definition.unit, true)}
                  {definition.hardLimit && <small>平台上限</small>}
                </td>
                <td>
                  {exceeded && '超出 '}
                  {quantity(balance, definition.unit, true)}
                </td>
                <td data-level={quota.level}>
                  {quota.percent !== null ? (
                    <>
                      <b>{percentage(quota.percent)}</b>
                      <small>{readingStatus(reading)}</small>
                    </>
                  ) : (
                    readingStatus(reading)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UsageDetails({ items }: { items: ProductReadings[] }) {
  const rows = items.flatMap((item) => item.readings.map((reading) => ({ item, reading })));
  const available = rows.filter(({ reading }) => !noRecords(reading));
  const absent = rows.filter(({ reading }) => noRecords(reading));
  return (
    <>
      <MetricTable rows={available} label="指标读数与状态" />
      {absent.length > 0 && (
        <details className="usage-absent" open={available.length === 0 || undefined}>
          <summary>
            暂无记录的指标 <b>{absent.length}</b>
          </summary>
          <MetricTable rows={absent} label="暂无记录的指标明细" />
        </details>
      )}
    </>
  );
}

export function Usage() {
  const { snapshot, loading } = useDashboard();
  const { usageGroup, usageView, setUsageGroup, setUsageView } =
    useOutletContext<DashboardViewState>();
  const metrics = snapshot?.metrics;
  const { available } = useMemo(() => collectReadings(metrics ?? {}), [metrics]);
  if (!snapshot) return <ConnectionPanel title="产品用量" loading={loading} />;

  const groups: UsageGroup[] = [
    '全部',
    ...productGroups.filter((group) => available.some(({ product }) => product.group === group)),
  ];
  const group = groups.includes(usageGroup) ? usageGroup : '全部';
  const items =
    group === '全部' ? available : available.filter(({ product }) => product.group === group);
  const numberOfMetrics = items.reduce((total, { readings }) => total + readings.length, 0);
  return (
    <section aria-label="产品用量">
      <header className="page-heading usage-heading">
        <div>
          <h1>产品用量</h1>
          <p>{descriptions[usageView]}</p>
        </div>
        {available.length > 0 && (
          <div className="usage-modes" role="group" aria-label="显示方式">
            {modes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={usageView === id}
                onClick={() => setUsageView(id)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}
      </header>
      {available.length > 0 ? (
        <>
          <div className="usage-controls">
            <div className="usage-groups" role="group" aria-label="产品分类">
              {groups.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  aria-pressed={entry === group}
                  onClick={() => setUsageGroup(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>
            <span role="status">
              {items.length} 个产品 · {numberOfMetrics} 项指标
            </span>
          </div>
          {usageView === 'matrix' && <ProductMatrix items={items} />}
          {usageView === 'ranking' && <UsageRanking items={items} />}
          {usageView === 'metrics' && <UsageDetails items={items} />}
        </>
      ) : (
        <p className="empty-usage">当前没有可显示的用量，请检查连接后刷新。</p>
      )}
    </section>
  );
}
