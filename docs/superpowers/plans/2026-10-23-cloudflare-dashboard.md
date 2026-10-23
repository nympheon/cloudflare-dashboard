# Cloudflare 用量与费用监控 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本地完成一个美观、移动端可用、指标稳定、费用口径可靠的 Cloudflare 单账户监控页面；用户确认本地页面后再部署 Cloudflare。

**Architecture:** React SPA 与静态资源直接分发，Worker 只处理同源 API、只读 Cloudflare 查询和计费计算，D1 只保留加密配置、能力登记和最新快照。打开网页和手动按钮触发更新，无定时采集、轮询或历史序列。采用官方 Cloudflare Vite plugin 在本地运行 Worker 和本地 D1，保持前后端运行方式与生产一致。

**Tech Stack:** React、TypeScript、Vite、Cloudflare Vite plugin、shadcn/ui、Tailwind CSS、Lucide、按需 Motion／SVG、Workers、D1、Web Crypto、十进制金额计算、Vitest；Browser/IAB 优先进行页面验收。

**Spec:** [需求基线与设计建议](../specs/2026-10-23-cloudflare-dashboard-design.md)。执行者先读 Spec；此计划不能代替其中的指标、周期、隐藏与失败语义。

**2026-10-23 执行状态：** 本地实现和自动/浏览器核查已完成，用户页面验收待确认，任务 12 未执行。来源或计费范围不足时保留 partial/未计价提示，公开文档不包含账户实际状态，不能据此声称全产品完整对账。具体任务结果与检查证据以 [开发进度](../../development-progress.md)、[本地验收](../../acceptance/local-page-review.md) 为准；下列 checkbox 保留原计划步骤，未逐项勾选不代表当前实现状态。

## Global Constraints

- **本地开发 → 用户确认本地页面 → Cloudflare 部署 → 线上复核。** 任务 1–11 不创建或修改远程资源，不部署 Worker，不写生产 Secret，不开启 CI 自动部署。
- 可用两个只读 Token 从本地读取现有账户；监控 Token 不承担部署授权，完整值不写源码、日志、文档、测试样本或构建产物。
- 只监控一个账户；两个 Token 必须属于／能访问同一个目标账户。全站不增加身份认证。
- 打开或重新加载页面自动更新一次，另有手动刷新；内部导航复用结果。无定时采集、无固定缓存有效期、无定时／聚焦／重连自动刷新。
- 不保存历史采样序列，不做趋势、预测或耗尽时间。各指标最后成功结果用于失败兜底，不构成历史列表。
- 指标清单稳定；正确来源成功但没有记录的指标保留；单次请求失败不隐藏、不变成 0；排除必须有完整审查证据。
- Workers Paid 以及其他可能收费产品逐项审查；资源上限不是包含额度，统计值不是天然等于计费值。
- 已产生费用与固定费用分列，账单与估算分清，未知费用不当作零，Free 硬性限制不虚构费用。
- 浅色、shadcn/ui、动态剩余额度图、科技感、手机适配；图表不依赖 hover 读取核心数值。
- 默认建议：中文、美元、北京时间，80%／90%／100% 预警。底层按各产品真实周期和 UTC 边界计算。
- 用实际 D1 `rows_read`／`rows_written` 和查询计划验证读写优化；本地测量与线上计费 CPU 分开报告。
- 当前目录为空，没有已有组件、Git 历史或配置可以假设复用。开发开始时再核对目录变化；不覆盖后来出现的文件。

## Review Focus

1. 成功空对象、错误来源的空数组、正常无记录、明确零值：不能都归成零；由任务 1、3、6 的来源完整性测试约束。
2. 网络超时、429、5xx、401／403、部分成功：卡片仍在，成功值保留，错误不误判为永久不可用；由任务 3、5、9 测试约束。
3. 自然月、订阅账期、每日额度、容量与 GB-month：不能混算、重置错误或用瞬时容量算账期费用；由任务 4、6 测试约束。
4. Token 替换、账户不一致、旧请求迟到、账期切换：不泄露明文、不跨账户合并、不让旧配置或旧周期结果污染当前结果；由任务 2、3、9 测试约束。
5. 阶梯／舍入／超额边界、无免费额度、Free 超限阻断、同一 meter 多来源：不能重复收费或显示虚假的总额；由任务 4、6、9 测试约束。

