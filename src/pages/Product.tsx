import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Info } from 'lucide-react';
import { products } from '../../shared/catalog';
import { visibleMetrics } from '../../shared/visibility';
import { useDashboard } from '../app/DashboardProvider';
import { MetricPanel } from '../components/quota/MetricPanel';
import { ProductIcon } from '../components/layout/ProductIcon';
import { dateTime, date, money } from '../lib/format';
export function Product() {
  const { productId } = useParams(),
    { snapshot } = useDashboard(),
    product = products.find((p) => p.id === productId);
  if (!product)
    return (
      <div className="connect-panel">
        <h1>产品不存在</h1>
        <Link to="/">返回总览</Link>
      </div>
    );
  const views = visibleMetrics(snapshot?.metrics ?? {}).filter(
    (v) => v.definition.productId === product.id,
  );
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={14} />
        返回总览
      </Link>
      <div className="page-heading product-heading">
        <div className="product-title">
          <ProductIcon product={product} />
          <div>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
          </div>
        </div>
        <a href={product.source} target="_blank" rel="noreferrer" className="text-link">
          官方计费说明
          <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="product-meta">
        <span>
          订阅账期{' '}
          <strong>
            {date(snapshot?.billingPeriod.start)} — {date(snapshot?.billingPeriod.end)}
          </strong>
        </span>
        <span>更新于 {dateTime(snapshot?.attemptedAt)}</span>
      </div>
      {views.length ? (
        <>
          <div className="metric-grid">
            {views.map((v) => (
              <MetricPanel key={v.id} view={v} color={product.color} />
            ))}
          </div>
          <section className="panel source-explanation">
            <h2>
              <Info size={17} />
              数据与计费口径
            </h2>
            <p>
              每个指标遵循各自周期。当前容量与 GB-month 计费用量分开；暂无记录不代表明确为
              0，范围不足的结果不用于完整费用估算。
            </p>
            {views
              .filter((v) => v.definition.note)
              .map((v) => (
                <p key={v.id}>
                  <strong>{v.definition.label}：</strong>
                  {v.definition.note}
                </p>
              ))}
          </section>
          {['subscriptions', 'network', 'zero-trust'].includes(product.id) ? (
            <section className="panel subscriptions-panel">
              <h2>当前账户订阅</h2>
              <div className="subscription-table">
                {snapshot?.subscriptions.map((s) => (
                  <div key={s.id}>
                    <div>
                      <strong>{s.name}</strong>
                      <small>
                        {s.planId} · {s.state}
                      </small>
                    </div>
                    <span>
                      {money(s.price)}
                      <small>
                        {' '}
                        /{' '}
                        {s.frequency === 'monthly'
                          ? '月'
                          : s.frequency === 'yearly'
                            ? '年'
                            : s.frequency}
                      </small>
                    </span>
                    <span>{s.start ? `${date(s.start)} — ${date(s.end)}` : '无固定账期'}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="connect-panel">
          <h2>{snapshot ? '此产品暂无可显示的用量' : '等待连接账户'}</h2>
          <p>
            {snapshot
              ? '获取到可靠数据后，产品会自动出现在用量列表中。'
              : '保存 Token 并刷新后，这里会显示产品的独立计量指标。'}
          </p>
          <Link to={snapshot ? '/' : '/settings'} className="text-link">
            {snapshot ? '返回总览' : '配置 Token'}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}
