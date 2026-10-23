import Decimal from 'decimal.js';
import type {
  CapabilityDecision,
  DashboardSnapshot,
  Observation,
  RefreshReason,
} from '../shared/dashboard';
import { Repository, RevisionConflict } from './storage/repository';
import { clientsFor } from './settings/service';
import { normalizeSubscriptions, aggregateBillable } from './cloudflare/adapters/billing';
import { resolveDefinitions } from './cloudflare/discovery';
import { collectDataset, datasets, boundedMap } from './cloudflare/adapters/analytics';
import { collectAccount } from './cloudflare/adapters/account';
import { periodFor } from './metrics/periods';
import { mergeMetric } from './metrics/state';
import { costParts } from './billing/calculate';
import { arr, obj } from './cloudflare/json';
import { ReadSources } from './cloudflare/sources';
import { isMetricVisible } from '../shared/visibility';

export async function refreshDashboard(
  reason: RefreshReason,
  env: Env,
  repo = new Repository(env.DB),
): Promise<DashboardSnapshot> {
  if (reason !== 'open' && reason !== 'manual') throw new Error('仅支持打开页面或手动刷新');
  const nonce = crypto.randomUUID();
  if (!(await repo.acquireRefresh(nonce))) {
    const [latest, settings] = await Promise.all([repo.snapshot(), repo.settings()]);
    if (latest && latest.settingsRevision === settings.revision)
      return {
        ...latest,
        warnings: [
          ...latest.warnings,
          '另一个页面正在刷新，本次复用已保存结果；稍后可手动获取最新结果',
        ],
      };
    throw new RevisionConflict();
  }
  let saved = false;
  try {
    const result = await performRefresh(env, repo, nonce);
    saved = true;
    return result;
  } finally {
    if (!saved) await repo.releaseRefresh(nonce);
  }
}
async function performRefresh(
  env: Env,
  repo: Repository,
  nonce: string,
): Promise<DashboardSnapshot> {
  const started = performance.now(),
    now = new Date(),
    at = now.toISOString();
  const [settings, storedPrevious] = await Promise.all([repo.settings(), repo.snapshot()]);
  if (!settings.account || !Object.keys(settings.credentials).length)
    throw new Error('请先在设置中保存只读 API Token');
  const previous = storedPrevious?.account.id === settings.account.id ? storedPrevious : null;
  const clients = await clientsFor(settings, env.TOKEN_ENCRYPTION_KEY),
    client = new ReadSources(clients);
  const root = `/accounts/${settings.account.id}`,
    warnings: string[] = [];
  let subscriptions = previous?.subscriptions ?? [],
    subscriptionsVerified = false;
  try {
    subscriptions = normalizeSubscriptions(await client.list(root + '/subscriptions')).filter(
      (s) => !['Cancelled', 'Expired', 'Failed'].includes(s.state),
    );
    subscriptionsVerified = true;
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : '订阅读取失败');
  }
  const active = subscriptions.find(
    (s) =>
      s.planId === 'workers_paid' &&
      s.start &&
      s.end &&
      new Date(s.start) <= now &&
      new Date(s.end) > now,
  );
  const cycle = active?.start && active.end ? { start: active.start, end: active.end } : undefined;
  const definitions = resolveDefinitions(subscriptions),
    context = {
      accountId: settings.account.id,
      clients,
      now,
      cycle,
      paidSince: active?.effectiveAt ?? undefined,
    };
  const observations: Record<string, Observation> = {};
  const billablePromise = (async () => {
    if (!cycle) {
      warnings.push('未取得可靠的当前订阅账期，账期相关用量暂不计算');
      return {};
    }
    try {
      const r = await client.get(
        root + `/billable-usage?from=${cycle.start.slice(0, 10)}&to=${at.slice(0, 10)}`,
      );
      if (!Array.isArray(r)) throw new Error('账单来源响应不完整');
      return aggregateBillable(r, periodFor('billing_cycle', now, cycle).start!);
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : '账单来源读取失败');
      return {};
    }
  })();
  const [analytics, account, billing] = await Promise.all([
    boundedMap(datasets, 4, (d) => collectDataset(d, context, definitions)),
    collectAccount(context, definitions, subscriptions, subscriptionsVerified),
    billablePromise,
  ]);
  for (const results of analytics) Object.assign(observations, results);
  Object.assign(observations, account);
  const unmatched = Object.entries(billing).filter(([id]) => id.startsWith('billing_'));
  const blockedProducts = new Set(unmatched.map(([, value]) => value.productId));
  if (unmatched.length)
    warnings.push('部分账单项目尚未匹配到用量指标；已计入报告金额，并暂停可能重叠的费用估算。');
  for (const [id, value] of Object.entries(billing)) {
    if (!definitions.some((d) => d.id === id))
      definitions.push({
        id,
        productId: value.productId ?? 'subscriptions',
        label: value.name,
        unit: value.unit || 'Count',
        period: 'billing_cycle',
        source: 'https://developers.cloudflare.com/api/resources/billing/',
      });
    const def = definitions.find((d) => d.id === id)!;
    const old = observations[id];
    const isLive = old?.coverage === 'complete' && old.status === 'ok' && old.usage !== null;
    observations[id] = {
      ...(isLive
        ? old
        : {
            usage: value.usage,
            status: 'partial',
            coverage: 'partial',
            period: periodFor(def.period, now, cycle),
            at,
            source: 'REST · billable-usage',
            message: '账单已入账部分，尚未覆盖到本次刷新时刻',
          }),
      reportedCost: value.currency === 'USD' ? value.cost : undefined,
      reportedUsage: value.usage,
      chargeCoverage: new Date(value.through) >= now ? 'complete' : 'partial',
      chargeThrough: value.through,
    };
  }
  let estimated = new Decimal(0),
    reported = new Decimal(0),
    dailyEstimated = new Decimal(0),
    unpriced = 0;
  const views: DashboardSnapshot['metrics'] = {};
  for (const definition of definitions) {
    const current = observations[definition.id] ?? {
      usage: null,
      status: 'partial',
      coverage: 'unverified',
      period: periodFor(definition.period, now, cycle),
      at,
      source: definition.source,
      message: '已登记此计费维度；可靠用量或单位来源待核实',
    };
    if (blockedProducts.has(undefined) || blockedProducts.has(definition.productId))
      current.estimationBlocked = true;
    const view = mergeMetric(
      definition,
      previous?.account.id === settings.account.id ? previous.metrics[definition.id] : undefined,
      current,
    );
    if (settings.capabilities[definition.id])
      view.capability = settings.capabilities[definition.id];
    view.capability = {
      ...view.capability,
      visibility: isMetricVisible(view) ? 'visible' : 'excluded',
      reason: isMetricVisible(view)
        ? '已取得用量、账单或同周期上次数据'
        : '尚无可靠用量，已从产品页面隐藏',
      checkedAt: at,
    };
    views[definition.id] = view;
    if (
      definition.period === 'instant' ||
      definition.id === 'platforms_subscription' ||
      current.status === 'not_enabled'
    )
      continue;
    const parts = costParts(
      current,
      subscriptionsVerified && active ? definition.pricing : undefined,
    );
    if (definition.period === 'day') {
      dailyEstimated = dailyEstimated.plus(parts.estimated);
      unpriced++;
      continue;
    }
    reported = reported.plus(parts.reported);
    estimated = estimated.plus(parts.estimated);
    if (parts.unpriced) unpriced++;
  }
  const cycleSubscriptions = subscriptions.filter(
    (s) =>
      s.currency === 'USD' &&
      s.start &&
      s.end &&
      cycle &&
      new Date(s.start).getTime() === new Date(cycle.start).getTime() &&
      new Date(s.end).getTime() === new Date(cycle.end).getTime(),
  );
  const fixed = cycleSubscriptions.reduce((v, s) => v.plus(s.price), new Decimal(0)).toString();
  const otherGroups: Record<string, Decimal> = {};
  for (const s of subscriptions)
    if (s.currency === 'USD' && !cycleSubscriptions.includes(s) && new Decimal(s.price).gt(0))
      otherGroups[s.frequency] = (otherGroups[s.frequency] ?? new Decimal(0)).plus(s.price);
  const fixedOther = Object.entries(otherGroups).map(([frequency, amount]) => ({
    frequency,
    amount: amount.toString(),
  }));
  if (fixedOther.length) unpriced++;
  if (!subscriptionsVerified) unpriced++;
  const snapshot: DashboardSnapshot = {
    revision: (storedPrevious?.revision ?? 0) + 1,
    settingsRevision: settings.revision,
    attemptedAt: at,
    succeededAt: Object.values(views).some((v) => v.current.status === 'ok')
      ? at
      : (previous?.succeededAt ?? null),
    account: settings.account,
    billingPeriod: periodFor('billing_cycle', now, cycle),
    subscriptions,
    metrics: views,
    costs: {
      fixed: subscriptionsVerified ? fixed : null,
      fixedOther,
      reported: reported.toString(),
      estimated: estimated.toString(),
      dailyEstimated: dailyEstimated.toString(),
      unpriced,
      complete: unpriced === 0,
      currency: 'USD',
      note: '已报告金额仅含已入账记录；估算仅补充尚未入账的用量，不重复汇总。同账期固定费单列，其他周期订阅和每日额度费用不混入本账期合计。',
    },
    warnings,
  };
  repo.diagnostics.apiCalls = Object.values(clients).reduce((n, c) => n + c.calls, 0);
  repo.diagnostics.elapsedMs = Math.round(performance.now() - started);
  try {
    await repo.saveSnapshot(snapshot, storedPrevious?.revision ?? 0, nonce);
  } catch (e) {
    if (!(e instanceof RevisionConflict)) throw e;
    const latest = await repo.snapshot();
    if (latest && latest.settingsRevision === settings.revision && latest.attemptedAt >= at)
      return latest;
    throw e;
  }
  return { ...snapshot, diagnostics: repo.diagnostics };
}
export async function recheckCapabilities(env: Env, repo = new Repository(env.DB)) {
  const settings = await repo.settings();
  if (!settings.account) throw new Error('请先保存 Token');
  const clients = await clientsFor(settings, env.TOKEN_ENCRYPTION_KEY),
    client = new ReadSources(clients);
  const query = `query { viewer { accounts(filter:{accountTag:${JSON.stringify(settings.account.id)}}) { settings { ${datasets.map((d) => `${d.name} { enabled maxDuration notOlderThan }`).join(' ')} } } } }`;
  const response = await client.query(query),
    accounts = arr(obj(response.viewer).accounts);
  const sourceSettings = obj(obj(accounts[0]).settings);
  if (!Object.keys(sourceSettings).length) throw new Error('能力核查响应不完整，保留此前清单');
  const decisions: Record<string, CapabilityDecision> = { ...settings.capabilities };
  for (const d of datasets)
    for (const id of d.ids) {
      const enabled = obj(sourceSettings[d.name]).enabled;
      decisions[id] = {
        visibility: 'visible',
        reason:
          enabled === true
            ? '统计来源已启用；常规刷新失败时仍保留'
            : enabled === false
              ? '统计来源暂不可用，替代来源仍待核查'
              : '来源能力待核实',
        checkedAt: new Date().toISOString(),
        evidence: `GraphQL settings · ${d.name}`,
      };
    }
  settings.capabilities = decisions;
  await repo.saveSettings(settings, settings.revision);
  return decisions;
}