## 阶段与交付门槛

| 阶段 | 任务 | 可验收交付物 |
| --- | --- | --- |
| A：数据与契约 | 1–4 | 产品／meter 覆盖表、稳定状态契约、加密设置、本地数据库、费用规则测试 |
| B：真实数据接入 | 5–6 | 两个 Token 的只读适配器、整账期校验、部分失败不丢卡片的最新快照 |
| C：本地界面 | 7–9 | 桌面／手机完整页面、动态额度图、网页 Token 设置、真实数据与演示状态 |
| D：本地验证与用户验收 | 10–11 | 本地访问地址、覆盖说明、浏览器验收记录、D1 和本地性能报告；用户调整页面 |
| E：确认后上线 | 12 | 用户确认记录、远程资源与发布、线上验证、版本及回滚说明 |

## 文件职责

```text
package.json / package-lock.json       运行与检查脚本、锁定依赖
vite.config.ts / wrangler.jsonc       本地 Worker／D1、静态资源与生产构建配置
components.json / tsconfig*.json      shadcn 与前后端类型配置
.gitignore / .dev.vars.example        排除密钥、运行数据和临时产物；无真实凭据
shared/dashboard.ts                   对前端公开的数据类型
shared/catalog.ts                     产品／指标身份与来源定义，不含凭据
worker/index.ts                       路由及结构化错误处理
worker/settings/{crypto,service}.ts   Token 加解密、校验、账户一致性和保存
worker/storage/repository.ts          D1 主键访问、版本控制、最新状态存取
worker/metrics/{state,periods}.ts      可见性、测量结果合并、周期边界
worker/cloudflare/{client,discovery}.ts API 调用、来源审查和权限归因
worker/cloudflare/adapters/*.ts        按产品家族实现统计适配
worker/billing/{catalog,calculate}.ts  有来源的规则与费用计算
worker/refresh.ts                     一次刷新编排，不含常驻后台任务
src/app/{router,DashboardProvider}.tsx 路由、唯一打开刷新、共享当前快照
src/pages/{Overview,Product,Settings}.tsx 页面与表单
src/components/{layout,quota,status}/*  导航、额度图、稳定卡片和失败状态
src/components/ui/* / src/styles/*    shadcn 原语及视觉令牌
migrations/0001_dashboard.sql          两张单例表，没有历史表
tests/{unit,worker,fixtures}/*         计费／状态／加密／D1／适配器测试
docs/coverage/*                       产品与 meter 核查证据、覆盖结论
docs/design/*                         桌面／手机概念与视觉规范
docs/acceptance/*                     本地页面与性能验收证据
docs/deployment.md                    仅在确认后执行的部署与回滚步骤
README.md                            本地启动、Token 保存与数据边界
```

适配器按产品家族拆分，每个文件处理一个清晰范围；不堆进单个 `App.tsx` 或巨型 API 文件。没有依据的价格和单位不进入可用规则。

---

### Task 1: 完成产品与计费维度登记，锁定数据契约

**Files:** Create `docs/coverage/cloudflare-products.md`, `docs/coverage/source-verification.md`, `shared/dashboard.ts`, `shared/catalog.ts`, `tests/unit/catalog.test.ts`, `tests/fixtures/discovery/*`; 为本任务建立最小 `package.json`、TypeScript 和 Vitest 配置。

**Interfaces:**
- 定义 `TokenKind = 'account' | 'user'`、`RefreshReason = 'open' | 'manual'`、`MetricStatus = 'ok' | 'no_records' | 'not_enabled' | 'error' | 'partial'`、`Visibility = 'visible' | 'excluded'`、`Coverage = 'complete' | 'partial' | 'unverified'`。
- 定义 `Period { kind: 'day' | 'calendar_month' | 'billing_cycle' | 'instant'; start: string | null; end: string | null; timeZone: 'UTC' }`、`Money { amount: string; currency: string; basis: 'reported' | 'estimated' }`。
- 定义 `MetricDefinition`（稳定 ID、productId、标签、单位、周期、来源、计费规则 ID）、`CapabilityDecision`（visibility、原因、证据时间）、`MetricObservation`（ID、状态、用量字符串或 null、包含额度或 null、Period、Coverage、来源与时间）、`MetricView`（definition、capability、当前 observation、最后成功 observation）。
- 定义 `DashboardSnapshot { revision; settingsRevision; attemptedAt; succeededAt; metrics: Record<string, MetricView>; costs }`；`costs` 包含固定费、已报告用量费、估算用量费、未计价项和完整性，禁止重复汇总同一 meter。

