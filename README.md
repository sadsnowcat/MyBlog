# Astro Redefine

snowcat 的个人博客（<https://sadsnowcat.com>）：用 [Astro](https://astro.build) 重写的
[Hexo Theme Redefine](https://github.com/evannotfound/hexo-theme-redefine) 风格主题，
内容从 Fuwari 迁移而来。

保留原主题的视觉语言（玻璃拟态卡片、渐变导航栏、首页大图、圆角/阴影体系），
但把模板、样式、内容层都换成了更好维护的形态：

| | 原主题（Hexo） | 本项目（Astro） |
| --- | --- | --- |
| 模板 | 53 个 EJS 文件 + Hexo 全局变量 | `.astro` 组件 + props / slots |
| 内容 | `source/_posts/*.md`，front-matter 无校验 | Content Collections + zod schema |
| 样式 | Stylus 变量 + Tailwind | Tailwind CSS v4 + CSS 变量设计令牌 |
| 单页过渡 | swup（pjax） | 原生 View Transitions（`ClientRouter`） |
| 搜索 | hexo-generator-searchdb + 前端检索 | 构建期 `search.json` + 客户端匹配 |
| 配置 | `_config.yml`（约 500 行） | `src/config.ts`（带类型与注释） |

## 快速开始

```bash
npm install
npm run dev        # http://localhost:4321
npm run check      # TypeScript / Astro 类型检查
npm run build      # 输出到 dist/
npm run preview    # 本地预览构建产物
```

> 开发服务器也可以用后台模式：`npx astro dev --background`，
> 配套命令是 `astro dev status | logs | stop`。

## 目录结构

```text
src/
├── config.ts             # 站点配置（相当于原主题的 _config.yml）
├── content.config.ts     # 内容集合 schema（front-matter 类型校验）
├── content/
│   ├── posts/            # 文章，一个 .md 一篇
│   └── pages/            # 独立页面（about 等）
├── layouts/
│   └── BaseLayout.astro  # <html>、导航、页脚、全局脚本、CSS 变量注入
├── components/           # Navbar / Sidebar / PostCard / Toc / SearchDialog …
│   └── content/          # 内容页组件（页头、分组导航、编号名片、标签云、分页）
├── pages/                # 路由文件，文件名即 URL
├── lib/                  # 数据查询（排序、分页、聚合、相关文章）与工具函数
├── scripts/site.ts       # 客户端交互（主题、目录、搜索、代码复制、mermaid…）
└── styles/
    ├── fonts.css         # @font-face（ChillRoundM 子集 + Monaco）
    ├── theme.css         # 设计令牌 + 全局样式 + 复用组件类
    ├── markdown.css      # 正文排版（只改这一个文件就能调正文观感）
    └── content.css       # 内容页的实心悬浮卡片（作用域：body.solid）
```

路由与页面：

| URL | 文件 | 说明 |
| --- | --- | --- |
| `/` | `pages/index.astro` | 首页（大图 + 文章卡片列表 + 侧栏） |
| `/page/N` | `pages/page/[page].astro` | 首页分页 |
| `/posts/<文件名>` | `pages/posts/[...slug].astro` | 文章详情（左侧栏 + 正文 + 右侧目录、版权、上下篇、相关推荐） |
| `/blog`、`/blog/page/N` | `pages/blog/*` | 文章区（编号卡片列表 + 分类筛选 + 分页） |
| `/blog/series`、`/blog/series/<系列>` | `pages/blog/series/*` | 系列总览 / 系列详情（按时间正序） |
| `/blog/tags` | `pages/blog/tags/index.astro` | 标签云（椭圆轨道 + 按数量缩放/倾斜/配色） |
| `/blog/tags/<标签>` | `pages/blog/tags/[tag].astro` | 标签详情 |
| `/blog/categories/<分类>` | `pages/blog/categories/[category].astro` | 分类详情 |
| `/blog/archives` | `pages/blog/archives.astro` | 按年份归档 |
| `/archives`、`/categories`、`/tags` | `astro.config.ts` | 旧地址重定向到 `/blog/*` |
| `/tags/<标签>` | `pages/tags/[tag].astro` | 静态跳转到 `/blog/tags/<标签>` |
| `/about` | `pages/about.astro` | 关于页（读取 `content/pages/about.md`） |
| `/friends` | `pages/friends.astro` | 友链（分组名片 + 申请面板） |
| `/search.json` | `pages/search.json.ts` | 搜索索引（构建期生成） |
| `/rss.xml` | `pages/rss.xml.ts` | RSS |
| `/404` | `pages/404.astro` | 404 |

## 写文章

在 `src/content/posts/` 下新建 `my-post.md`，URL 就是 `/posts/my-post`：

```yaml
---
title: 文章标题
date: 2024-11-08 10:20:00
updated: 2024-11-20 09:00:00     # 可选
description: 列表页和搜索里显示的摘要   # 可选，不填则截取正文
cover: /images/cover-1.svg       # 可选，列表页封面
tags: [Astro, 前端]
categories: [技术]
sticky: false                    # 置顶
draft: false                     # 草稿不会出现在任何页面
toc: true                        # 是否显示右侧目录
copyright: true                  # 是否显示版权卡片
---

正文用 Markdown 写。
```

支持的正文能力：

- **代码高亮**：Shiki 双主题（亮/暗自动切换），带语言标签与复制按钮；
- **数学公式**：行内 `$E=mc^2$`、块级 `$$ ... $$`（KaTeX）；
- **图表**：```` ```mermaid ```` 代码块，仅在出现图表时动态加载 mermaid；
- **图片**：自动圆角/阴影，点击放大；
- **表格、任务列表、脚注、引用**等 GFM 语法。

## 从 Fuwari 迁移

这个项目的内容是从一个 Fuwari 站点迁移过来的，字段对应关系：

| Fuwari（`src/content/posts/**.md`） | 本项目 | 说明 |
| --- | --- | --- |
| `published` | `date` | 日期对象 |
| `updated` | `updated` | 可选 |
| `category`（单个字符串） | `categories: [category]` | Fuwari 只能一个分类，这里统一成数组 |
| `image` | `cover` | 列表页封面 |
| `tags` | `tags` | 原样 |
| `draft` | `draft` | 草稿不会出现在任何页面 |
| `lang` | — | 站点单语言，忽略 |
| 文章里的相对图片 `![](./pic/x.png)` | `/images/posts/<目录>/pic/x.png` | 图片复制到 `public/`，路径改成绝对地址 |

文章路径保持 `src/content/posts/<目录>/<文件名>.md` → `/posts/<目录>/<文件名>/`，
和 Fuwari 的 URL 结构一致；注意 Astro 会把文件名小写化（`ISCC-heap.md` → `/posts/heap/iscc-heap/`）。

## 改配置

所有开关集中在 `src/config.ts`，改完保存即可（dev 下热更新）。
常用对照表：

| Redefine（YAML） | 本项目 | 说明 |
| --- | --- | --- |
| `info.title` / `subtitle` | `site.title` / `site.subtitle` | 站点标题 |
| `colors.primary` | `site.colors.primary` | 主题色 |
| `colors.default_mode` | `site.colors.defaultMode` | 首次访问配色：`'dark'`（当前默认）/`'light'`/`'auto'`（跟随系统）；访客手动切换过则以本地记录为准 |
| `global.content_max_width` | `site.layout.contentMaxWidth` | 内页（归档/分类/标签）内容宽度 |
| （新增） | `site.layout.contentMaxWidthWide` | 首页与文章页的宽版容器（默认 1440px） |
| `global.sidebar_width` | `site.layout.sidebarWidth` | 侧栏宽度（默认 300px） |
| `navbar.links` | `site.navbar.links` | 导航（支持 `submenu`） |
| `navbar.width.home/pages` | `site.navbar.width` | 导航栏宽度（合并成一个，切页不位移） |
| `navbar.search.enable` | `site.search.enable` | 本地搜索 |
| `home.sidebar` | `site.sidebar` | 首页侧栏（作者卡、公告、菜单） |
| `home_banner.*` | `site.home.banner` | 首页大图、打字机副标题 |
| `home.pageSize`（Hexo 的 per_page） | `site.home.pageSize` | 每页文章数 |
| `articles.*` | `site.post` | 目录、版权、上下篇、图片查看器 |
| `footer.*` | `site.footer` | 建站年份、自定义文本 |
| `fontawesome` | 不需要 | 图标改为内联 SVG（`components/Icon.astro`） |

配置会通过 `BaseLayout.astro` 注入成 CSS 变量，所以改颜色/宽度**不需要**重新构建 Tailwind 主题。

## 文章区（档案风）

`/blog` 这一片是**另一套视觉**，参考 Astro Navfolio 主题（MIT，本地旧仓库 `digital-site`）的档案风格：
米白纸底、细线分隔、等宽小标、超大中文标题、编号列表、椭圆轨道标签云。

- 作用域：所有样式挂在 `body.solid` 下（`src/styles/content.css`），首页也复用这套卡片（大图区不受影响）；
- 字体：全站统一 `ChillRoundM` 中文圆体（按站点实际用字做了子集，约 130KB）+ `Monaco` 等宽，
  文件在 `public/fonts/`，声明在 `src/styles/fonts.css`，缺字自动回退系统字体；
- 配色：卡片/线条是独立的 `--paper-*` 变量（名字沿用历史，值现在是主题的实心色）；
  强调色用站点主色 `--primary-color`（标签云的多彩色卡在
  `TagCloud.astro` 的 `colors` 数组里，可以整套替换）；
- 标签云：标签 ≤ 12 个时退化成紧凑排列，多了自动变成椭圆轨道布局；
- 系列：front-matter 里写 `series: [系列名]`，文章页会自动显示「第 x / y 篇」，
  右侧栏还会列出同系列的其他文章；系列页按时间正序排列（即建议的阅读顺序）；
- 归档 / 分类 / 标签 / 系列都收进 `/blog` 下面，用「分类 chips + 系列 / 标签 / 年份」切换，
  旧地址在 `astro.config.ts`（以及 `/tags/[tag].astro` 的跳转页）里做了重定向。

关于页（`/about`）、404、友链也用同一套实心悬浮卡片（`p-page` + `ContentHeader` + `p-sheet`），
首页与内容页共用同一张文章卡片（`PostRow`）：纯色底 + 双层阴影 + 右侧缩略图 + 编号，
差别只是首页多了大图和左侧栏。
注意：`content.css` 里的类名都以 `p-` 开头，**不要用 `p-404` 这种纯数字命名**，
会被 Tailwind 当成 `padding` 工具类。

## 友链页

`/friends` 和文章区共用同一套悬浮卡片，只是把"文章名片"换成了"朋友名片"：

- 页头复用 `ContentHeader`（小标 + 超大标题 + 右侧说明）；
- 按 `close` / `web` 分组，每组一个「中文标题 + 英文小标 + 细线」的分节标题；
- 每条友链是一行：46px 方形头像（没填头像就退化成首字母）+ 名称/标签 + 一句描述，
  两列排布（窄屏一列），悬停时边框变主色、整体上浮 1px；
- 页尾是「申请友链」的卡片，列出本站信息与联系方式。

数据在 `src/data/friends.ts`：`group` 决定分到哪一组，`tag` 是可选角标，`avatar` 留空则用首字母。
`friendSiteInfo` 是申请面板里展示的本站信息，记得改成你自己的。

## 改样式

三层结构，按需改：

1. **设计令牌**：`src/styles/theme.css` 的 `@theme` —— 圆角、阴影、字体、语义色
   （`text-ink`、`bg-page`、`border-line`、`shadow-card` …）。
2. **亮/暗配色**：同一文件的 `:root` 与 `.dark` —— 只覆盖 CSS 变量即可，
   不需要写两份样式，也不需要给每个元素加 `dark:`。暗色是一套偏蓝的深灰（色相约 215°），
   并且会把主色提亮成 `--primary-color`（`--brand-color` 才是配置里的原始色），
   以免红字贴在深灰上对比度不足；实心背景仍然使用 `--brand-color`。
3. **正文排版**：`src/styles/markdown.css` —— 一段 Markdown 渲染结果的全部视觉。

想加新组件样式，优先用 Tailwind 工具类；只有「一组重复出现的结构」
（如 `.card`、`.chip`、`.timeline`）才放进 `@layer components`。

## 已实现 / 未实现

已实现：首页大图与打字机、文章卡片流与分页、文章详情（目录跟随、版权、上下篇、相关推荐）、
归档时间线、分类/标签页、关于页、404、暗色模式、View Transitions、
阅读进度、图片查看器、本地搜索（Ctrl/⌘ + K）、代码复制、KaTeX、mermaid、RSS、sitemap。

尚未实现（原主题有，按需再加）：评论系统（Giscus/Twikoo/Waline…）、
说说（shuoshuo）、书签、友链、masonry 布局、Aplayer 播放器、网站访问计数、Font Awesome Pro 图标集。

## 一些实现取舍

- **客户端脚本挂在 `astro:page-load` 上**：View Transitions 切换页面不会重新执行模块脚本，
  所以 `src/scripts/site.ts` 里的每个 init 都做了幂等保护（dataset 标记 / 模块级开关）。
- **暗色模式要在 `astro:before-swap` 里续期**：View Transitions 会用新页面的 `<html>`
  属性覆盖当前文档，`.dark` 会被服务端渲染出的浅色状态冲掉 —— 所以在交换前把主题类写到
  `event.newDocument` 上。
- **首页大图有 fixed / static 两种模式**（`site.home.banner.style`）：
  `fixed` 用两层 `position: fixed` 的整屏元素铺在内容后面 —— 一层背景图、一层均匀压暗
  （`home-fixed-scrim`）。压暗层必须固定在视口上：如果把它放在会滚动的首屏 section 里，
  滚动时 section 底边会像一条分界线，看起来就是"上半屏不模糊、下半屏模糊"。
  首屏滚到一半（`scrollY >= banner 高度 × 0.5`）时，背景层一次性 `blur(15px)`（0.3s 过渡），
  卡片同时切到 80% 不透明度；`static` 则维持首屏一张图、随页面滚走。
- **侧栏是网格项本身**：`position: sticky` 的包含块是它的网格区域，如果外面再包一层
  高度等于内容高度的 div（或给网格加 `items-start`），sticky 就没有可移动的空间。
- **`scrollbar-gutter: stable`**：页面长短不一时保留滚动条占位，切页不会整页左右抖。
- **搜索不用 Pagefind**：Pagefind 需要先完整构建才能建索引，`astro dev` 下没有索引、搜索不可用。
  改为构建期输出 `search.json` + 客户端关键词匹配，开发和生产都能用，也不引入额外依赖。
  索引里每个关键词必须命中（多词更精确），中文按子串匹配，比 fuzzy 分词更适合中文短查询。
- **KaTeX 样式只在文章页引入**：首页不加载公式样式与字体（约 23KB CSS + 字体）。
- **图标不用 Font Awesome**：`components/Icon.astro` 里是一份内联 SVG path 表，
  加图标只需加一行，也不会有 100KB+ 的字体/CSS 开销。
- **`markdown.processor` 必须是 unified**：Astro 7 默认的 Sätteri 处理器不支持
  remark/rehype 插件，而数学公式依赖 `remark-math` + `rehype-katex`。

## 部署（Vercel）

推送到 GitHub 后由 Vercel 构建，纯静态输出，不需要 SSR adapter：

1. GitHub 上新建仓库，把本仓库推上去（`git remote add origin … && git push -u origin master`）；
2. Vercel → Add New Project → 选中该仓库，框架会被识别为 **Astro**；
3. 构建命令 `npm run build`，输出目录 `dist`（`vercel.json` 里也写死了，防止识别失败）；
4. 绑定域名后，把 [src/config.ts](src/config.ts) 里的 `site.url` 改成实际域名 ——
   sitemap、RSS、`og:url`、canonical、`robots.txt` 都依赖它。

Vercel 的 Node 版本：项目要求 `>=22.23.4`（Astro 7 的要求）。Vercel 默认的 Node 22 即可；
如果构建时报 Node 版本过低，在 Project Settings → General → Node.js Version 里选 24。

站点里已经生成好的东西：

- `sitemap-index.xml`（@astrojs/sitemap）；
- `rss.xml`；
- `search.json`（本地搜索索引，构建期生成）；
- `robots.txt`（构建期生成，指向 sitemap）；
- 旧地址重定向（`/archive`、`/archives`、`/categories`、`/tags`、`/posts`）——
  Astro 的 `redirects` 会输出带 meta refresh 的静态页，静态托管也能跳转。

> 如果站点部署在子路径下，需要在 `astro.config.ts` 里设置 `base`，并把 `site.url` 同步改掉。

## 参考

- 原主题源码：<https://github.com/evannotfound/hexo-theme-redefine>（GPL-3.0）
- 原主题文档：<https://redefine-docs.ohevan.com/zh/docs/getting-started>
- Astro 文档：<https://docs.astro.build>

原主题以 GPL-3.0 发布。本项目是**重新实现**而非直接复制模板与样式文件，
但如果你的用途对许可证敏感，建议自行确认与原项目的法律关系。
