# Changelog

本项目从 Fuwari 迁移而来，用 Astro 重写。版本号按开发阶段划分，日期为实际完成时间。

## [1.0.1] - 2026-11-28

### Changed

- 放宽整体版心、收窄两侧栏：宽版容器 `1440px → 1600px`，左侧栏 `300px → 240px`，
  右侧目录 `250px → 224px`。1920 宽屏幕下正文行宽从约 760px 增加到约 1010px，
  1440 宽屏幕下也从约 700px 增加到约 790px，文章页信息密度更接近参考站。
- 右侧目录宽度不再写死在 `theme.css`，改由 `src/config.ts` 的 `layout.tocWidth` 注入 CSS 变量。

## [1.0.0] - 2026-11-16

上线版本。

### Added

- 首页首屏换成 Redefine 主题的经典背景图（`wallhaven-wqery6-light/dark`），保留固定背景 + 滚动模糊。
- 正文字体换成思源黑体（Noto Sans SC），标题保留 ChillRoundM 圆体；两个中文字体都按
  「站点用字 + GB2312 一级汉字」子集化到 3896 字，解决缺字回退导致的字形不一致。
- `CHANGELOG.md`；README 精简为单标题版本。

### Changed

- 首页文章卡片改用文章区同款卡片（实心底 + 阴影 + 编号 + 右侧缩略图）。
- 友链页改为平铺网格，去掉分组与「申请友链」卡片；页头去掉右上角说明文字。
- 文章区各页（列表、标签、归档、系列、分类、关于）页头统一为「小标 + 标题」，去掉右侧说明。
- 首页打字机文案改为 `Maybe every day will be better!`，单句时打完即停，不再循环删除。

### Fixed

- 移动端文章卡片文字不对齐：竖向排列时继承了 `align-items: center`，导致文字块按内容宽度居中；
  改为 `align-items: stretch` 并补回卡片内边距。
- 首页固定背景在滚动时出现「上半屏不模糊、下半屏模糊」的分界：压暗层原来放在会滚动的首屏里，
  改为固定在视口上的整屏层，越过阈值后整块背景一起模糊。
- 「继续阅读」卡片里残留的 `/categories/xx` 旧链接。

## [0.3.0] - 2026-11-15

### Added

- 从 Fuwari 迁移 23 篇文章（19 篇发布、4 篇草稿），保留原目录结构与 URL：
  `published → date`、`category → categories`、`image → cover`、相对图片转存 `public/images/posts/`。
- 站点配置迁移：标题、副标题、作者、头像、社交链接、`site.url`、主色（`hue: 250` → `#6952e0`）。
- 关于页（来自 `spec/about.md`）与 9 位友链。
- 部署支持：`vercel.json`（npm ci + astro build + dist）、构建期生成的 `robots.txt`。

### Changed

- 部署仓库 `MyBlog` 的工作区整体替换为本项目，移除旧的 pnpm / Biome CI 配置。

### Removed

- 4 篇演示文章与占位封面图。

## [0.2.0] - 2026-11-15

### Added

- 文章区 `/blog`：编号卡片列表、分类筛选 chips、分页。
- 标签索引（椭圆轨道标签云，按文章数缩放/倾斜/配色）、标签详情。
- 系列：`/blog/series`、`/blog/series/<名称>`，文章页显示「第 x / y 篇」并在侧栏列出同系列文章。
- 年份归档、分类详情，全部收进 `/blog` 下；旧地址（`/archive`、`/archives`、`/categories`、`/tags`）重定向。
- 构建期搜索索引 `search.json`（Ctrl/⌘ + K 唤起）、RSS、sitemap。
- 友链页：常读 / 网络两组卡片。
- 关于页、404 页改用与文章区一致的卡片语言。

## [0.1.0] - 2026-11-15

### Added

- 从 Astro 官方 starter 起步，用 Astro 7 + Tailwind v4 重写 Redefine 主题：
  玻璃拟态卡片、渐变导航栏、首页大图（fixed + 滚动模糊）、左侧栏、文章卡片列表。
- 文章详情：左侧栏 + 正文 + 右侧跟随目录、上下篇、相关推荐、版权卡片。
- 暗色模式（默认暗色，支持 `light`/`dark`/`auto`）、原生 View Transitions、
  阅读进度、图片查看器、代码复制、KaTeX、mermaid。
- 内容层：Content Collections + zod 校验、分页、标签/分类聚合、相关文章。