- [ ] 对照 Spec 第 4 节、账户订阅、官方价格目录和资源/API schema，逐项列出全部发现的产品和 meter，不因无记录或当前 Free 跳过。
- [ ] 写目录测试：指标 ID 唯一、每个发现的 meter 有审查行、单位／周期有来源、旧别名与新计量不会重复汇总；先运行确认失败。
- [ ] 建立共享类型和目录，输出每个 meter 的首选 Token、备用来源、额度与硬限制区别、保留期、完整账期支持及确定性。
- [ ] 重点完成 Images 托管分发的长账期替代来源核查；只有可证明覆盖整个适用周期时才纳入完整账期计算；不以保存历史或定时累计补洞。
- [ ] 为 Logpush 配置受限但用量可读、Builds 空对象、旧账单接口假空、Artifacts 管理事件分别记录实际判定依据。
- [ ] 将此前 2026-10-23 的脱敏核查事实整理成持久文档，明确日期；不依赖 `/private/tmp` 文件长期存在。
- [ ] 运行 `npm run test:unit -- tests/unit/catalog.test.ts` 和 `npm run typecheck`；所有产品有审查结论，未知项明确为未证实，不标成“全部覆盖”。

**交付检查：** 覆盖表可以逐项追溯到来源；正常无记录与真正不可获取分别标识。此任务的审查会随后续真实适配器证据更新，不允许遗留无理由的空行。

### Task 2: 本地 D1 和网页 Token 配置后端

**Files:** Create `migrations/0001_dashboard.sql`, `worker/storage/repository.ts`, `worker/settings/crypto.ts`, `worker/settings/service.ts`, `worker/index.ts`, `wrangler.jsonc`, `vite.config.ts`, `.gitignore`, `.dev.vars.example`, `tests/worker/settings.test.ts`, `tests/worker/storage.test.ts`。

**Interfaces:**
- `encryptToken(plaintext: string, masterKey: CryptoKey): Promise<EncryptedToken>`；`decryptToken(ciphertext: EncryptedToken, masterKey: CryptoKey): Promise<string>`，`EncryptedToken` 包含版本、随机 nonce、密文。
- `getPublicSettings(env): Promise<PublicSettings>`；`saveCredential(kind: TokenKind, plaintext: string, env): Promise<PublicSettings>`；`deleteCredential(kind: TokenKind, env): Promise<PublicSettings>`。`PublicSettings` 只有账户标识、版本、配置状态、验证时间和尾号。
- Repository 提供 `readSettings()`、`writeSettings(next, expectedRevision)`、`readSnapshot()`、`writeSnapshot(next, expectedRevision)`；绑定类型由 Wrangler 生成，不手写 `Env`。

- [ ] 写测试并先确认失败：两个 Token 独立保存／删除；账户不一致或验证失败不覆盖已保存配置；返回值和错误中没有 Token 明文。
- [ ] 写加密测试：相同 Token 两次保存使用不同 nonce，正确密钥可解密，错误密钥明确失败，D1 原始值不是明文。
- [ ] 创建两张整数主键单例表 `dashboard_settings`、`dashboard_state`；无历史表、无二级索引；设置保存和刷新数据写入分别归属对应表。
- [ ] 配置本地 D1，不启用 `remote` binding；生成随机本地主密钥至被忽略的 `.dev.vars`，示例文件仅列变量名。
- [ ] 实现同源配置 API、输入校验、账户一致性和带版本的保存；基础错误响应只返回脱敏信息。主密钥缺失或密文无效时提供可操作错误，不能当作未配置静默覆盖。
- [ ] 用本地 D1 执行迁移，生成 Worker 类型，运行 `npm run test:worker -- tests/worker/settings.test.ts tests/worker/storage.test.ts`、`npm run typecheck`。

