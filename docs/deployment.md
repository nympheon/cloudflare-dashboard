# 部署到 Cloudflare Workers

当前版本已在本地验证，尚未完成生产部署与线上验收。以下步骤供自行部署时执行；推送 GitHub 不会自动发布 Worker。生产操作应在确认本地页面、目标账户和来源覆盖边界后进行。

## 先保护访问入口

项目没有内置登录，浏览页面和调用 `/api/*` 共用同一个账户配置。未经访问保护的远程实例会暴露账户用量，并允许他人调用配置和刷新接口。加密存储与同源检查都不能代替身份认证。

使用 Cloudflare Access 或等效机制保护整站，只允许自己的身份访问。检查生产域名、`workers.dev`、版本 URL 与预览 URL，逐一保护或禁用旁路入口；从未登录的浏览器确认主页和 `/api/bootstrap` 均不能直接访问后，再保存真实监控 Token。

Cloudflare 当前支持对 `workers.dev`、版本和预览 URL 配置 Access，参见 [管理 workers.dev 的访问](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#manage-access-to-workersdev)。访问保护须在部署账户上实际配置，本仓库不会自动创建 Access 策略。

## 1. 准备部署授权与 D1

监控凭据保持只读。使用独立的 Wrangler OAuth 或部署凭据管理云资源，不要给页面中的监控 Token 增加写权限。

```sh
node scripts/run-local.mjs wrangler login
node scripts/run-local.mjs wrangler whoami
node scripts/run-local.mjs wrangler d1 create cloudflare-pulse
```

将新数据库的名称和返回的 `database_id` 填入 `wrangler.jsonc` 的 `d1_databases[0]`，保留绑定名 `DB` 与 `migrations_dir`。仓库中的全零样式 ID 是本地占位值，不能用于生产。多账户部署时明确选择自己的目标账户。

```sh
node scripts/run-local.mjs wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

不要把本地 `.wrangler/`、现有密文、真实数据库导出或账户配置提交到公开仓库。若维护公共分支，保留通用模板，不发布自己的资源配置。

## 2. 配置生产主密钥

用可信密码管理器生成独立的 **32 字节随机十六进制密钥（64 个十六进制字符）**，交互输入到 Secret 提示中，不把真实值写进命令行参数、README 或 Git。

```sh
node scripts/run-local.mjs wrangler secret put TOKEN_ENCRYPTION_KEY --config wrangler.jsonc
```

Secret 必须属于最终发布的同名 Worker。生产与本地使用不同主密钥，并妥善备份。不要把本地密文复制进使用不同密钥的生产库；轮换主密钥后需重新保存两个监控 Token。

## 3. 检查并发布

修改配置后重新生成类型，再运行检查：

```sh
npm run generate:types
npm run typecheck
npm run lint
npm run test:unit
npm run test:worker
npm run build
npm run deploy:dry-run
```

检查 `dist/` 中没有 `.dev.vars`、真实 Token、主密钥和演示 fixture。Vite 构建会生成部署配置，发布前必须重新构建，使数据库和资源绑定与本次配置一致。

以下命令会实际发布远程资源：

```sh
node scripts/run-local.mjs wrangler deploy
```

先配置并验证整站访问保护，再通过生产 `/settings` 保存两个只读监控 Token。不要为了配置方便，临时把带有真实数据的站点开放给所有访问者。

## 4. 线上验收与回滚

- 未登录访问整站和 API 被拦截；所有已启用的域名、版本与预览入口受保护。
- 登录后能保存凭据、真实刷新、直达产品路由，手机导航和设置页可用。
- 断网或单个来源失败保留原数据与时间；周期和费用覆盖提示符合实际来源。
- 记录发布版本、访问地址、生产 CPU、D1 实际 meta 行数和数据延迟。发布命令成功不等于线上验收成功。

发布前记录已有版本（若有），出现问题时使用 Wrangler rollback 恢复已验证的 Worker 版本。首次发布没有上一版本时，先停用新入口并保留数据库用于排查。Worker 回滚不等于 D1 回滚；不要重置数据库或覆盖生产主密钥。

参考：[D1 入门](https://developers.cloudflare.com/d1/get-started/)、[Wrangler 命令](https://developers.cloudflare.com/workers/wrangler/commands/)、[Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。
