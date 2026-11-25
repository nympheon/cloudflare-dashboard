import { useEffect, useRef, useState } from 'react';
import { Link, matchPath, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { products } from '../../../shared/catalog';
import { visibleProducts } from '../../../shared/visibility';
import type { Product } from '../../../shared/dashboard';
import { useDashboard } from '../../app/DashboardProvider';
import { dateTime } from '../../lib/format';
import { productGroups } from '../../lib/readings';
import { ProductIcon } from './ProductIcon';
import { Button } from '../ui/button';

export type UsageView = 'matrix' | 'ranking' | 'metrics';
export type UsageGroup = '全部' | Product['group'];
export type DashboardViewState = {
  selectedMetric: string | null;
  setSelectedMetric: (id: string) => void;
  usageView: UsageView;
  setUsageView: (view: UsageView) => void;
  usageGroup: UsageGroup;
  setUsageGroup: (group: UsageGroup) => void;
};

export function Shell() {
  const { snapshot, settings, refreshing, refresh, error, demo } = useDashboard();
  const location = useLocation();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [usageView, setUsageView] = useState<UsageView>('matrix');
  const [usageGroup, setUsageGroup] = useState<UsageGroup>('全部');
  const directoryTrigger = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const available = snapshot ? visibleProducts(products, snapshot.metrics) : [];
  const onSettings = !!matchPath('/settings', location.pathname);
  const onUsage = !!matchPath('/usage', location.pathname);
  const productMatch = matchPath('/products/:productId', location.pathname);
  const product =
    productMatch && products.find((entry) => entry.id === productMatch.params.productId);
  const fromUsage = !!productMatch && location.state?.from === '/usage';
  const title = onSettings
    ? 'Token 与设置'
    : onUsage
      ? '产品用量'
      : productMatch
        ? (product?.name ?? '产品详情')
        : '使用总览';

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    setDirectoryOpen(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && directoryOpen) {
          setDirectoryOpen(false);
          directoryTrigger.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="workspace-header">
        <div className="wordmark">
          <Link to="/" className="brand" aria-label="Cloudflare Pulse 首页">
            Cloudflare <b>Pulse</b>
          </Link>
          <nav className="page-switch" aria-label="页面切换">
            <Link
              to="/"
              aria-current={title === '使用总览' ? 'page' : undefined}
              data-active={!onUsage && !fromUsage && !onSettings}
            >
              使用总览
            </Link>
            <Link
              to="/usage"
              aria-current={onUsage ? 'page' : undefined}
              data-active={onUsage || fromUsage}
            >
              产品用量
            </Link>
          </nav>
        </div>
        <div className="utilities">
          <button
            type="button"
            ref={directoryTrigger}
            className="utility"
            aria-expanded={directoryOpen}
            aria-controls="product-directory"
            onClick={() => setDirectoryOpen((open) => !open)}
          >
            产品目录 <ChevronDown size={14} />
          </button>
          <Link to="/settings" className="utility" aria-current={onSettings ? 'page' : undefined}>
            <Settings2 size={14} /> Token 与设置
          </Link>
          <a
            className="utility dashboard-link"
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <nav
        id="product-directory"
        className="product-directory"
        aria-label="产品目录"
        hidden={!directoryOpen}
      >
        {productGroups.map((group) => {
          const entries = available.filter((entry) => entry.group === group);
          return (
            entries.length > 0 && (
              <div key={group}>
                <h2>{group}</h2>
                <ul>
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        to={'/products/' + entry.id}
                        state={{ from: onUsage || fromUsage ? '/usage' : '/' }}
                        aria-current={entry.id === product?.id ? 'page' : undefined}
                        onClick={() => {
                          setDirectoryOpen(false);
                          if (entry.id === product?.id) directoryTrigger.current?.focus();
                        }}
                      >
                        <ProductIcon product={entry} small /> {entry.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          );
        })}
        {!available.length && <p>当前没有可显示的产品。</p>}
      </nav>
      <div className="page-tools">
        <div className="workspace-context">
          <span>工作空间 / {title}</span>
          {demo ? (
            <span className="demo-label">演示数据 · 不保存</span>
          ) : (
            <span>{settings?.account?.name ?? '等待连接账户'}</span>
          )}
        </div>
        <div className="refresh-tools">
          <span className="updated" role="status">
            <span className={refreshing ? 'status-dot pulse' : 'status-dot'} />
            {refreshing
              ? '正在读取最新用量…'
              : snapshot
                ? '最近更新 ' + dateTime(snapshot.attemptedAt)
                : '连接你的 Cloudflare 账户'}
          </span>
          <Button
            size="sm"
            className="refresh-button"
            disabled={refreshing || !settings?.account}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : undefined} />
            {refreshing ? '刷新中' : '立即刷新'}
          </Button>
        </div>
      </div>
      <main id="main-content" ref={main} tabIndex={-1}>
        {error && (
          <div role="alert" className="error-banner">
            <CircleAlert size={17} />
            <span>
              {error}
              {snapshot ? '。下方保留上次结果，尚未更新。' : ''}
            </span>
          </div>
        )}
        {!!snapshot?.warnings.length && (
          <div role="status" className="error-banner">
            <CircleAlert size={17} />
            <span>{snapshot.warnings.slice(0, 3).join('。')}</span>
          </div>
        )}
        <Outlet
          context={
            {
              selectedMetric,
              setSelectedMetric,
              usageView,
              setUsageView,
              usageGroup,
              setUsageGroup,
            } satisfies DashboardViewState
          }
        />
      </main>
      <footer className="page-footer">
        <span>
          <ShieldCheck size={14} /> 只读访问 · 仅打开与手动刷新
        </span>
        <span>
          {import.meta.env.DEV ? '本地预览 · 尚未部署' : '云端服务 · 运行中'} · USD ·
          北京时间（UTC+8）
        </span>
      </footer>
    </div>
  );
}