**交付检查：** 设置可通过 API 验证、保存和重启后读取；仅使用本地数据库。开发用完整 Token 只能通过设置入口传入，不复制进环境示例或测试 fixture。

### Task 3: 指标可见性、部分失败和最新快照合并

**Files:** Create `worker/metrics/state.ts`, `tests/unit/metric-state.test.ts`, `tests/worker/snapshot.test.ts`；扩展 `worker/storage/repository.ts`。

**Interfaces:**
- `applyObservations(previous: DashboardSnapshot, observations: MetricObservation[], attemptedAt: string, settingsRevision: number): DashboardSnapshot`。
- `applyCapabilityAudit(previous, decisions: CapabilityDecision[]): CapabilityRegistry`；普通 observation 合并无权修改可见性。

- [ ] 写状态测试并先确认失败：成功 → 超时 → 成功，指标 ID 和排序不变；成功无记录保留；明确零值为 0；失败且从未成功显示 null；失败不覆盖上次成功值。
- [ ] 写覆盖边界测试：HTTP 200 空对象、GraphQL errors、截断分页、部分时间窗口不能误判成完整无记录。
- [ ] 写账期切换和并发测试：上一周期成功值不会被用于本周期费用／比例；Token 轮换后的旧请求不能写入新配置；两个刷新交叠不能回退较新的成功结果。
- [ ] 实现独立可见性登记、每指标成功值与本次状态、带 revision 的快照合并；冲突只做有界重读合并，不引入锁表、后台线程或轮询。
- [ ] 运行 `npm run test:unit -- tests/unit/metric-state.test.ts` 和 `npm run test:worker -- tests/worker/snapshot.test.ts`。

**交付检查：** 普通刷新绝不依据空值过滤卡片；完整能力核查才可改变目录，失败状态与数据时间可以在 API 中明确区分。

### Task 4: 周期、额度和费用计算内核

**Files:** Create `worker/metrics/periods.ts`, `worker/billing/catalog.ts`, `worker/billing/calculate.ts`, `tests/unit/periods.test.ts`, `tests/unit/billing.test.ts`, `tests/fixtures/pricing/*`。

**Interfaces:**
- `resolvePeriod(rule: PeriodRule, billing: BillingContext, now: Date): Period`。
- `calculateMeterCost(metric: MetricObservation, rule: PricingRule, reported?: ReportedCharge): MeterCost`。
- `summarizeCosts(costs: MeterCost[], subscriptions: SubscriptionCharge[]): CostSummary`；未计价项不能被转换成 $0，reported 与 estimate 对相同 meter 不叠加。
- `deriveQuotaDisplay(metric: MetricObservation): QuotaDisplay`，百分比 nullable，超额数量非负，未知值不参与正常额度排序。

- [ ] 依据每个官方规则写精确边界测试并确认失败：0、低于额度、恰好 100%、超过额度、没有包含额度、Free 超额被限制、按单位取整、阶梯价格。
- [ ] 写周期测试：UTC 每日重置、自然月、账户订阅锚点、28／29／30／31 天、升级后的有效区间；不把当前 Paid 价格追溯套用到整个旧 Free 区间。
- [ ] 写单位与汇总测试：CPU 微秒到毫秒、存储字节与 GB-month 区别、R2 A/B/IA/取回、DO 后端、Browser 时间／并发、同一计费维度多来源去重。
- [ ] 实现十进制金额计算与必要的无损数量解码，覆盖超出 JS 安全整数范围的输入；价格规则逐项带来源和核实日期。
- [ ] 运行 `npm run test:unit -- tests/unit/periods.test.ts tests/unit/billing.test.ts`；每条纳入计算的规则均有对应实例，不仅测试“统一减额度乘单价”。

**交付检查：** 费用计算输出来源、适用区间和估算标记；税费／折扣／合同价缺失不伪装成最终发票金额。

### Task 5: Workers 与存储类真实只读适配器

