import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard } from '../../src/app/DashboardProvider';
import { Shell } from '../../src/components/layout/Shell';
import { Overview } from '../../src/pages/Overview';
import { Product } from '../../src/pages/Product';
import { Usage } from '../../src/pages/Usage';
import { demoSettings, demoSnapshot } from '../../src/demo';
import type { DashboardSnapshot, MetricView } from '../../shared/dashboard';

vi.mock('../../src/app/DashboardProvider', () => ({ useDashboard: vi.fn() }));

const unavailable = (v: MetricView): MetricView => ({
  ...v,
  current: { ...v.current, usage: null, status: 'partial', coverage: 'unverified' },
  lastSuccess: null,
});
function render(snapshot: DashboardSnapshot, path = '/', fromUsage = false) {
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
      { initialEntries: [{ pathname: path, state: fromUsage ? { from: '/usage' } : null }] },
      h(
        Routes,
        null,
        h(
          Route,
          { element: h(Shell) },
          h(Route, { index: true, element: h(Overview) }),
          h(Route, { path: '/usage', element: h(Usage) }),
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
  it('shows the measured quotas together with the current cycle countdown and both page links', () => {
    const full = demoSnapshot('normal');
    full.billingPeriod.start = '2026-11-06T00:00:00Z';
    full.billingPeriod.end = '2026-12-06T00:00:00Z';
    full.attemptedAt = '2026-11-24T00:00:00Z';
    const html = render(full);
    expect(html).toContain('D1 读取行数');
    expect(html).toContain('Queues 消息操作');
    expect(html).toContain('各圈按本项额度计量');
    expect(html).toContain('href="/usage"');
    expect(html).toContain('产品速览');
    expect(html).toContain('距账期结束');
    expect(html).toContain('12 天');
  });
  it('prioritizes an at-risk meter and shows the real ratio on a full quota arc', () => {
    const full = demoSnapshot('normal');
    full.metrics.queues_standard_operations.current.usage = '1250000';
    const html = render(full);
    const core = html.slice(html.indexOf('核心资源额度'), html.indexOf('产品速览'));
    expect(core.indexOf('Queues 消息操作')).toBeLessThan(core.indexOf('Workers 请求次数'));
    expect(core).toContain('Queues 消息操作 125%');
    expect(core).toContain('stroke-dasharray="100 0"');
    expect(core).toContain('超出额度');
  });
  it('draws a proportional arc for a positive quota below one percent', () => {
    snapshot.metrics.worker_standard_request.current.usage = '92000';
    const html = render(snapshot);
    expect(html).toContain('Workers 请求次数 0.92%');
    expect(html).toContain('stroke-dasharray="0.92 99.08"');
  });
  it('selects measurable quotas when featured readings have only partial coverage', () => {
    const full = demoSnapshot('normal');
    for (const id of [
      'worker_standard_request',
      'worker_standard_cpu_ms',
      'd1_rows_written',
      'd1_rows_read',
      'r2_class_a_operations',
      'queues_standard_operations',
    ]) {
      const metric = full.metrics[id];
      metric.current = { ...metric.current, status: 'partial', coverage: 'partial' };
    }
    const html = render(full);
    expect(html).toContain('Vectorize 查询维度 30%');
    expect(html).toContain('aria-label="核心额度刻度"');
  });
  it('keeps the exact small-fraction fill on individual product pages', () => {
    snapshot.metrics.worker_standard_request.current.usage = '92000';
    const html = render(snapshot, '/products/workers');
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
  it('has a direct product usage route and only includes available products in its matrix', () => {
    const html = render(snapshot, '/usage');
    expect(html).toContain('aria-current="page" data-active="true" href="/usage"');
    expect(html).toContain('产品矩阵');
    expect(html).toContain('额度排行');
    expect(html).toContain('指标明细');
    expect(html).toContain('1 个产品');
    expect(html).not.toContain('href="/products/r2"');
  });
  it('returns to the page that opened the product', () => {
    expect(render(snapshot, '/products/workers', true)).toContain('返回产品用量');
    expect(render(snapshot, '/products/workers')).toContain('返回使用总览');
  });
  it('keeps the correct page selected when the usage path has a trailing slash', () => {
    expect(render(snapshot, '/usage/')).toContain(
      'aria-current="page" data-active="true" href="/usage"',
    );
  });
  it('identifies a stale secondary reading in the product matrix', () => {
    const full = demoSnapshot('normal');
    const cpu = full.metrics.worker_standard_cpu_ms;
    cpu.current = { ...cpu.current, status: 'error', usage: null };
    const html = render(full, '/usage');
    const secondary = html.slice(html.indexOf('usage-tile-secondary'));
    expect(secondary.split('</a>', 1)[0]).toContain('读取失败 · 保留上次数据');
    expect(secondary.split('</a>', 1)[0]).toContain('数据时间');
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
