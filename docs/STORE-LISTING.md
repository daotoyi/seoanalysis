# Chrome Web Store 文案

## 名称

SEOanalysis — SERP Keyword Intelligence

## 简短描述

在 Google 搜索结果页直接查看搜索量、竞争度、CPC 与机会分。免费本地估算，Pro 解锁精确数据与趋势。

## 详细描述

每天查关键词，不必在搜索页和工具后台之间来回切换。

SEOanalysis 把关键词判断放回 Google 搜索结果页：

- 月搜索量
- 竞争度
- CPC
- 机会分
- 搜索意图
- 关键词难度

免费版即可使用，不需要 API key，分析在本地完成。

支持简体中文与 English，可在工作台或设置页随时切换。

Pro 增加：

- DataForSEO 精确搜索量
- 12 个月趋势
- 相关长尾机会
- 不限分析次数
- 不限收藏
- CSV 批量导出

数据来源始终可见。本地估算不会被标成精确搜索量；API 失败时会明确提示并回退，不会静默展示错误值。

适合 SEO、内容运营、独立站、跨境电商与增长团队做日常关键词初筛。

## 单一用途说明

在 Google 搜索结果页显示当前查询的关键词指标，并允许用户收藏和分析关键词。

## 权限说明

### `storage`

保存收藏、历史、额度、地区与用户主动填写的数据源凭据。数据保存在本机。

### `tabs`

读取当前标签页的 Google 搜索关键词，并在用户点击“工作台”时打开对应页面。

### `activeTab`

在用户主动打开扩展工作台时读取当前搜索页信息。

### Google Search host permissions

在 Google 搜索结果页注入关键词卡片。

### `https://api.dataforseo.com/*`

仅当用户选择 DataForSEO 并填写自己的凭据后，请求精确关键词数据。

## 隐私披露建议

- 不收集账号、联系信息、位置或浏览历史。
- 免费本地估算不发送关键词。
- DataForSEO 模式下，关键词发送给 DataForSEO，目的是获取用户请求的指标。
- DataForSEO 凭据保存在 `chrome.storage.local`。
- 收藏和历史保存在本机。
- 不向第三方出售数据。

## 商店截图顺序

1. `output/screenshots/google-serp.png`：SERP 内嵌与核心价值
2. `output/screenshots/popup-analysis-free.png`：免费工作台
3. `output/screenshots/popup-analysis-pro.png`：Pro 趋势与相关机会
4. `output/screenshots/options.png`：数据源与隐私透明度

## 提交前检查

- 将本地 Pro 试用替换为真实许可证校验。
- 提供可公开访问的隐私政策 URL。
- 确认 DataForSEO 的实际 API 字段与当前账号地区一致。
- 在真实登录态 Google 环境回归 20 个常见域名和 3 种结果页布局。
- 为搜索量增加 `估算` 与 `精确` 的 A/B 文案测试，降低误读。