**Files:** Create `worker/cloudflare/client.ts`, `worker/cloudflare/discovery.ts`, `worker/cloudflare/adapters/workers.ts`, `worker/cloudflare/adapters/d1.ts`, `worker/cloudflare/adapters/durable-objects.ts`, `worker/cloudflare/adapters/kv.ts`, `worker/cloudflare/adapters/r2.ts`, `tests/worker/cloudflare-core.test.ts`, `tests/fixtures/cloudflare/core/*`。

**Interfaces:**
- `CloudflareReadClient` 仅暴露 GET 与 GraphQL query，POST 用于读取查询，不允许业务 mutation。
- `ProductAdapter { productId: string; collect(context: CollectContext): Promise<MetricObservation[]> }`；`CollectContext` 携带已解密 Token、账户、账期、请求时刻、来源能力和共享读取结果。
- `discoverCapabilities(context): Promise<CapabilityDecision[]>` 结合实际响应、文档和备用来源，不按状态码一刀切。

- [ ] 为来源路由写测试并确认失败：Builds 用户级 Token、Logpush 仅配置受限、普通 403 不永久隐藏、备用来源成功、429／超时有界处理。
- [ ] 为分页、GraphQL 部分错误、统计完整性、资源 0 个但仍保留相关计量、已删除资源在本账期仍有用量写测试。
- [ ] 实现 Workers 请求与真实 CPU 总量、D1 扫描／写入／存储、DO compute 与两种存储后端、KV 五类计量、R2 各存储等级及操作类别；按源返回而非猜测平均值计算账单单位。
- [ ] 兼容统计按真实查询窗口分组；共享基础读取，使用有界并发、必要分页和明确超时；不在每次刷新重复全量 introspection。
- [ ] 通过本地 Worker 读取真实账户，和 Cloudflare 返回值逐项比对；用脱敏 fixture 测试错误，不改变真实资源、不制造消费。
- [ ] 运行 `npm run test:worker -- tests/worker/cloudflare-core.test.ts`，更新覆盖表中的用量、额度、来源和权限证据。

**交付检查：** 资源清单与账期用量分别检查；“现在没有资源”不能用来抹去此前发生的账期费用。

### Task 6: 其余产品、账单优先来源和一次刷新编排

**Files:** Create `worker/cloudflare/adapters/{compute,ai,media,network,subscriptions}.ts`（必要时按单产品再拆分）、`worker/refresh.ts`, `tests/worker/cloudflare-products.test.ts`, `tests/worker/refresh.test.ts`, `tests/fixtures/cloudflare/products/*`；更新覆盖文档。

**Interfaces:**
- 其余适配器实现任务 5 的 `ProductAdapter`，只能产出任务 1 已定义的 meter，新增 meter 先补登记。
- `refreshDashboard(reason: RefreshReason, env): Promise<DashboardSnapshot>`：读取配置及旧快照 → 收集 → 规范化与算费 → 合并 → 保存最新状态 → 返回；成功部分不因其他产品失败而丢失。
- `GET /api/bootstrap` 返回 `BootstrapResponse { settings: PublicSettings; capabilities; snapshot: DashboardSnapshot | null }`，`POST /api/refresh` 返回同一快照契约。

- [ ] 依覆盖表为 Builds／Logs／Queues／Workflows／Containers／Hyperdrive／Vectorize／Pipelines／AI／Browser／Artifacts／Email 等建立来源测试，媒体和网络／订阅产品分别提供有效来源或可追溯排除结论。
- [ ] 写 Images 转换／托管分发／存储互不混算、Stream 播放／存储分开、Argo 未开通、Secrets Store 明确 0/100、Artifacts 管理事件不直接算仓库费用的测试。
- [ ] 写账单优先、账单延迟与统计差异、累计接口覆盖写入而非反复求和、时间范围不足及新旧价格重叠不重复记费的测试，并先确认失败。
- [ ] 实现其余适配器和刷新编排；新增产品的硬容量限制、套餐固定费、一次性／续费项目按其真实口径展示，不强行转换成包含额度百分比。
- [ ] 校验并闭合 Task 1 覆盖表：每个发现的产品和 meter 都有实现、明确未开通、正确无记录或证实不可读的结论；有缺口时保持可见的不完整状态或有证据排除，不能宣称全部成功。
- [ ] 运行 `npm run test:worker -- tests/worker/cloudflare-products.test.ts tests/worker/refresh.test.ts`，在本地真实刷新一次核对结果。

