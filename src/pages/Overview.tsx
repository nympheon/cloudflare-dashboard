import { useState } from 'react';
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
import { useDashboard } from '../app/DashboardProvider';
import {
  date,
  money,
  compact,
  quotaFor,
  displayObservation,
  statusLabel,
  addAmounts,
} from '../lib/format';
import { MetricPanel } from '../components/quota/MetricPanel';
import { ProductIcon } from '../components/layout/ProductIcon';
import { Button } from '../components/ui/button';
export function Overview() {
  const { snapshot, settings, loading, demo } = useDashboard(),
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
  const all = Object.values(snapshot.metrics).filter((v) => v.capability.visibility === 'visible');
  const attention = all.filter((v) =>
    ['warning', 'danger', 'exceeded'].includes(quotaFor(v).level),
  );
  const errors = all.filter((v) => v.current.status === 'error');
  const cores = ['worker_standard_request', 'worker_standard_cpu_ms', 'd1_rows_written']
    .map((id) => snapshot.metrics[id])
    .filter(Boolean)
    .map((v) => ({
      ...v,
      definition: {
        ...v.definition,
        label: (v.definition.productId === 'd1' ? 'D1 ' : 'Workers ') + v.definition.label,
      },
    }));
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
      </div>
      <section className="summary-strip" aria-label="账户摘要">
        <div>
          <span>
            <Wallet size={15} />
            固定订阅费
          </span>
          <strong>{money(snapshot.costs.fixed)}</strong>
          <small>同一订阅账期</small>
        </div>
        <div>
          <span>
            <Activity size={15} />
            已知用量费用
          </span>
          <strong>{money(addAmounts(snapshot.costs.reported, snapshot.costs.estimated))}</strong>
          <small>{snapshot.costs.complete ? '已覆盖计价项' : '部分覆盖 · 含估算'}</small>
        </div>
        <div>
          <span>
            <Layers size={15} />
            可见指标
          </span>
          <strong>
            {all.length}
            <em>项</em>
          </strong>
          <small>{products.length} 个产品与服务</small>
        </div>
        <div>
          <span>
            <CircleAlert size={15} />
            额度预警
          </span>
          <strong className={attention.length ? 'text-orange' : ''}>
            {attention.length}
            <em>项</em>
          </strong>
          <small>{errors.length ? `${errors.length} 项读取失败` : '仅针对已取得完整数据'}</small>
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
          <section className="panel core-panel">
            <div className="section-heading">
              <div>
                <h2>核心资源额度</h2>
                <p>当前用量与包含额度，一目了然</p>
              </div>
              <span className="section-hint">按指标独立计量</span>
            </div>
            <div className="core-metrics">
              {cores.map((v, i) => (
                <MetricPanel
                  key={v.id}
                  view={v}
                  color={['#f38020', '#18a38c', '#388bea'][i]}
                  compactMode
                />
              ))}
            </div>
          </section>
          <section className="panel products-panel">
            <div className="section-heading">
              <div>
                <h2>产品用量</h2>
                <p>进入产品，查看每一项额度与费用</p>
              </div>
            </div>
            <div className="product-tabs" role="group" aria-label="产品分类">
              {['Workers Paid', 'AI 与媒体', '网络与订阅'].map((g) => (
                <button aria-pressed={group === g} key={g} onClick={() => setGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
            <div className="product-list">
              {products
                .filter((p) => p.group === group)
                .map((p) => {
                  const meters = all.filter((v) => v.definition.productId === p.id),
                    primary = meters.find((v) => quotaFor(v).percent !== null) ?? meters[0],
                    q = primary ? quotaFor(primary) : null,
                    o = primary ? displayObservation(primary) : null;
                  return (
                    <Link className="product-row" key={p.id} to={'/products/' + p.id}>
                      <ProductIcon product={p} />
                      <div className="product-name">
                        <strong>{p.name}</strong>
                        <small>{p.description}</small>
                      </div>
                      <div className="product-progress">
                        {q?.percent !== null && q?.percent !== undefined ? (
                          <>
                            <div className="progress-track">
                              <i
                                style={{
                                  width: Math.min(100, Number(q.percent)) + '%',
                                  background: q.level === 'exceeded' ? '#df5353' : p.color,
                                }}
                              />
                            </div>
                            <span>
                              {compact(o?.usage)} / {compact(primary.definition.included)}{' '}
                              {primary.definition.unit}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="progress-track unknown-track" />
                            <span>{primary ? statusLabel(primary) : '等待获取'}</span>
                          </>
                        )}
                      </div>
                      <div className="product-remaining">
                        <small>
                          {q?.remaining !== null && q?.remaining !== undefined
                            ? '剩余'
                            : '数据状态'}
                        </small>
                        <strong>
                          {q?.remaining !== null && q?.remaining !== undefined
                            ? compact(q.remaining)
                            : primary
                              ? statusLabel(primary)
                              : '待核实'}
                        </strong>
                      </div>
                      <ChevronRight size={16} />
                    </Link>
                  );
                })}
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
                <dd>{money(snapshot.costs.fixed)}</dd>
              </div>
              <div>
                <dt>已报告用量费</dt>
                <dd>{money(snapshot.costs.reported)}</dd>
              </div>
              <div>
                <dt>未入账费用估算</dt>
                <dd>{money(snapshot.costs.estimated)}</dd>
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
                {money(
                  addAmounts(
                    snapshot.costs.fixed,
                    snapshot.costs.reported,
                    snapshot.costs.estimated,
                  ),
                )}
              </strong>
            </div>
            <div className="cost-note">
              <CircleAlert size={15} />
              <span>
                {snapshot.costs.unpriced}{' '}
                项计费范围待核实。合计不代表最终账单，税费、折扣与未计价项未包含。
              </span>
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
                {all.filter((v) => v.current.status === 'ok').length}
                <small>项已读取用量</small>
              </span>
            </div>
            <div className="data-status-row">
              <span>暂无使用记录</span>
              <strong>{all.filter((v) => v.current.status === 'no_records').length}</strong>
            </div>
            <div className="data-status-row">
              <span>范围或单位待核实</span>
              <strong>{all.filter((v) => v.current.status === 'partial').length}</strong>
            </div>
            <div className="data-status-row">
              <span>读取失败</span>
              <strong>{errors.length}</strong>
            </div>
            <p>临时失败会保留卡片与上次成功值，不会被当作 0。</p>
          </section>
          <div className="refresh-note">
            <RefreshNoteIcon />
            <h3>按需更新，轻量运行</h3>
            <p>打开页面时刷新一次。需要最新数据时，点击「立即刷新」。</p>
            <span>{demo ? '当前为独立演示环境' : '无定时采集 · 无历史存储'}</span>
          </div>
        </aside>
      </div>
    </>
  );
}
function RefreshNoteIcon() {
  return (
    <span className="refresh-note-icon">
      <Clock3 size={19} />
    </span>
  );
}
