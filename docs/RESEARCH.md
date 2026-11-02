# Keywords Everywhere 研究与 SEOanalysis 产品取舍

研究日期：2026-10-28

## 1. 研究来源

### 官方资料

- Keywords Everywhere 定价页：<https://keywordseverywhere.com/ctl/subscriptions>
- 免费/付费功能总览：<https://keywordseverywhere.com/start.html>
- Chrome Web Store 产品页：<https://chromewebstore.google.com/detail/keywords-everywhere-keywo/hbapdpeemoojbophdfndmlgdhppljgmp>
- Chrome Web Store 评价页：<https://chromewebstore.google.com/detail/keywords-everywhere-keywo/hbapdpeemoojbophdfndmlgdhppljgmp/reviews?hl=en>

### 官方页面观察到的事实

- 商店页在 2026-10-28 显示版本 `11.56`、约 `1,000,000 users`、`3.3/5`、约 `5.7K ratings`。
- 免费版已经包含网站流量、SEO 指标、关键词 widget、页面分析、Search Console 可视化等大量功能。
- 付费版增加精确搜索量、CPC、竞争度和 12 个月趋势，覆盖 Google Search、Search Console、Analytics、Keyword Planner、YouTube、Amazon、eBay、Etsy、Bing 等。
- 当前商业方案按年计费：Bronze `$84/年`、Silver `$168/年`、Gold `$480/年`、Platinum `$1,440/年`。
- 定价页明确说明 `1 credit = 1 keyword`。搜索页上的主查询、Related、PASF、Long-tail 会分别消耗 credit；例如 1 个主查询 + 20 个 PASF + 8 个 Related 会消耗 29 credits。
- 官方说明 credits 一年过期，余额用完后会停止展示 volume、CPC 和 competition。

## 2. 用户痛点归纳

以下不是针对个别评论做事实判定，而是从近期公开评价中归纳反复出现的产品体验问题。

### P1：免费版能“装”，但很难完成核心任务

商店近期评价多次出现：

- “The FREE version doesn't appear to exist and everything I tried said I had zero credits and needed to pay.”
- “This is NOT FREE unless you have a paid subscription.”
- “free version is useless.”

官方确实提供大量免费功能，但核心搜索量仍然依赖付费额度。新用户在第一分钟最容易把产品理解成“免费但看不到关键数据”。

SEOanalysis 取舍：

- 免费版第一次搜索就显示可用的本地估算。
- 数据来源固定显示为“本地估算”，不伪装成精确值。
- 核心四指标全部留在免费版，只把精确值、趋势、相关扩展和导出放到 Pro。

### P2：额度消耗不透明，日常搜索容易“烧 credits”

官方定价页把 credit 规则写得清楚，但用户仍需理解每个 widget、每条 suggestion 和每个批量导入分别消耗多少。近期评价出现：

- “you'll BURN your credits FAST.”
- 价格上涨后感到被锁定。

SEOanalysis 取舍：

- 免费版使用简单的每日次数，不引入 credit 心智。
- 每次分析只发生一次扣减。
- 卡片、popup、设置页都显示今日剩余次数。
- Pro 基于用户自己的数据源，不抽取不透明的“关键词 credit”。

### P3：数据准确性与地区维度不稳定

公开评价提到：

- 在 Keyword Planner 明显有量的词返回 `0/mo`。
- Google Trends 缺少用户需要的国家细分。
- 部分数据与实际不符。

SEOanalysis 取舍：

- 免费模式明确说明是模型估算，不以“准确搜索量”宣传。
- 精确模式显示上游名称 `DataForSEO`，不把上游错误包装成自有数据。
- 用户可切换地区，结果与地区一起展示。
- API 失败时展示回退提示，不静默用 0 或旧值顶替。

### P4：功能堆叠与页面打断

产品覆盖 15+ 网站、社媒、AI prompts、报告和本地 SEO。能力很全，但结果页容易同时出现多个 widget。近期中文评价也提到 Google Images 会覆盖插件内容。

SEOanalysis 取舍：

- SERP 只保留一张横向卡片，插入搜索结果列表之前，不悬浮覆盖。
- 核心视图只展示四个决策指标。
- 趋势与相关机会按需展开。
- 设置页集中管理地区、数据源和紧凑模式。

### P5：客服与订阅体验

公开评价中存在：

- 数据异常反馈数月未获回复。
- 订阅自动续费/取消通知混乱。
- 价格变化与使用成本沟通不足。

SEOanalysis 取舍：

- 设置页提供数据导出与清空缓存。
- 所有核心数据保存在本地，用户可随时带走收藏和历史。
- 当前版本不收集账号体系数据。
- 正式商业化时应增加明确续费提醒、取消入口和服务等级说明，而不是把订阅状态隐藏在插件菜单中。

## 3. 竞品强项与保留能力

Keywords Everywhere 的成功并不只是“显示搜索量”，还有：

- 在用户已有工作流中显示数据。
- 覆盖多个搜索入口。
- 用相关词和 PASF 扩展研究路径。
- 提供批量导入、趋势和竞品分析。

SEOanalysis 不尝试第一版就复刻全部 SEO 套件。第一版刻意保留：

- SERP 内嵌。
- 主词的量、竞争、CPC、机会判断。
- 搜索意图。
- 地区切换。
- 相关长尾机会。
- 收藏与历史。

暂不做：

- Rank Tracker。
- Search Console 全量可视化。
- 社媒指标集合。
- 自建关键词数据库。
- 生成式 AI 报告。

## 4. 免费与 Pro 边界

| 能力 | Free | Pro |
| --- | --- | --- |
| SERP 卡片与核心四指标 | 有 | 有 |
| 本地估算 | 有 | 有 |
| 每日分析次数 | 30 | 不限 |
| 地区 | 6 个 | 6 个 |
| 收藏上限 | 20 | 不限 |
| 12 个月趋势 | 锁定 | 有 |
| 相关机会 | 锁定 | 有 |
| DataForSEO 精确数据 | 不支持 | 支持 |
| CSV 导出 | 不支持 | 支持 |

这个边界的原则是：免费版解决“这个词值不值得继续看”，Pro 解决“我要把这个判断带进日常工作流”。

## 5. 商业化建议

仓库内的 7 天试用是本地产品演示，不是生产级授权。正式上线时应采用：

- 月度订阅，避免只能年付的摩擦。
- 明确的 Pro 价格，例如 `$9/月` 或 `¥49/月`，在购买前展示功能差异。
- 服务端许可证或签名 token，避免仅靠本地开关。
- 取消与续费提醒。
- DataForSEO 由用户自带账号，降低转售额度和价格变化的信任成本。
- 如果后续做托管数据，必须逐次显示本次消耗，并提供余额预警。

## 6. 设计结论

Keywords Everywhere 的主要机会不是继续增加 widget，而是减少认知负担和信任成本。SEOanalysis 的产品承诺应保持为：

> 一个关键词，一眼判断。数据来源、额度和边界始终可见。

这个承诺比“功能更多”更适合当前市场，也更容易在搜索结果页维持干净、可重复的工作体验。
