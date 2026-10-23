import type { MetricDefinition, Observation, Subscription } from '../../../shared/dashboard';
import { obj, arr, text, numeric } from '../json';
import { periodFor, collectionStart } from '../../metrics/periods';
import { boundedMap, type AnalyticsContext } from './analytics';
import { ReadSources } from '../sources';
export async function collectAccount(
  ctx: AnalyticsContext,
  defs: MetricDefinition[],
  subscriptions: Subscription[],
  subscriptionsVerified = true,
): Promise<Record<string, Observation>> {
  const client = new ReadSources(ctx.clients);
  const root = `/accounts/${ctx.accountId}`,
    out: Record<string, Observation> = {};
  const set = (
    id: string,
    usage: string | null,
    source: string,
    status: Observation['status'] = 'ok',
    message?: string,
    included?: string,
  ) => {
    const d = defs.find((x) => x.id === id)!;
    out[id] = {
      usage,
      source,
      status,
      message,
      included,
      period: periodFor(d.period, ctx.now, ctx.cycle),
      coverage: status === 'ok' || status === 'not_enabled' ? 'complete' : 'unverified',
      at: ctx.now.toISOString(),
      rangeStart:
        id === 'worker_observability_events'
          ? (collectionStart(
              periodFor('billing_cycle', ctx.now, ctx.cycle),
              ctx.now,
              ctx.paidSince,
            ) ?? undefined)
          : undefined,
    };
  };
  const jobs = [
    async () => {
      const path = root + '/secrets_store/quota',
        r = obj(await client.get(path)),
        s = obj(r.secrets);
      const usage = numeric(s.usage);
      if (usage === null) throw new Error('密钥额度响应不完整');
      set('secrets_count', usage, path, 'ok', undefined, numeric(s.quota) ?? undefined);
    },
    async () => {
      const path = root + '/images/v1/stats',
        r = obj(await client.get(path)),
        c = obj(r.count);
      const n = numeric(c.current);
      if (n === null) throw new Error('图片数量响应不完整');
      set(
        'images_storage_per_hundred_thousand',
        n,
        path,
        'ok',
        '额度按订阅购买数量，不将容量上限当免费额度',
      );
    },
    async () => {
      const path = root + '/stream/storage-usage',
        r = obj(await client.get(path)),
        n = numeric(r.totalStorageMinutes);
      if (n === null) throw new Error('视频存储响应不完整');
      set(
        'stream_storage_thousand_minutes',
        n,
        path,
        'ok',
        '当前已存储分钟；费用以订阅购买量和账单为准',
      );
    },
    async () => {
      if (!ctx.cycle) throw new Error('缺少账期');
      const rangeStart = collectionStart(
        periodFor('billing_cycle', ctx.now, ctx.cycle),
        ctx.now,
        ctx.paidSince,
      )!;
      const path =
          root +
          `/workers/observability/usage?from=${new Date(rangeStart).getTime()}&to=${ctx.now.getTime()}&tz=UTC`,
        r = obj(await client.get(path)),
        n = numeric(r.events);
      if (n === null) throw new Error('日志用量响应不完整');
      set('worker_observability_events', n, path);
    },
    async () => {
      const path = root + '/registrar/domains',
        r = await client.list(path);
      set(
        'registrar_domains',
        String(r.length),
        path,
        'ok',
        '注册数量不代表续费金额，续费以账单为准',
      );
    },
    async () => {
      const zones = await client.list(`/zones?account.id=${ctx.accountId}`);
      const checks = await boundedMap(zones, 3, async (z) => {
        const zone = obj(z),
          id = text(zone.id);
        if (!/^[a-f\d]{32}$/.test(id)) throw new Error('区域 ID 不完整');
        const path = `/zones/${id}/smart_shield`,
          r = obj(await client.get(path, true));
        return { zone: text(zone.name), data: r };
      });
      for (const [id, key] of [
        ['argo_bytes', 'argo_smart_routing'],
        ['cache_reserve_storage', 'cache_reserve'],
      ] as const) {
        const disabled =
          checks.length > 0 &&
          checks.every((c) =>
            arr(c.data.messages).some((m) => text(obj(m).message).includes(`unlock ${key}`)),
          );
        set(
          id,
          null,
          'REST · zones/smart_shield',
          disabled ? 'not_enabled' : 'partial',
          disabled
            ? '所有区域均明确返回需要升级才能开通'
            : `已核查 ${checks.length} 个区域；缺少完整账期计量`,
        );
      }
    },
  ];
  const ids = [
    ['secrets_count'],
    ['images_storage_per_hundred_thousand'],
    ['stream_storage_thousand_minutes'],
    ['worker_observability_events'],
    ['registrar_domains'],
    ['argo_bytes', 'cache_reserve_storage'],
  ];
  await boundedMap(jobs, 3, async (fn) => {
    const i = jobs.indexOf(fn);
    try {
      await fn();
    } catch (e) {
      for (const id of ids[i])
        set(id, null, 'Cloudflare REST', 'error', e instanceof Error ? e.message : '读取失败');
    }
  });
  if (!subscriptionsVerified) {
    for (const id of ['subscription_count', 'zero_trust_seats', 'platforms_subscription'])
      set(id, null, 'REST · accounts/subscriptions', 'error', '本次订阅读取失败，保留上次成功状态');
    return out;
  }
  set('subscription_count', String(subscriptions.length), 'REST · accounts/subscriptions');
  const zt = subscriptions.find((s) => s.planId.startsWith('teams_'));
  if (zt) {
    const seats = zt.components.find((x) => x.name === 'users');
    if (seats) {
      try {
        const users = await client.list(root + '/access/users');
        if (
          users.some(
            (u) =>
              typeof obj(u).access_seat !== 'boolean' || typeof obj(u).gateway_seat !== 'boolean',
          )
        )
          throw new Error('用户响应缺少完整席位状态');
        const count = users.filter(
          (u) => obj(u).access_seat === true || obj(u).gateway_seat === true,
        ).length;
        set(
          'zero_trust_seats',
          String(count),
          'REST · access/users',
          'ok',
          '使用 Access 或 WARP 的当前席位；不重复计算同一用户',
          seats.value,
        );
      } catch (e) {
        set(
          'zero_trust_seats',
          null,
          'REST · access/users',
          'error',
          e instanceof Error ? e.message : '席位读取失败',
          seats.value,
        );
      }
    }
  }
  const platforms = subscriptions.find((s) => /platforms/i.test(s.planId));
  set(
    'platforms_subscription',
    platforms?.price ?? null,
    'REST · accounts/subscriptions',
    platforms ? 'ok' : 'not_enabled',
    platforms ? '已包含在固定订阅费，不能再重复相加' : '未发现 Workers for Platforms 订阅',
  );
  return out;
}