**交付检查：** 无 Token 时引导配置；有 Token 时产生真实、可溯源的最新快照；常规刷新不新增历史行或后台任务。

### Task 7: 完整视觉基线与响应式页面框架

**Files:** Create `docs/design/{visual-brief,design-system}.md` 及对应概念图，`components.json`, `src/app/router.tsx`, `src/components/layout/*`, `src/components/ui/*`, `src/pages/{Overview,Product,Settings}.tsx`, `src/styles/{tokens,globals}.css`。

**Interfaces:** 页面消费 `DashboardSnapshot` 与公开设置，不在组件内保存 API Token 或拼接 Cloudflare 请求；`ProductPage` 以稳定 `productId` 选取数据。

- [ ] 按 frontend-app-builder 与 data-visualization 的适用流程，生成桌面总览、Workers 详情、设置和手机状态的完整视觉参考；使用明确标注的示例数值，不添加历史／预测区块。
- [ ] 提取浅色底、Cloudflare 风格点缀色、文字层级、间距、边框、图标、当前状态图和动效规范；没有杂乱全屏卡片墙，也没有把所有产品额度挤在一个页面。
- [ ] 建立 React + Vite + shadcn 页面壳、侧栏／手机抽屉、产品分组路由、总览和设置布局；测试范围只覆盖关键行为，不为纯装饰样式写同构单测。
- [ ] 配置静态资源优先，仅 `/api/*` 进入 Worker，SPA 路由在本地与生产构建中一致。
- [ ] 运行 `npm run dev`，用 Browser/IAB 查看桌面、390px 手机和 360px 窄屏；确认导航可用、文本可读、无横向溢出。

**交付检查：** 所有主要页面与手机形态已存在，交互元素为真实组件；概念稿仅是视觉参考，本地可交互页面才是用户验收对象。

### Task 8: 剩余额度图、预警与稳定状态组件

**Files:** Create `src/components/quota/{QuotaRing,QuotaBar,MetricPanel}.tsx`, `src/components/status/{RefreshStatus,MetricStatus,CostSummary}.tsx`, `tests/unit/quota-display.test.ts`。

**Interfaces:** `QuotaRing`／`QuotaBar` 只消费任务 4 的 `QuotaDisplay`；`MetricPanel` 消费 `MetricView`，React key 始终使用稳定 metric ID。

- [ ] 测试显示推导：0%、80%、90%、100%、超过 100%、额度为 0／无限／未知、范围不足、失败后的旧数据；确认未知不显示为 0% 或满余额。
- [ ] 实现数值、单位、周期与图形直接标签；超额圆环填满但保留实际百分比和超出量，费用与硬性限制使用不同文案。
- [ ] 添加进入、数据更新过渡、按钮／导航反馈、预警强调；页面隐藏／离屏暂停，`prefers-reduced-motion` 保留完整静态信息。
- [ ] 确保临时失败卡片不消失、不乱序；最后成功时间与失败状态在手机上也可读，核心信息无需 hover。
- [ ] 运行 `npm run test:unit -- tests/unit/quota-display.test.ts`，用独立演示场景浏览正常、接近额度、超额、无记录和短暂失败状态。

**交付检查：** 图表表达真实当前额度，不产生虚假趋势或持续随机波动；动效不触发 API 请求。

### Task 9: 网页 Token 表单与唯一刷新控制器

**Files:** Create `src/app/DashboardProvider.tsx`, `src/lib/api.ts`, `src/pages/Settings.tsx` 的业务部分、`tests/unit/refresh-controller.test.ts`；将总览与产品页接入真实 API。

**Interfaces:** 根级状态提供 `bootstrap()`、`refresh(reason: RefreshReason)`、`saveToken(kind, value)`、`clearToken(kind)` 和 `recheckCapabilities()`；内部导航仅读取共享快照。

