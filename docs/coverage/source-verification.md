# 适配器与计费边界

本文件仅描述实现方式和需要核实的来源，不发布任何账户的实际订阅、资源、用量、账单、Token 尾号或采集时刻。是否可读取、保留期和适用价格须针对使用者自己的账户验证。

## 来源与单位

- 订阅接口提供套餐、账期和组件；billable-usage/info 提供账期锚点，billable-usage 按行提供已入账量与金额。累计金额不能逐行相加，同一 meter 需要归一去重；受限或 Alpha 接口不能作为通用兜底。
- Workers 从 sum.requests 和 sum.cpuTimeUs 取数；CPU 将微秒除以 1000 转为 ms。
- D1 使用 rowsRead/rowsWritten；DO compute、SQL 行计量与旧 KV 后端独立；KV 按 actionType 分类。
- R2 按 actionType 与 storageClass 区分操作，免费 DeleteObject 不纳入付费操作。当前容量与 GB-month 分开。
- Builds、Queues、Workflows、Containers、Hyperdrive、Vectorize、AI、Browser、Pipelines、Realtime、TURN、Images、Stream 等使用固定 schema；普通刷新不重复 introspection。
- JSON 数字无损读取为字符串，金额使用 Decimal。接口路径只使用运行时账户/区域参数，无硬编码个人标识。

## 完整性与计费

1. 账单延迟：已入账量、chargeThrough 与最新统计分开；只估算尚未入账的增量，不重复计价。
2. 保留期：Images 分发等来源可能不足以覆盖完整长账期；不能将部分窗口当作完整周期，不能自动删卡片。
3. Artifacts：管理事件不能直接当作收费操作。
4. Logpush：配置权限与统计权限不同，通用投递字节不能代替 Workers Trace Events 的计费请求数。
5. Builds：空 limits 对象不能当作零，自然月额度与订阅账期分开。
6. 存储：容量峰值不能直接换成 GB-month。完整周期的峰值明确为零时才可推导零存储计量；正峰值但换算不可靠时保持 partial。
7. Containers：byte-seconds 按计费规则换算 GiB-s/GB-s；时间单位与区域流出分别计算。
8. 周期：每日 AI、年度订阅及其他起止时间的固定费用不混入同一个账期总额。
9. 开通时间：查询区间从套餐生效时间与周期起点的较晚者开始，避免把 Free 阶段套入 Paid 价格。
10. Zero Trust：按席位标志去重计数，不持久化用户姓名或邮箱。
11. 价格到期：已知规则到期后停止沿用旧价格，标记未计价，等待更新。

no_records、not_enabled、error 和 partial 含义不同。缺少权限、网络失败或来源不足不等于未开通，更不等于零费用。未知费用必须保留覆盖提示。

## 官方参考

- [Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1](https://developers.cloudflare.com/d1/platform/pricing/)、[Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[R2](https://developers.cloudflare.com/r2/pricing/)
- [Containers](https://developers.cloudflare.com/containers/platform/pricing/)、[Workflows](https://developers.cloudflare.com/workflows/reference/pricing/)、[Queues](https://developers.cloudflare.com/queues/platform/pricing/)
- [Images](https://developers.cloudflare.com/images/pricing/)、[Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)、[Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
- [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/pricing/)、[GraphQL Settings](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/settings/)

以上是实现参考链接，不代表对任意账户的当前价格或 API 可用性作出保证。版本中的价格核查日期见代码目录，上线前应重新核查。
