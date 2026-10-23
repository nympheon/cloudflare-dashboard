# 本地性能验证方法

运行 npm run measure:local，依次测量手动刷新、再次刷新和两个并发刷新。当前结果写入被 Git 忽略的 .private/acceptance/local-performance.json，不再写入公开文档目录。

记录实际 D1 rows_read/rows_written、来源调用数、响应体积和经过时间；并发场景检查是否只有一轮真实来源采集，后随请求应立即复用已有快照，不后台轮询。

Workers 集成测试通过 D1 meta 验证主键点查和单例快照；EXPLAIN QUERY PLAN 应使用 INTEGER PRIMARY KEY。两次必要写入分别获取刷新租约、保存最新结果并释放租约，不增加历史样本行。

新开页面只触发 bootstrap 和 refresh；内部产品导航复用当前快照；静态资源由 Static Assets 分发。经过时间包含 API 网络 I/O，不能当作生产计费 CPU。来源调用数及响应体积由使用者自己的账户和配置决定，公开仓库不包含实际账户测量记录。
