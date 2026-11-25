import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Wallet,
  Activity,
  CircleAlert,
  Clock3,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useDashboard } from '../app/DashboardProvider';
import {
  date,
  dateTime,
  money,
  quantity,
  addAmounts,
  billingCycleDays,
  percentage,
} from '../lib/format';
import { collectReadings, quotaRisk, type ProductReadings } from '../lib/readings';
import { ConnectionPanel } from '../components/layout/ConnectionPanel';
import { QuotaDial } from '../components/quota/QuotaDial';
import { AnimatedValue } from '../components/quota/AnimatedValue';
import { ProductIcon } from '../components/layout/ProductIcon';

const featuredMetricIds = [
  'worker_standard_request',
  'worker_standard_cpu_ms',
  'd1_rows_written',
  'd1_rows_read',
  'r2_class_a_operations',
  'queues_standard_operations',
  'worker_kv_reads',
  'worker_durable_objects_requests',
];
function ProductSummary({ item }: { item: ProductReadings }) {
  const { product, readings, primary } = item;
  const { definition, observation, quota, included, balance, exceeded, period, status } = primary;
  const showStatus =
    balance === null || quotaRisk[quota.level] > 0 || primary.view.current.status !== 'ok';
  return (
    <Link className="product-summary" to={'/products/' + product.id}>
      <ProductIcon product={product} />
      <span className="product-summary-identity">
        <b>{product.name}</b>
        <small>
          {product.description} · {readings.length} 项
        </small>
      </span>
      <span className="product-summary-reading">
        <b data-level={quota.level}>
          {quota.percent === null
            ? quantity(observation.usage, definition.unit)
            : percentage(quota.percent)}
        </b>
        <small>
          {definition.label} · {period}
        </small>
      </span>
      <span className="product-summary-amount">
        <b>{quantity(observation.usage, definition.unit)}</b>
        <small>
          {included === undefined ? '额度待核实' : '额度 ' + quantity(included, definition.unit)}
        </small>
      </span>
      <span className="product-summary-balance">
        {balance !== null && (
          <b>
            {exceeded ? '超出 ' : '剩余 '}
            {quantity(balance, definition.unit)}
          </b>
        )}
        {showStatus && <small data-level={quota.level}>{status}</small>}
      </span>
      <ChevronRight size={16} />
    </Link>
  );
}

