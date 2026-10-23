import { useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import {
  Cloud,
  LayoutDashboard,
  Settings2,
  Menu,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { products } from '../../../shared/catalog';
import { useDashboard } from '../../app/DashboardProvider';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../ui/sheet';
import { ProductIcon } from './ProductIcon';
import { dateTime } from '../../lib/format';
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-cloud">
        <Cloud size={27} fill="currentColor" strokeWidth={1.6} />
      </span>
      <span>
        Cloudflare <strong>Pulse</strong>
        <small>用量与费用监控</small>
      </span>
    </Link>
  );
}
export function Shell() {
  const [open, setOpen] = useState(false);
  const { snapshot, settings, refreshing, refresh, error, demo } = useDashboard();
  const location = useLocation();
  const nav = (
    <>
      <Brand />
      <nav className="main-nav" aria-label="产品导航">
        <NavLink to="/" end onClick={() => setOpen(false)}>
          <LayoutDashboard size={18} />
          <span>使用总览</span>
        </NavLink>
        {(['Workers Paid', 'AI 与媒体', '网络与订阅'] as const).map((group) => (
          <div className="nav-group" key={group}>
            <p>{group}</p>
            {products
              .filter((p) => p.group === group)
              .map((p) => (
                <NavLink key={p.id} to={'/products/' + p.id} onClick={() => setOpen(false)}>
                  <ProductIcon product={p} small />
                  <span>{p.name}</span>
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
      <div className="nav-footer">
        <NavLink to="/settings" onClick={() => setOpen(false)}>
          <Settings2 size={18} />
          <span>Token 与设置</span>
        </NavLink>
        <div className="local-status">
          <span className="status-dot" />
          本地预览 <span>尚未部署</span>
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">{nav}</aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-menu">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="打开产品导航">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="mobile-sidebar">
                <SheetTitle className="sr-only">产品导航</SheetTitle>
                {nav}
              </SheetContent>
            </Sheet>
          </div>
          <div className="breadcrumb">
            <span>工作空间</span>
            <span>/</span>
            <strong>
              {location.pathname === '/settings'
                ? 'Token 与设置'
                : (products.find((p) => location.pathname.endsWith('/' + p.id))?.name ??
                  '使用总览')}
            </strong>
          </div>
          <div className="topbar-right">
            {demo ? (
              <span className="demo-label">演示数据 · 不保存</span>
            ) : (
              <span className="account-dot">
                <span className="status-dot" />
                {settings?.account?.name ?? '等待连接账户'}
              </span>
            )}
            <a
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="打开 Cloudflare 控制台"
            >
              <ArrowUpRight size={18} />
            </a>
          </div>
        </header>
        <main id="main-content">
          <div className="page-tools">
            <div className="updated">
              <span className={`status-dot ${refreshing ? 'pulse' : ''}`} />
              {refreshing
                ? '正在读取最新用量…'
                : snapshot
                  ? `最近更新 ${dateTime(snapshot.attemptedAt)}`
                  : '连接你的 Cloudflare 账户'}
            </div>
            <Button
              className="refresh-button"
              disabled={refreshing || !settings?.account}
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? '刷新中' : '立即刷新'}</span>
            </Button>
          </div>
          {error ? (
            <div role="alert" className="error-banner">
              <AlertCircle size={17} />
              <span>{error}。下方保留上次结果，尚未更新。</span>
            </div>
          ) : null}
          {snapshot?.warnings.length ? (
            <div role="status" className="error-banner">
              <AlertCircle size={17} />
              <span>{snapshot.warnings.slice(0, 3).join('；')}</span>
            </div>
          ) : null}
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>
            <ShieldCheck size={14} />
            只读访问 · 仅打开与手动刷新
          </span>
          <span>USD · 北京时间（UTC+8）</span>
        </footer>
      </div>
    </div>
  );
}