- [ ] 写控制器测试并先确认失败：一次页面打开只触发一次 refresh；开发模式重复挂载不重复；快速连点合并；内部导航、窗口聚焦、网络重连和经过任意时间都不自动发起第二次刷新。
- [ ] 实现先展示上次结果、再获取一次真实更新；按钮 loading、逐项失败和刷新完成状态明确；普通刷新不会从可见清单中过滤失败指标。
- [ ] 完成两个 Token 的独立输入、验证保存、替换、删除、脱敏状态和账户一致性提示；成功保存后清空输入值，不写 LocalStorage／SessionStorage，不回显完整值。
- [ ] 设置页提供主动能力核查入口，说明它与刷新不同；一次普通请求的网络失败不改变能力登记。
- [ ] 联调真实数据和两类 Token；用错误 fixture 验证账期切换、旧请求迟到、无 Token、无记录、部分失败、指标范围不足；演示入口与真实模式明确分离。
- [ ] 运行 `npm run test:unit -- tests/unit/refresh-controller.test.ts`，并通过 Browser/IAB 完整操作打开、切页、手动刷新、保存和清除 Token。

**交付检查：** 设置可保存并重启后使用；正常用量与异常状态都可本地交互验证；页面不存在隐式刷新计时器。

### Task 10: D1、Worker 与前端性能验证

**Files:** Create `tests/worker/database-cost.test.ts`, `scripts/measure-local.ts`, `docs/acceptance/local-performance.md`；按测量结果修改存储、刷新和图表代码。

**Interfaces:** 本地测量输出脱敏 `Measurement { scenario; apiCalls; requestBytes; responseBytes; rowsRead; rowsWritten; elapsedMs; environment }`；仅在测试／开发模式启用诊断，不向生产公开凭据或测试入口。

- [ ] 对打开网页、手动刷新、内容不变、单产品失败、Token 保存／清除、内部导航和静态资源访问建立可重复样本。
- [ ] 采集每条 D1 操作的实际 meta 行数与合计；用 `EXPLAIN QUERY PLAN` 确认整数主键点查，不把返回一行等同扫描一行。
- [ ] 检查新开页面会读取配置／快照并真实更新，内部切页不额外读取 D1，静态资源不调用数据库；失败仅保存必要状态，不新增历史行。
- [ ] 测量 API 调用量、重复解密／计算、JSON 体积和存储写入；取消重复查询、无意义更新和冗余序列化，必要时才拆分单例快照。
- [ ] 检查静态资源不进 Worker、图表不整页重绘、路由／图表按需加载、不可见动画暂停；记录本地 profile 的观测范围，不写成生产计费 CPU。
- [ ] 运行 `npm run test:worker -- tests/worker/database-cost.test.ts`、`npm run measure:local`；报告场景、样本与实测数字，未经测量不承诺固定行数或 $0 运行成本。

**交付检查：** 本地性能报告包含实际扫描／写入行数、查询计划和优化前后依据；数据库规模不会随刷新次数增长。

### Task 11: 本地整体验收，交给用户确认页面

**Files:** Create `docs/acceptance/local-page-review.md`, `docs/acceptance/coverage-summary.md`, `README.md`, `docs/deployment.md`；仅保留正式验收所需截图，移除临时调试产物。

**Interfaces:** 此任务输出一个可持续访问的本地 URL、验收记录和待调整项，不输出已上线结论。

- [ ] 运行 `npm run typecheck`、`npm run lint`、`npm run test:unit`、`npm run test:worker`、`npm run build`、`npm run deploy:dry-run`；dry-run 只验证构建，不创建远程资源。
- [ ] 用 Browser/IAB 测试桌面 1440px、手机 390px 和窄屏 360px；只有工具不可用／不可靠时使用 Playwright，并记录原因。
- [ ] 逐项操作总览、每个可见产品页、Token 设置、手动刷新、刷新失败兜底；验证没有历史、预测、外部通知或定时刷新。
- [ ] 将最新浏览器截图与视觉基线用 `view_image` 对照，检查布局、文字、配色、图表、间距、图标及手机导航；修复可见问题后再交付。
- [ ] 用独立示例模式验证 80%／90%／100%／超额和断网状态，明确模拟标识，不用真实消费制造超额。
- [ ] 更新每个产品／meter 的实现和可读性结论、隐藏原因、实际金额与估算范围；不把构建通过当作真实数据或视觉验收通过。
- [ ] 交给用户本地地址、页面截图、覆盖摘要和性能报告，按用户意见调整本地页面；记录用户明确确认的版本。

