import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard } from '../../src/app/DashboardProvider';
import { Shell } from '../../src/components/layout/Shell';
import { Overview } from '../../src/pages/Overview';
import { Product } from '../../src/pages/Product';
import { demoSettings, demoSnapshot } from '../../src/demo';
import type { DashboardSnapshot, MetricView } from '../../shared/dashboard';

vi.mock('../../src/app/DashboardProvider', () => ({ useDashboard: vi.fn() }));

const unavailable = (v: MetricView): MetricView => ({
  ...v,
  current: { ...v.current, usage: null, status: 'partial', coverage: 'unverified' },
  lastSuccess: null,
});
function render(snapshot: DashboardSnapshot, path = '/') {
  vi.mocked(useDashboard).mockReturnValue({
    snapshot,
    settings: demoSettings,
    loading: false,
    refreshing: false,
    error: null,
    demo: true,
    refresh: vi.fn(),
    saveToken: vi.fn(),
    clearToken: vi.fn(),
    validateToken: vi.fn(),
    recheck: vi.fn(),
  });
  return renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: [path] },
      h(
        Routes,
        null,
        h(
          Route,
          { element: h(Shell) },
          h(Route, { index: true, element: h(Overview) }),
          h(Route, { path: '/products/:productId', element: h(Product) }),
        ),
      ),
    ),
  );
}
describe('available data in the rendered dashboard', () => {
  let snapshot: DashboardSnapshot;
  beforeEach(() => {
    snapshot = demoSnapshot('normal');
    const {
      worker_standard_request: request,
      worker_standard_cpu_ms: cpu,
      r2_storage: r2,
    } = snapshot.metrics;
    snapshot.metrics = {
      [request.id]: request,
      [cpu.id]: unavailable(cpu),
      [r2.id]: unavailable(r2),
    };
  });
  it('shows available products and removes unavailable core cards and navigation entries', () => {
    const html = render(snapshot);
    expect(html).toContain('href="/products/workers"');
    expect(html).not.toContain('href="/products/r2"');
    expect(html).toContain('Workers 请求次数');
    expect(html).not.toContain('Workers CPU 时间');
  });
  it('shows more measured quota cards and the current cycle countdown on the overview', () => {
    const full = demoSnapshot('normal');
    full.billingPeriod.start = '2026-11-06T00:00:00Z';
    full.billingPeriod.end = '2026-12-06T00:00:00Z';
    full.attemptedAt = '2026-11-24T00:00:00Z';
    const html = render(full);
    expect(html).toContain('D1 读取行数');
    expect(html).toContain('Queues 消息操作');
    expect(html).toContain('每格 1%');
    expect(html).toContain('距账期结束');
    expect(html).toContain('12 天');
  });
  it('prioritizes an at-risk meter and preserves its actual percentage above the grid maximum', () => {
    const full = demoSnapshot('normal');
    full.metrics.queues_standard_operations.current.usage = '1250000';
    const html = render(full);
    const core = html.slice(html.indexOf('核心资源额度'), html.indexOf('产品用量'));
    expect(core.indexOf('Queues 消息操作')).toBeLessThan(core.indexOf('Workers 请求次数'));
    expect(core).toContain('已使用 125%');
    expect(core).toContain('超出额度');
  });
  it('fills only a fraction of the first tile for a positive quota below one percent', () => {
    snapshot.metrics.worker_standard_request.current.usage = '92000';
    const html = render(snapshot);
    expect(html).toContain('已使用 0.92%');
    expect(html.match(/--cell-fill:0\.92(?:;|")/g)).toHaveLength(1);
  });
  it('filters unavailable metrics on a directly opened product page', () => {
    const html = render(snapshot, '/products/workers');
    expect(html).toContain('请求次数');
    expect(html).not.toContain('CPU 时间');
    const empty = render(snapshot, '/products/r2');
    expect(empty).toContain('此产品暂无可显示的用量');
    expect(empty).not.toContain('Standard 存储');
  });
  it('renders an empty result without showing the entire catalogue', () => {
    snapshot.metrics = Object.fromEntries(
      Object.entries(snapshot.metrics).map(([id, v]) => [id, unavailable(v)]),
    );
    const html = render(snapshot);
    expect(html).not.toContain('href="/products/');
    expect(html).not.toContain('核心资源额度');
  });
});
