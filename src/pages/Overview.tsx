import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Wallet,
  Activity,
  CircleAlert,
  Cloud,
  Clock3,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { products } from '../../shared/catalog';
import { visibleMetrics, visibleProducts } from '../../shared/visibility';
import type { MetricView, Product, QuotaDisplay } from '../../shared/dashboard';
import { useDashboard } from '../app/DashboardProvider';
import {
  date,
  dateTime,
  money,
  compact,
  quotaFor,
  displayObservation,
  statusLabel,
  addAmounts,
  billingCycleDays,
  percentage,
  periodLabel,
} from '../lib/format';
import { MetricPanel } from '../components/quota/MetricPanel';
import { AnimatedValue } from '../components/quota/AnimatedValue';
import { ProductIcon } from '../components/layout/ProductIcon';
import { Button } from '../components/ui/button';

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
const productsById = new Map(products.map((product) => [product.id, product]));
const risk = { normal: 0, unknown: 0, warning: 1, danger: 2, exceeded: 3 };
type Reading = { view: MetricView; quota: QuotaDisplay };

function ProductReading({
  product,
  meters,
  index,
}: {
  product: Product;
  meters: Reading[];
  index: number;
}) {
  const firstWithUsage = meters.find(({ view }) => displayObservation(view).usage !== null);
  const primary = meters.reduce(
    (best, reading) =>
      Number(reading.quota.percent ?? -1) > Number(best?.quota.percent ?? -1) ? reading : best,
    firstWithUsage ?? meters[0],
  );
  const observation = primary && displayObservation(primary.view);
  const definition = primary?.view.definition;
  const quota = primary?.quota;
  const percent = quota?.percent ?? null;
  const exceeded = Number(quota?.excess ?? 0) > 0;
  const balance = (exceeded ? quota?.excess : quota?.remaining) ?? null;
  const status = primary ? statusLabel(primary.view, quota?.level) : '等待获取';
  const displayStatus = primary?.view.current.status === 'error' || balance === null;
  return (
    <Link
      className="product-row"
      to={'/products/' + product.id}
      style={{ '--row-delay': `${Math.min(index, 8) * 26}ms` } as CSSProperties}
    >
      <ProductIcon product={product} />
      <div className="product-name">
        <strong>{product.name}</strong>
        <small>
          {product.description} · {meters.length} 项
        </small>
      </div>
      <div className="product-reading" data-level={quota?.level}>
        <strong>
          <AnimatedValue
            value={percent === null ? compact(observation?.usage) : percentage(percent)}
          />
          {percent === null && observation?.usage != null ? (
            <span className="product-reading-unit">{definition?.unit}</span>
          ) : null}
        </strong>
        <small>
          {definition && observation
            ? `${definition.label} · ${periodLabel[observation.period.kind]}`
            : status}
        </small>
        {percent !== null && definition && observation ? (
          <small className="product-usage-amount">
            <AnimatedValue
              value={`${compact(observation.usage)} / ${compact(observation.included ?? definition.included)} ${definition.unit}`}
            />
          </small>
        ) : null}
      </div>
      <div className="product-remaining">
        {balance === null ? null : (
          <>
            <small>{exceeded ? '超出' : '剩余'}</small>
            <strong>
              <AnimatedValue value={compact(balance)} /> {definition?.unit}
            </strong>
          </>
        )}
        {displayStatus ? <small className="product-reading-status">{status}</small> : null}
      </div>
      <ChevronRight size={16} />
    </Link>
  );
}

