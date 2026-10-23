# 本地验证说明

公开版不包含真实账户的用量、账期、Token 尾号、设置截图或接口快照。原始本地验收材料已移出公开目录；下列内容描述验证范围与复现方法，不冒充新的真实账户验收结果。

## 自动检查

运行 npm run typecheck、npm run lint、npm run test:unit、npm run test:worker、npm run build、npm run deploy:dry-run。dry-run 只检查产物，不发布远程资源。

测试覆盖十进制金额、阈值、超额、部分数据、账单延迟、日/月/订阅周期、价格到期、套餐生效、加密、账户隔离、迟到请求、来源 Token 回退、零值推导、快照单例及 D1 meta 行数。

## 页面复现

| 场景          | 检查内容                                                |
| ------------- | ------------------------------------------------------- |
| 新开/重载页面 | bootstrap 与 refresh 各一次；已有结果先显示             |
| 内部导航      | 产品标题和卡片稳定，共用快照，无额外统计请求            |
| 手动刷新      | 更新数据时间，正常/部分失败独立合并                     |
| 断网与重连    | 保留原值和时间，恢复网络不自动重取，手动后恢复          |
| 双 Token      | 独立验证、保存、替换、清除、账户一致性与尾号回显        |
| 演示超额      | 数字可超过 100%，显示超出量和估算费用                   |
| 演示失败      | 保留最后成功值；没有成功值时显示 —                      |
| 响应式        | 桌面 1440px、手机 390px、窄屏 360px，检查横向溢出与抽屉 |
| 减少动态效果  | reduced-motion 下关闭过渡并保留数值                     |

开发演示地址：/products/workers?demo=overage 与 /products/workers?demo=error。页面明确标注演示，禁止保存真实 Token，演示 fixture 不进入生产客户端。

## 可公开的演示截图

- [使用总览](screenshots/overview-demo.png)：独立演示账户、核心资源额度与费用构成。
- [超额演示](screenshots/overage-demo.png)：125%、超出 250 万、示例估算 $0.75。
- [失败演示](screenshots/error-demo-mobile.png)：保留 620 万等合成值。

以上截图都来自独立演示模式，数字不代表任何真实账户。视觉概念见 [设计参考](../design/concept.png)。

性能复现见 [本地性能](local-performance.md)，适配边界见 [覆盖说明](coverage-summary.md)。生产 CPU、远程 D1、生产路由和线上端到端检查须在部署后另行验证。
