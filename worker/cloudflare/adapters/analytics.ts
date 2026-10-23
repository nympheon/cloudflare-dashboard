import Decimal from 'decimal.js';
import type { MetricDefinition, Observation, TokenKind } from '../../../shared/dashboard';
import { CloudflareReadClient, SourceError } from '../client';
import { obj, arr, numeric, text, type Json } from '../json';
import { mapR2Operations, UnverifiedR2Usage } from './storage';
import { periodFor, collectionStart } from '../../metrics/periods';
import { ReadSources } from '../sources';
export interface AnalyticsContext {
  accountId: string;
  clients: Partial<Record<TokenKind, CloudflareReadClient>>;
  now: Date;
  cycle?: { start: string; end: string };
  paidSince?: string;
}
export interface Dataset {
  name: string;
  ids: string[];
  select: string;
  period?: 'day' | 'calendar_month' | 'instant';
  retention?: number;
  dateFilter?: boolean;
  map?: (rows: Json[]) => Record<string, string>;
  fields?: Record<string, [string, string?]>;
  partial?: string;
  partialFor?: Record<string, string>;
}
const sum = (rows: Json[], path: string) =>
  rows
    .reduce((v, r) => {
      let x: Json = r;
      for (const k of path.split('.')) x = obj(x)[k];
      const value = numeric(x);
      if (value === null) throw new Error('统计字段缺失或为空，未将未知用量当成零');
      return v.plus(value);
    }, new Decimal(0))
    .toString();