**阶段硬门槛：** 用户确认本地页面之前，任务 12 不执行。用户反馈仍在本地修改并只重跑受影响检查，不反复重做全部核查。

### Task 12: 用户确认后部署与线上复核

**Files:** Modify `wrangler.jsonc`, `docs/deployment.md`；Create `docs/acceptance/production-review.md`。

**Interfaces:** 消费任务 11 的明确页面确认、已通过的本地构建和现有部署授权；不让两个只读监控 Token 升权。

- [ ] 核实用户已经确认本地页面，记录确认范围；先检查现有 OAuth／Wrangler 授权和目标账户。默认使用 `workers.dev`，用户指定域名时再配置其指定域名。
- [ ] 上线前再次核实套餐、当前价格和已发现的来源边界；变动影响费用或展示时先更新本地结果和说明。
- [ ] 使用部署权限创建本项目独立 D1，应用已验证迁移；配置生产随机加密主密钥为 Worker Secret，隔离本地库与密钥。
- [ ] 运行构建和 dry-run，确认无凭据／演示数据／测试接口进入生产；再部署已验收构建。不开启自动发布或 Cron。
- [ ] 通过生产网页配置两个只读 Token，验证保存、重启后的使用及同账户校验；不直接复制本地密文到另一密钥的数据库。
- [ ] 在线验证静态路由、产品页直达、真实刷新、手动按钮、失败卡片稳定、账期与费用口径、手机布局；核对线上 D1 行数和生产 CPU，标明监控数据的延迟与样本范围。
- [ ] 交付 URL、部署版本、资源标识、线上验证结果、剩余限制与回滚说明。若生产检查失败，按已准备的回滚／修复步骤处理，不把“发布成功”当作验收完成。

## 统一命令与执行说明

任务 1–2 建立下列脚本契约，具体依赖版本按当时稳定兼容版本锁定：

| 脚本 | 目的 |
| --- | --- |
| `npm run dev` | 本地 Vite + Worker + 本地 D1 |
| `npm run typecheck` | 前后端类型检查及生成 binding 一致性 |
| `npm run lint` | 语法与必要的异步错误检查 |
| `npm run test:unit -- <file>` | 纯函数／状态／金额与目录测试 |
| `npm run test:worker -- <file>` | Workers runtime 与本地 D1 测试 |
| `npm run build` | 生产构建，不部署 |
| `npm run deploy:dry-run` | Wrangler dry-run，只验证产物 |
| `npm run measure:local` | 可重复的本地接口／D1 成本样本 |

使用本地 D1 的迁移命令在执行时对照已安装 Wrangler v4+ 文档与 schema 核实；所有远程 `create`、`--remote` 迁移、Secret 写入和 `deploy` 只属于任务 12。当前已观测本机 Node v26.12.1、npm 11.20.0；依赖兼容性仍须在初始化时检查。

本计划建议由主代理在当前会话按任务顺序实施，避免为紧密关联的契约和状态逻辑反复切换上下文；本轮只有设计输入的独立检查，不自动启动开发代理。若后续用户选择并行实现，再按对应技能隔离任务并审查。每项通过相关验证后记录完成情况；若已建立 Git 仓库，提交仅限该项变更，不自动推送远程。

## 自审结果（计划阶段）

- 已覆盖用户的页面、Token、稳定指标、无历史／无定时、动态剩余量、费用、CPU／D1 和确认后部署要求。
- 五项 Review Focus 均映射到具体任务的行为测试，不为纯装饰或实现细节堆测试。
- 共享契约先于适配器与页面，费用计算与单位／周期不散落在组件中。
- 全部任务为待执行；本文中的命令、性能值和验收步骤不代表已经运行或通过。
- 需求基线已做一次独立 Builder check，结果为 `nothing important left`；不替代后续代码、数据或页面验收。