export function Overview() {
  const { snapshot, settings, loading } = useDashboard();
  const metrics = snapshot?.metrics;
  const { readings, available } = useMemo(() => collectReadings(metrics ?? {}), [metrics]);
  if (!snapshot) return <ConnectionPanel title="使用总览" loading={loading} />;

  const readingsById = new Map(readings.map((reading) => [reading.view.id, reading]));
  const attention = readings
    .filter(({ quota }) => quotaRisk[quota.level] > 0)
    .sort(
      (a, b) =>
        quotaRisk[b.quota.level] - quotaRisk[a.quota.level] ||
        Number(b.quota.percent ?? 0) - Number(a.quota.percent ?? 0),
    );
  const featured = featuredMetricIds.flatMap((id) => {
    const reading = readingsById.get(id);
    return reading && reading.observation.usage !== null ? [reading] : [];
  });
  const cores = [
    ...new Set([
      ...attention,
      ...featured.filter(({ quota }) => quota.percent !== null),
      ...readings.filter(({ quota }) => quota.percent !== null),
      ...featured,
    ]),
  ].slice(0, 6);
  const errors = readings.filter(({ view }) => view.current.status === 'error').length;
  const cycle = billingCycleDays(snapshot.billingPeriod, snapshot.attemptedAt);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>使用总览</h1>
        </div>
        <span className="plan-tag">
          <Layers size={14} />
          {snapshot.subscriptions.find((s) => s.planId === 'workers_paid')?.name ??
            'Cloudflare 账户'}
        </span>
      </div>
      <div className="account-strip">
        <span>
          <span className="account-avatar">{(settings?.account?.name ?? 'C').slice(0, 1)}</span>
          <strong>{snapshot.account.name}</strong>
        </span>
        <span className="billing-period">
          <Clock3 size={14} />
          <span>订阅账期</span>
          <strong>
            {date(snapshot.billingPeriod.start)} — {date(snapshot.billingPeriod.end)}
          </strong>
        </span>
        {cycle ? (
          <span className="cycle-countdown">
            <span>
              第 {cycle.current} / {cycle.total} 天
            </span>
            <span>
              距账期结束{' '}
              <strong>
                <AnimatedValue value={`${cycle.remaining} 天`} />
              </strong>
            </span>
          </span>
        ) : null}
      </div>
      <section className="summary-strip" aria-label="账户摘要">
        <div>
          <span>
            <Wallet size={15} />
            固定订阅费
          </span>
          <strong>
            <AnimatedValue value={money(snapshot.costs.fixed)} />
          </strong>
          <small>同一订阅账期</small>
        </div>
        <div>
          <span>
            <Activity size={15} />
            已知用量费用
          </span>
          <strong>
            <AnimatedValue
              value={money(addAmounts(snapshot.costs.reported, snapshot.costs.estimated))}
            />
          </strong>
          <small>{snapshot.costs.complete ? '已覆盖计价项' : '部分覆盖 · 含估算'}</small>
        </div>
        <div>
          <span>
            <Layers size={15} />
            可见指标
          </span>
          <strong>
            <AnimatedValue value={readings.length} />
            <em>项</em>
          </strong>
          <small>{available.length} 个产品与服务</small>
        </div>
        <div>
          <span>
            <CircleAlert size={15} />
            额度预警
          </span>
          <strong className={attention.length ? 'text-orange' : ''}>
            <AnimatedValue value={attention.length} />
            <em>项</em>
          </strong>
          <small>{errors ? `${errors} 项读取失败` : '仅针对已取得完整数据'}</small>
        </div>
      </section>
      {attention.length ? (
        <div className="warning-banner">
          <CircleAlert size={17} />
          <span>
            {attention
              .slice(0, 3)
              .map(({ definition }) => definition.label)
              .join('、')}{' '}
            接近或超过包含额度。
          </span>
          <Link to={'/products/' + attention[0].definition.productId}>
            查看详情
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}
      <div className="overview-columns">
        {cores.length ? (
          <section className="panel core-panel">
            <div className="section-heading">
              <div>
                <h2>核心资源额度</h2>
                <p>
                  {cores.some(({ quota }) => quota.percent !== null)
                    ? '各圈按本项额度计量 · 点选查看读数'
                    : '点选指标查看读数与数据状态'}
                </p>
              </div>
              <span className="section-hint">{cores.length} 项 · 预警优先</span>
            </div>
            <QuotaDial readings={cores} />
          </section>
        ) : null}
        <section className="panel cost-panel">
          <h2>费用构成</h2>
          <p className="panel-description">当前可确认的费用范围</p>
          <dl>
            <div>
              <dt>固定订阅费</dt>
              <dd>
                <AnimatedValue value={money(snapshot.costs.fixed)} />
              </dd>
            </div>
            <div>
              <dt>已报告用量费</dt>
              <dd>
                <AnimatedValue value={money(snapshot.costs.reported)} />
              </dd>
            </div>
            <div>
              <dt>未入账费用估算</dt>
              <dd>
                <AnimatedValue value={money(snapshot.costs.estimated)} />
              </dd>
            </div>
            {(snapshot.costs.fixedOther ?? []).map((f) => (
              <div key={f.frequency}>
                <dt>其他周期订阅（{f.frequency === 'yearly' ? '年' : f.frequency}）</dt>
                <dd>
                  {money(f.amount)}
                  <small> · 不计入合计</small>
                </dd>
              </div>
            ))}
            {Number(snapshot.costs.dailyEstimated ?? 0) > 0 ? (
              <div>
                <dt>今日 AI 估算（独立）</dt>
                <dd>{money(snapshot.costs.dailyEstimated)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="known-total">
            <span>已知费用合计</span>
            <strong>
              <AnimatedValue
                value={money(
                  addAmounts(
                    snapshot.costs.fixed,
                    snapshot.costs.reported,
                    snapshot.costs.estimated,
                  ),
                )}
              />
            </strong>
          </div>
          <div className="cost-note">
            <CircleAlert size={15} />
            <span>费用仅涵盖已取得的数据。合计不代表最终账单，税费、折扣与未计价项未包含。</span>
          </div>
          <a
            className="text-link"
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noreferrer"
          >
            前往账单中心
            <ArrowRight size={13} />
          </a>
        </section>
        <section className="panel data-panel">
          <h2>数据状态</h2>
          <div className="data-health">
            <CheckCircle2 size={20} />
            <span>
              <AnimatedValue
                value={readings.filter(({ view }) => view.current.status === 'ok').length}
              />
              <small>项已读取用量</small>
            </span>
          </div>
          <div className="data-status-row">
            <span>暂无使用记录</span>
            <strong>
              <AnimatedValue
                value={readings.filter(({ view }) => view.current.status === 'no_records').length}
              />
            </strong>
          </div>
          <div className="data-status-row">
            <span>范围或单位待核实</span>
            <strong>
              <AnimatedValue
                value={readings.filter(({ view }) => view.current.status === 'partial').length}
              />
            </strong>
          </div>
          <div className="data-status-row">
            <span>读取失败</span>
            <strong>
              <AnimatedValue value={errors} />
            </strong>
          </div>
          <div className="data-status-row">
            <span>未完整计价</span>
            <strong>
              <AnimatedValue value={snapshot.costs.unpriced} />
            </strong>
          </div>
          <div className="data-last-success">
            <Clock3 size={14} />
            <span>上次成功更新</span>
            <strong>{dateTime(snapshot.succeededAt)}</strong>
          </div>
        </section>
        <section className="panel products-panel">
          <div className="section-heading">
            <h2>产品速览</h2>
            {available.length > 0 && (
              <Link className="text-link" to="/usage">
                查看全部 {available.length} 个产品 <ArrowRight size={14} />
              </Link>
            )}
          </div>
          {available.length > 0 ? (
            <div className="product-list">
              {available.slice(0, 3).map((item) => (
                <ProductSummary key={item.product.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="panel-description">当前没有可显示的用量，请检查连接后刷新。</p>
          )}
        </section>
      </div>
    </>
  );
}