export const datasets: Dataset[] = [
  {
    name: 'workersInvocationsAdaptive',
    ids: ['worker_standard_request', 'worker_standard_cpu_ms'],
    select: 'sum { requests cpuTimeUs }',
    map: (r) => ({
      worker_standard_request: sum(r, 'sum.requests'),
      worker_standard_cpu_ms: new Decimal(sum(r, 'sum.cpuTimeUs')).div(1000).toString(),
    }),
  },
  {
    name: 'd1AnalyticsAdaptiveGroups',
    ids: ['d1_rows_read', 'd1_rows_written'],
    select: 'sum { rowsRead rowsWritten }',
    fields: { d1_rows_read: ['sum.rowsRead'], d1_rows_written: ['sum.rowsWritten'] },
  },
  {
    name: 'd1StorageAdaptiveGroups',
    ids: ['d1_capacity'],
    select: 'max { databaseSizeBytes } dimensions { databaseId }',
    period: 'instant',
    fields: { d1_capacity: ['max.databaseSizeBytes', '1000000000'] },
  },
  {
    name: 'durableObjectsInvocationsAdaptiveGroups',
    ids: ['worker_durable_objects_requests'],
    select: 'sum { requests }',
    // Hibernating messages are included here, ordinary WebSocket messages are in
    // periodic groups. Analytics does not apply the billing-only 20:1 ratio.
    // Until invocation types can be classified reliably, use billable-usage.
    partial: '调用统计尚未按 WebSocket 计费比例核算；请求用量采用账单来源',
  },
  {
    name: 'durableObjectsPeriodicGroups',
    ids: [
      'worker_durable_objects_duration',
      'worker_durable_objects_sql_rows_read',
      'worker_durable_objects_sql_rows_written',
      'worker_durable_objects_storage_reads',
      'worker_durable_objects_storage_writes',
      'worker_durable_objects_storage_deletes',
    ],
    select:
      'sum { duration rowsRead rowsWritten storageReadUnits storageWriteUnits storageDeletes }',
    fields: {
      worker_durable_objects_duration: ['sum.duration'],
      worker_durable_objects_sql_rows_read: ['sum.rowsRead'],
      worker_durable_objects_sql_rows_written: ['sum.rowsWritten'],
      worker_durable_objects_storage_reads: ['sum.storageReadUnits'],
      worker_durable_objects_storage_writes: ['sum.storageWriteUnits'],
      worker_durable_objects_storage_deletes: ['sum.storageDeletes'],
    },
  },
  {
    name: 'kvOperationsAdaptiveGroups',
    ids: ['worker_kv_reads', 'worker_kv_writes', 'worker_kv_deletes', 'worker_kv_lists'],
    select: 'sum { requests } dimensions { actionType }',
    map: (rows) => {
      const out: Record<string, string> = {
        worker_kv_reads: '0',
        worker_kv_writes: '0',
        worker_kv_deletes: '0',
        worker_kv_lists: '0',
      };
      for (const r of rows) {
        const d = text(obj(obj(r).dimensions).actionType).toLowerCase();
        const key =
          d.includes('read') || d === 'get'
            ? 'reads'
            : d.includes('write') || d === 'put'
              ? 'writes'
              : d.includes('delete')
                ? 'deletes'
                : d.includes('list')
                  ? 'lists'
                  : null;
        if (key)
          out['worker_kv_' + key] = new Decimal(out['worker_kv_' + key])
            .plus(numeric(obj(obj(r).sum).requests) ?? 0)
            .toString();
      }
      return out;
    },
  },
  {
    name: 'kvStorageAdaptiveGroups',
    ids: ['worker_kv_storage'],
    select: 'max { byteCount }',
    partial: '存储统计为容量，非 GB-month；有用量时采用账单数据计价',
  },
  {
    name: 'durableObjectsStorageGroups',
    ids: ['worker_durable_objects_stored_data'],
    select: 'max { storedBytes }',
    partial: 'KV 后端容量不能替代账期 GB-month，采用账单计费来源',
  },
  {
    name: 'logpushUsageAdaptiveGroups',
    ids: ['worker_logpush_requests'],
    select: 'sum { billableBytes }',
    partial: '该来源返回投递字节，不能作为 Workers Trace Events 的请求计费用量',
  },
  {
    name: 'r2OperationsAdaptiveGroups',
    ids: [
      'r2_class_a_operations',
      'r2_class_b_operations',
      'r2_ia_class_a_operations',
      'r2_ia_class_b_operations',
      'r2_ia_data_retrieval',
    ],
    select: 'sum { requests } dimensions { actionType storageClass responseStatusCode }',
    map: mapR2Operations,
  },
  {
    name: 'r2StorageAdaptiveGroups',
    ids: ['r2_capacity'],
    select: 'max { payloadSize metadataSize } dimensions { bucketName }',
    period: 'instant',
    map: (rows) => ({
      r2_capacity: new Decimal(sum(rows, 'max.payloadSize'))
        .plus(sum(rows, 'max.metadataSize'))
        .div(1e9)
        .toString(),
    }),
  },
  {
    name: 'r2StorageAdaptiveGroups',
    ids: ['r2_storage', 'r2_ia_storage'],
    select: 'max { payloadSize metadataSize }',
    map: (rows): Record<string, string> =>
      new Decimal(sum(rows, 'max.payloadSize')).plus(sum(rows, 'max.metadataSize')).eq(0)
        ? { r2_storage: '0' }
        : {},
    partialFor: {
      r2_ia_storage: 'IA 有最短存储时长费用，容量为零仍不能证明账期费用为零；采用账单来源',
    },
  },
  {
    name: 'workflowsAdaptiveGroups',
    ids: ['workflows_requests'],
    select: 'count',
    retention: 32,
    partial: '事件条数不能直接充当计费调用次数；请求与 CPU 额度在 Workers 共用，不重复计价',
  },
  {
    name: 'workersBuildsBuildMinutesAdaptiveGroups',
    ids: ['worker_build_minute'],
    select: 'sum { buildMinutes }',
    period: 'calendar_month',
    retention: 32,
    fields: { worker_build_minute: ['sum.buildMinutes'] },
  },
  {
    name: 'queueMessageOperationsAdaptiveGroups',
    ids: ['queues_standard_operations'],
    select: 'sum { billableOperations }',
    fields: { queues_standard_operations: ['sum.billableOperations'] },
  },
  {
    name: 'workflowsAdaptiveGroups',
    ids: ['workflows_steps', 'workflows_storage'],
    select: 'sum { stepCount storageRate }',
    retention: 32,
    partialFor: { workflows_storage: '存储增长率不能替代 GB-month 完整计量' },
    fields: { workflows_steps: ['sum.stepCount'] },
  },
  {
    name: 'containersUsageAdaptiveGroups',
    ids: [
      'cloudchamber_vcpu_usage',
      'cloudchamber_memory_usage',
      'cloudchamber_disk_usage',
      'container_egress_namer_eu',
      'container_egress_oc_taiwan_korea',
      'container_egress_all_other',
    ],
    select: 'sum { cpuTimeSec allocatedMemory allocatedDisk txBytes } dimensions { region }',
    retention: 32,
    map: (rows) => {
      const out: Record<string, string> = {
        cloudchamber_vcpu_usage: sum(rows, 'sum.cpuTimeSec'),
        cloudchamber_memory_usage: new Decimal(sum(rows, 'sum.allocatedMemory'))
          .div(1073741824)
          .toString(),
        cloudchamber_disk_usage: new Decimal(sum(rows, 'sum.allocatedDisk')).div(1e9).toString(),
        container_egress_namer_eu: '0',
        container_egress_oc_taiwan_korea: '0',
        container_egress_all_other: '0',
      };
      for (const raw of rows) {
        const region = text(obj(obj(raw).dimensions).region).toLowerCase();
        const id = /north.?america|europe|weur|eeur|enam|wnam|nam|eur/.test(region)
          ? 'container_egress_namer_eu'
          : /oceania|taiwan|korea|oc|twn|kor/.test(region)
            ? 'container_egress_oc_taiwan_korea'
            : 'container_egress_all_other';
        out[id] = new Decimal(out[id])
          .plus(new Decimal(numeric(obj(obj(raw).sum).txBytes) ?? 0).div(1e9))
          .toString();
      }
      return out;
    },
  },
  {
    name: 'hyperdriveQueriesAdaptiveGroups',
    ids: ['hyperdrive_queries'],
    select: 'count',
    retention: 32,
    fields: { hyperdrive_queries: ['count'] },
  },
  {
    name: 'vectorizeV2QueriesAdaptiveGroups',
    ids: ['vectorize_queried_dimensions'],
    select: 'sum { queriedVectorDimensions }',
    retention: 32,
    fields: { vectorize_queried_dimensions: ['sum.queriedVectorDimensions'] },
  },
  {
    name: 'vectorizeV2StorageAdaptiveGroups',
    ids: ['vectorize_stored_dimensions'],
    select: 'max { storedVectorDimensions } dimensions { indexName }',
    period: 'instant',
    fields: { vectorize_stored_dimensions: ['max.storedVectorDimensions'] },
  },
  {
    name: 'aiGatewayRequestsAdaptiveGroups',
    ids: ['ai_gateway_requests'],
    select: 'count',
    retention: 32,
    fields: { ai_gateway_requests: ['count'] },
  },
  {
    name: 'r2CatalogDataOperationsAdaptiveGroups',
    ids: ['r2_data_catalog_operations'],
    select: 'count',
    retention: 32,
    fields: { r2_data_catalog_operations: ['count'] },
  },
  {
    name: 'r2CatalogTableMaintenanceAdaptiveGroups',
    ids: ['r2_data_catalog_bytes_processed', 'r2_data_catalog_objects_processed'],
    select: 'sum { inputBytes filesProcessed }',
    retention: 32,
    partial: '维护事件尚未筛选已计费的成功自动压缩作业；采用账单来源',
  },
  {
    name: 'r2sqlOperationsAdaptiveGroups',
    ids: ['r2sql_bytes_read'],
    select: 'sum { r2BytesRead }',
    retention: 32,
    fields: { r2sql_bytes_read: ['sum.r2BytesRead', '1000000000'] },
  },
  {
    name: 'pipelinesOperatorAdaptiveGroups',
    ids: ['pipelines_sql_transforms'],
    select: 'sum { bytesIn }',
    retention: 32,
    partial: '该来源仅返回摄入字节，未区分免费入口与 SQL 转换计费量；采用账单来源',
  },
  {
    name: 'callsTurnUsageAdaptiveGroups',
    ids: ['turn_egress'],
    select: 'sum { egressBytes }',
    retention: 32,
    fields: { turn_egress: ['sum.egressBytes', '1000000000'] },
  },
  {
    name: 'realtimeKitUsageAdaptiveGroups',
    ids: ['realtime_minutes'],
    select: 'sum { mediaMinutes audioMinutes }',
    retention: 32,
    fields: { realtime_minutes: ['sum.mediaMinutes'] },
    partial: '音频、视频与导出分钟各有计价维度，未混算成统一价格',
  },
  {
    name: 'workersInvocationsByOwnerAndScriptGroups',
    ids: ['dynamic_workers_count'],
    select: 'uniq { distinctDynamicWorkerCount } dimensions { date }',
    retention: 32,
    dateFilter: true,
    fields: { dynamic_workers_count: ['uniq.distinctDynamicWorkerCount'] },
  },
  {
    name: 'aiInferenceAdaptiveGroups',
    ids: ['workers_ai_neurons'],
    select: 'sum { totalNeurons }',
    period: 'day',
    retention: 32,
    fields: { workers_ai_neurons: ['sum.totalNeurons'] },
  },
  {
    name: 'aiInferenceAdaptiveGroups',
    ids: ['workers_ai_model_cost'],
    select: 'sum { totalCostMetricValue1 totalCostMetricValue2 }',
    retention: 32,
    partial: '模型返回计费计量值，不直接等于美元；需要按模型及适用价格核对',
  },
  {
    name: 'aiSearchSemanticQueriesAdaptiveGroups',
    ids: ['ai_search_queries'],
    select: 'count',
    retention: 32,
    fields: { ai_search_queries: ['count'] },
  },
  {
    name: 'browserRenderingBrowserTimeUsageAdaptiveGroups',
    ids: ['browser_rendering_total_browser_hours'],
    select: 'sum { totalSessionDurationMs }',
    retention: 32,
    fields: { browser_rendering_total_browser_hours: ['sum.totalSessionDurationMs', '3600000'] },
  },
  {
    name: 'browserRenderingBindingSessionsAdaptiveGroups',
    ids: ['browser_rendering_avg_concurrent_browsers'],
    select: 'avg { avgConcurrentSessions }',
    retention: 32,
    partial: '并发统计需核对整月时间加权，不能以最大并发替代计费平均值',
  },
  {
    name: 'workersAnalyticsEngineAdaptiveGroups',
    ids: ['analytics_data_points'],
    select: 'count',
    retention: 31,
    partial: '该统计记录数尚不能直接证明计费写入数据点总量',
  },
  {
    name: 'pipelinesSinkAdaptiveGroups',
    ids: ['pipelines_sink_json', 'pipelines_sink_parquet_iceberg'],
    select: 'sum { bytesWritten }',
    partial: '总写入字节尚未按 JSON / Parquet 计费维度拆分，不能混算',
  },
  {
    name: 'artifactsEventsAdaptiveGroups',
    ids: ['artifacts_operations'],
    select: 'count dimensions { eventType }',
    retention: 31,
    partial: '事件包含管理操作，不能直接作为仓库计费用量',
  },
  {
    name: 'artifactsStorageAdaptiveGroups',
    ids: ['artifacts_storage'],
    select: 'max { repositorySizeBytes }',
    retention: 31,
    partial: '当前容量不能替代账期 GB-month',
  },
  {
    name: 'webSearchRequestsAdaptiveGroups',
    ids: ['web_search_requests'],
    select: 'count',
    retention: 32,
    fields: { web_search_requests: ['count'] },
  },
  {
    name: 'emailSendingAdaptiveGroups',
    ids: ['email_sent'],
    select: 'count',
    retention: 31,
    partial: '邮件事件尚未排除入站、拒收及发送到已验证地址的免费邮件；采用账单来源',
  },
  {
    name: 'streamMinutesViewedAdaptiveGroups',
    ids: ['stream_viewed_thousand_minutes'],
    select: 'sum { minutesViewed }',
    fields: { stream_viewed_thousand_minutes: ['sum.minutesViewed'] },
  },
  {
    name: 'imagesHostedRequestsAdaptiveGroups',
    ids: ['image_delivered_per_hundred_thousand'],
    select: 'count',
    retention: 30.04,
    partial: '托管分发源无法保证完整 31 天账期；继续核查替代账单来源，暂不估算费用',
    fields: { image_delivered_per_hundred_thousand: ['count'] },
  },
  {
    name: 'imagesUniqueTransformationsAccumulatedSinceStartOfMonth',
    ids: ['image_unique_transformations'],
    select: 'date transformations',
    dateFilter: true,
    period: 'calendar_month',
    retention: 61,
    map: (r) => ({
      image_unique_transformations: r
        .reduce((v, x) => Decimal.max(v, numeric(obj(x).transformations) ?? 0), new Decimal(0))
        .toString(),
    }),
  },
];
export async function collectDataset(
  dataset: Dataset,
  ctx: AnalyticsContext,
  definitions: MetricDefinition[],
): Promise<Record<string, Observation>> {
  const at = ctx.now.toISOString();
  const period = periodFor(dataset.period ?? 'billing_cycle', ctx.now, ctx.cycle);
  const source = `GraphQL · ${dataset.name}`;
  const paidProducts = new Set([
    'workers',
    'builds',
    'd1',
    'kv',
    'durable-objects',
    'queues',
    'workflows',
    'containers',
    'hyperdrive',
    'vectorize',
    'pipelines',
    'analytics-engine',
    'dynamic-workers',
    'browser',
  ]);
  const followsPaid = dataset.ids.every((id) =>
    paidProducts.has(definitions.find((d) => d.id === id)?.productId ?? ''),
  );
  const rangeStart = collectionStart(period, ctx.now, followsPaid ? ctx.paidSince : undefined);
  const base = (status: Observation['status'], message?: string): Observation => ({
    usage: null,
    status,
    period,
    coverage: 'unverified',
    at,
    source,
    message,
    rangeStart: rangeStart ?? undefined,
  });
  try {
    const client = new ReadSources(ctx.clients);
    if (period.kind !== 'instant' && !period.start)
      throw new Error('未取得可靠账期，尚未查询累计用量');
    const start = rangeStart!;
    const lookback = (ctx.now.getTime() - new Date(start).getTime()) / 86400e3;
    if (lookback > (dataset.retention ?? 90))
      return Object.fromEntries(
        dataset.ids.map((id) => [
          id,
          base('partial', '来源保留期不足以覆盖当前周期，未将局部结果当作完整用量'),
        ]),
      );
    const filter = dataset.dateFilter
      ? `date_geq:${JSON.stringify(start.slice(0, 10))},date_leq:${JSON.stringify(at.slice(0, 10))}`
      : `datetime_geq:${JSON.stringify(start)},datetime_lt:${JSON.stringify(at)}`;
    const data = await client.query(
      `query { viewer { accounts(filter:{accountTag:${JSON.stringify(ctx.accountId)}}) { ${dataset.name}(limit:10000,filter:{${filter}}) { ${dataset.select} } } } }`,
    );
    const accounts = arr(obj(data.viewer).accounts);
    const raw = obj(accounts[0])[dataset.name];
    if (!Array.isArray(raw) || accounts.length !== 1)
      throw new Error('统计结果缺少目标账户或指标，不能判为无记录');
    const rows = raw;
    const truncated = rows.length >= 10000;
    const mapped =
      dataset.map?.(rows) ??
      Object.fromEntries(
        Object.entries(dataset.fields ?? {}).map(([id, [path, divisor]]) => [
          id,
          new Decimal(sum(rows, path)).div(divisor ?? 1).toString(),
        ]),
      );
    return Object.fromEntries(
      dataset.ids.map((id) => {
        const def = definitions.find((x) => x.id === id)!;
        const partialMessage = dataset.partialFor?.[id] ?? dataset.partial;
        const partial = truncated || Boolean(partialMessage) || mapped[id] === undefined;
        const status = partial ? 'partial' : rows.length === 0 ? 'no_records' : 'ok';
        return [
          id,
          {
            usage: rows.length ? (mapped[id] ?? null) : null,
            status,
            period: periodFor(def.period, ctx.now, ctx.cycle),
            coverage: partial ? 'partial' : 'complete',
            at,
            source,
            rangeStart: start,
            message: truncated
              ? '统计达到分页上限，范围不完整'
              : (partialMessage ??
                (rows.length === 0
                  ? '当前周期暂无使用记录'
                  : partial
                    ? '当前数据不能可靠换算为完整计费用量'
                    : undefined)),
          } satisfies Observation,
        ];
      }),
    );
  } catch (e) {
    return Object.fromEntries(
      dataset.ids.map((id) => [
        id,
        base(
          e instanceof UnverifiedR2Usage ? 'partial' : 'error',
          e instanceof SourceError ? e.message : e instanceof Error ? e.message : '统计读取失败',
        ),
      ]),
    );
  }
}
export async function boundedMap<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const result: R[] = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= values.length) break;
        result[i] = await fn(values[i]);
      }
    }),
  );
  return result;
}
