# 产品与计量目录

此表由 shared/catalog.ts 的通用代码定义生成，不包含真实账户用量、状态、资源、订阅、Token 或采集时刻。额外计量由使用者的订阅在运行时发现；基础目录不构成完整账单覆盖承诺。

支持 30 个产品、81 项基础指标；页面仅显示已有可靠数据的指标和产品入口。机器可读定义见 [catalog.json](catalog.json)。

| 产品 | 指标 ID / 名称 | 单位 / 周期 | 默认包含额度 | 参考来源 |
|---|---|---|---|---|
| workers | worker_standard_request / 请求次数 | 次 / billing_cycle | 10000000 | [官方文档](https://developers.cloudflare.com/workers/platform/pricing/) |
| workers | worker_standard_cpu_ms / CPU 时间 | ms / billing_cycle | 30000000 | [官方文档](https://developers.cloudflare.com/workers/platform/pricing/) |
| workers | worker_observability_events / Workers Logs 事件 | 条 / billing_cycle | 20000000 | [官方文档](https://developers.cloudflare.com/workers/platform/pricing/) |
| workers | worker_logpush_requests / Logpush 请求 | 次 / billing_cycle | 10000000 | [官方文档](https://developers.cloudflare.com/workers/platform/pricing/) |
| builds | worker_build_minute / 构建分钟 | 分钟 / calendar_month | 6000 | [官方文档](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) |
| d1 | d1_rows_read / 读取行数 | 行 / billing_cycle | 25000000000 | [官方文档](https://developers.cloudflare.com/d1/platform/pricing/) |
| d1 | d1_rows_written / 写入行数 | 行 / billing_cycle | 50000000 | [官方文档](https://developers.cloudflare.com/d1/platform/pricing/) |
| d1 | d1_storage / 存储计费量 | GB-month / billing_cycle | 5 | [官方文档](https://developers.cloudflare.com/d1/platform/pricing/) |
| d1 | d1_capacity / 最近1小时存储峰值 | GB / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/d1/platform/pricing/) |
| kv | worker_kv_reads / 读取次数 | 次 / billing_cycle | 10000000 | [官方文档](https://developers.cloudflare.com/kv/platform/pricing/) |
| kv | worker_kv_writes / 写入次数 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/kv/platform/pricing/) |
| kv | worker_kv_deletes / 删除次数 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/kv/platform/pricing/) |
| kv | worker_kv_lists / 列表操作 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/kv/platform/pricing/) |
| kv | worker_kv_storage / 存储计费量 | GB-month / billing_cycle | 1 | [官方文档](https://developers.cloudflare.com/kv/platform/pricing/) |
| durable-objects | worker_durable_objects_requests / 请求次数 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_duration / 计算时长 | GB-s / billing_cycle | 400000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_sql_rows_read / SQLite 读取行数 | 行 / billing_cycle | 25000000000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_sql_rows_written / SQLite 写入行数 | 行 / billing_cycle | 50000000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_sql_storage / SQLite 存储 | GB-month / billing_cycle | 5 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_storage_reads / KV 后端读取 | 单位 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_storage_writes / KV 后端写入 | 单位 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_storage_deletes / KV 后端删除 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| durable-objects | worker_durable_objects_stored_data / KV 后端存储 | GB-month / billing_cycle | 1 | [官方文档](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| r2 | r2_storage / Standard 存储 | GB-month / billing_cycle | 10 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_class_a_operations / Standard A 类操作 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_class_b_operations / Standard B 类操作 | 次 / billing_cycle | 10000000 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_ia_storage / IA 存储 | GB-month / billing_cycle | 0 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_ia_class_a_operations / IA A 类操作 | 次 / billing_cycle | 0 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_ia_class_b_operations / IA B 类操作 | 次 / billing_cycle | 0 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_ia_data_retrieval / IA 数据取回 | GB / billing_cycle | 0 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_capacity / 当前存储容量 | GB / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_data_catalog_operations / Basin Catalog 操作 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_data_catalog_bytes_processed / Catalog 压缩处理 | GB / billing_cycle | 10 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2_data_catalog_objects_processed / Catalog 对象处理 | 个 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| r2 | r2sql_bytes_read / Basin SQL 扫描 | GB / billing_cycle | 10 | [官方文档](https://developers.cloudflare.com/r2/pricing/) |
| queues | queues_standard_operations / 消息操作 | 次 / billing_cycle | 1000000 | [官方文档](https://developers.cloudflare.com/queues/platform/pricing/) |
| workflows | workflows_steps / 执行步骤 | 步 / billing_cycle | 500000 | [官方文档](https://developers.cloudflare.com/workflows/reference/pricing/) |
| workflows | workflows_storage / 持久化存储 | GB-month / billing_cycle | 1 | [官方文档](https://developers.cloudflare.com/workflows/reference/pricing/) |
| workflows | workflows_requests / 调用次数（共享 Workers） | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/workflows/reference/pricing/) |
| containers | cloudchamber_vcpu_usage / 活跃 CPU | vCPU-s / billing_cycle | 22500 | [官方文档](https://developers.cloudflare.com/containers/platform/pricing/) |
| containers | cloudchamber_memory_usage / 分配内存 | GiB-s / billing_cycle | 90000 | [官方文档](https://developers.cloudflare.com/containers/platform/pricing/) |
| containers | cloudchamber_disk_usage / 分配磁盘 | GB-s / billing_cycle | 720000 | [官方文档](https://developers.cloudflare.com/containers/platform/pricing/) |
| containers | container_egress_namer_eu / 北美 / 欧洲流出 | GB / billing_cycle | 1000 | [官方文档](https://developers.cloudflare.com/containers/platform/pricing/) |
| containers | container_egress_oc_taiwan_korea / 大洋洲 / 台湾 / 韩国流出 | GB / billing_cycle | 500 | [官方文档](https://developers.cloudflare.com/containers/platform/pricing/) |
| containers | container_egress_all_other / 其他区域流出 | GB / billing_cycle | 500 | [官方文档](https://developers.cloudflare.com/containers/platform/pricing/) |
| hyperdrive | hyperdrive_queries / 数据库查询 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/hyperdrive/platform/pricing/) |
| vectorize | vectorize_queried_dimensions / 查询维度 | 维度 / billing_cycle | 50000000 | [官方文档](https://developers.cloudflare.com/vectorize/platform/pricing/) |
| vectorize | vectorize_stored_dimensions / 存储维度 | 维度 / instant | 10000000 | [官方文档](https://developers.cloudflare.com/vectorize/platform/pricing/) |
| pipelines | pipelines_sink_json / JSON 写入 | GB / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/pipelines/pricing/) |
| pipelines | pipelines_sink_parquet_iceberg / Parquet / Iceberg 写入 | GB / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/pipelines/pricing/) |
| pipelines | pipelines_sql_transforms / SQL 转换 | GB / billing_cycle | 50 | [官方文档](https://developers.cloudflare.com/pipelines/pricing/) |
| analytics-engine | analytics_data_points / 写入数据点 | 点 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) |
| analytics-engine | analytics_queries / 读取查询 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) |
| secrets | secrets_count / 密钥数量 | 个 / instant | 100 | [官方文档](https://developers.cloudflare.com/secrets-store/platform/limits/) |
| artifacts | artifacts_operations / 仓库操作 | 次 / billing_cycle | 10000 | [官方文档](https://developers.cloudflare.com/artifacts/platform/pricing/) |
| artifacts | artifacts_storage / 仓库存储 | GB-month / billing_cycle | 1 | [官方文档](https://developers.cloudflare.com/artifacts/platform/pricing/) |
| dynamic-workers | dynamic_workers_count / 动态 Worker 日累计 | 个·日 / billing_cycle | 1000 | [官方文档](https://developers.cloudflare.com/dynamic-workers/pricing/) |
| platforms | platforms_subscription / 平台固定订阅 | USD / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/) |
| workers-ai | workers_ai_neurons / 神经元用量 | neurons / day | 10000 | [官方文档](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| workers-ai | workers_ai_model_cost / 按模型计费用量 | USD / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| ai-search | ai_search_queries / 语义查询 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/ai-search/platform/pricing/) |
| ai-gateway | ai_gateway_requests / 网关请求 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/ai-gateway/reference/pricing/) |
| browser | browser_rendering_total_browser_hours / 浏览器运行 | 小时 / billing_cycle | 10 | [官方文档](https://developers.cloudflare.com/browser-rendering/pricing/) |
| browser | browser_rendering_avg_concurrent_browsers / 月平均并发浏览器 | 个 / billing_cycle | 10 | [官方文档](https://developers.cloudflare.com/browser-rendering/pricing/) |
| web-search | web_search_requests / 搜索请求 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/web-search/pricing/) |
| email | email_sent / 付费发送邮件 | 封 / billing_cycle | 3000 | [官方文档](https://developers.cloudflare.com/email-service/pricing/) |
| images | images_storage_per_hundred_thousand / 托管图片数量 | 张 / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/images/pricing/) |
| images | image_unique_transformations / 唯一转换量 | 次 / calendar_month | 5000 | [官方文档](https://developers.cloudflare.com/images/pricing/) |
| images | image_delivered_per_hundred_thousand / 托管图片分发 | 次 / billing_cycle | 0 | [官方文档](https://developers.cloudflare.com/images/pricing/) |
| stream | stream_storage_thousand_minutes / 存储视频时长 | 分钟 / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/stream/pricing/) |
| stream | stream_viewed_thousand_minutes / 播放时长 | 分钟 / billing_cycle | 0 | [官方文档](https://developers.cloudflare.com/stream/pricing/) |
| realtime | realtime_minutes / 实时音视频 | 分钟 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/realtime/pricing/) |
| realtime | turn_egress / TURN 流出流量 | GB / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/realtime/pricing/) |
| network | argo_bytes / Argo Smart Routing | GB / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/plans/) |
| network | cache_reserve_storage / Cache Reserve 存储 | GB-month / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/plans/) |
| network | load_balancing_queries / 负载均衡查询 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/plans/) |
| network | spectrum_bytes / Spectrum 流量 | GB / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/plans/) |
| network | zaraz_loads / Zaraz 加载 | 次 / billing_cycle | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/plans/) |
| zero-trust | zero_trust_seats / 当前使用席位 | 席 / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/cloudflare-one/team-and-resources/) |
| registrar | registrar_domains / 注册域名数量 | 个 / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/registrar/) |
| subscriptions | subscription_count / 有效订阅 | 项 / instant | 未核实或不适用 | [官方文档](https://developers.cloudflare.com/billing/) |

额度与价格必须结合适用套餐核查，不能把平台上限当作包含额度。来源单位、保留期、入账延迟及部分计价处理见 [适配器说明](source-verification.md)。