export function Overview() {
  const { snapshot, settings, loading } = useDashboard(),
    [group, setGroup] = useState('Workers Paid');
  if (!snapshot)
    return (
      <>
        <div className="page-heading">
          <h1>
            使用总览<span className="heading-dot">.</span>
          </h1>
          <p>掌握每一份额度，让费用保持可控。</p>
        </div>
        <div className="connect-panel">
          <div className="connect-cloud">
            <Cloud size={52} />
          </div>
          <h2>{loading ? '正在连接工作空间' : '从连接你的账户开始'}</h2>
          <p>
            {loading
              ? '读取保存的配置与最新用量…'
              : '在设置中保存只读 Token，即可查看当前账期用量、剩余额度和费用。'}
          </p>
          <Button asChild>
            <Link to="/settings">
              配置 API Token
              <ArrowRight size={16} />
            </Link>
          </Button>
          {import.meta.env.DEV ? (
            <Link className="demo-link" to="/?demo=normal" reloadDocument>
              先查看演示页面
            </Link>
          ) : null}
        </div>
      </>
    );
  const all = visibleMetrics(snapshot.metrics);
  const readings = all.map((view): Reading => ({ view, quota: quotaFor(view) }));
  const readingsById = new Map(readings.map((entry) => [entry.view.id, entry]));
  const readingsByProduct = new Map<string, Reading[]>();
  for (const entry of readings) {
    const id = entry.view.definition.productId;
    const list = readingsByProduct.get(id);
    if (list) list.push(entry);
    else readingsByProduct.set(id, [entry]);
  }
  const availableProducts = visibleProducts(products, snapshot.metrics);
  const groups = ['Workers Paid', 'AI 与媒体', '网络与订阅'].filter((g) =>
    availableProducts.some((p) => p.group === g),
  );
  const activeGroup = groups.includes(group) ? group : groups[0];
  const attention = readings
    .filter(({ quota }) => risk[quota.level] > 0)
    .sort(
      (a, b) =>
        risk[b.quota.level] - risk[a.quota.level] ||
        Number(b.quota.percent) - Number(a.quota.percent),
    )
    .map(({ view }) => view);
  const featured = featuredMetricIds.flatMap((id) => {
    const entry = readingsById.get(id);
    return entry && displayObservation(entry.view).usage !== null ? [entry.view] : [];
  });
  const cores = Array.from(
    new Set([
      ...attention,
      ...featured,
      ...readings.filter(({ quota }) => quota.percent !== null).map(({ view }) => view),
    ]),
  ).slice(0, 6);
  const errors = all.filter((v) => v.current.status === 'error').length;
  const activeProducts = availableProducts.filter((product) => product.group === activeGroup);
  const cycle = billingCycleDays(snapshot.billingPeriod, snapshot.attemptedAt);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            使用总览<span className="heading-dot">.</span>
          </h1>
          <p>掌握每一份额度，让费用保持可控。</p>
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
            <AnimatedValue value={all.length} />
            <em>项</em>
          </strong>
          <small>{availableProducts.length} 个产品与服务</small>
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
              .map((v) => v.definition.label)
              .slice(0, 3)
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
        <div className="overview-main">
          {cores.length ? (
            <section className="panel core-panel">
              <div className="section-heading">
                <div>
                  <h2>核心资源额度</h2>
                  <p>每格 1% · 按各自周期计量</p>
                </div>
                <span className="section-hint">{cores.length} 项 · 预警优先</span>
              </div>
              <div className="core-metrics">
                {cores.map((view) => {
                  const product = productsById.get(view.definition.productId);
                  return (
                    <MetricPanel
                      key={view.id}
                      view={view}
                      label={
                        product ? `${product.name} ${view.definition.label}` : view.definition.label
                      }
                      color={view.id === 'worker_standard_cpu_ms' ? '#18a38c' : product?.color}
                      compactMode
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
          <section className="panel products-panel">
            <div className="section-heading">
              <div>
                <h2>产品用量</h2>
                <p>主要用量、剩余额度与数据状态</p>
              </div>
            </div>
            <div className="product-tabs" role="group" aria-label="产品分类">
              {groups.map((g) => (
                <button
                  type="button"
                  aria-pressed={activeGroup === g}
                  key={g}
                  onClick={() => setGroup(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="product-list" key={activeGroup}>
              {activeProducts.map((product, index) => (
                <ProductReading
                  key={product.id}
                  product={product}
                  meters={readingsByProduct.get(product.id) ?? []}
                  index={index}
                />
              ))}
              {!availableProducts.length ? (
                <p className="panel-description">当前没有可显示的用量，请检查连接后刷新。</p>
              ) : null}
            </div>
          </section>
        </div>
        <aside className="overview-aside">
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
                <AnimatedValue value={all.filter((v) => v.current.status === 'ok').length} />
                <small>项已读取用量</small>
              </span>
            </div>
            <div className="data-status-row">
              <span>暂无使用记录</span>
              <strong>
                <AnimatedValue
                  value={all.filter((v) => v.current.status === 'no_records').length}
                />
              </strong>
            </div>
            <div className="data-status-row">
              <span>范围或单位待核实</span>
              <strong>
                <AnimatedValue value={all.filter((v) => v.current.status === 'partial').length} />
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
        </aside>
      </div>
    </>
  );
}
