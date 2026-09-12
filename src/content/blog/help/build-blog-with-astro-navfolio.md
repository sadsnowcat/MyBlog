---
title: "用 astro-navfolio 搭建我的博客"
description: "记录一次从模板到个人博客的改造：中英双语、时间线归档、首页最新卡片，以及标签与友链页的搭建过程。"
date: "2026-07-14T18:00:00+08:00"
draft: true
sticky: true
showHeroImage: false
tags: [Astro, 建站, 前端]
categories: [建站记录]
series: []
comments: true
sidebar:
  enable: true
  toc: true
  relatedPosts: true
---

# 用 astro-navfolio 搭建我的博客

选 [astro-navfolio](https://astro.navfolio.site/) 是因为它够干净：基于 Astro，内置全文搜索、代码高亮、KaTeX 公式、Mermaid 图表和一套温和的"纸感"配色，写技术笔记刚好合适。

## 做了哪些改造

在原模板基础上，围绕自己的使用习惯改了几处：

- **中英双语混排**：界面语言切到 `zh-CN`，站点文案保留中英对照。
- **首页"最近"改成文章卡片**：直接展示最新几篇，点击进文章，比热力图更聚焦"最近写了什么"。
- **blog → archives，按时间线排列**：文章按年份分组，一眼看清写作节奏。
- **导航调整**：去掉 vibe，新增 `Tags` 和 `Links` 两个入口。

## 如何写新文章

模板自带脚手架，一条命令生成带 frontmatter 的草稿：

```bash
# 生成 Markdown 草稿
bun run post:new my-new-post

# 需要在文中嵌入组件时，生成 MDX
bun run post:new my-new-post --mdx
```

生成的文件在 `src/content/blog/` 下，frontmatter 里把 `draft` 改成 `false` 就会正式发布：

```yaml
---
title: "文章标题"
description: "一句话摘要"
date: "2026-07-14T18:00:00+08:00"
draft: false
tags: [标签一, 标签二]
categories: [分类]
---
```

## 项目模块怎么用

博客之外，模板还内置了一个 **Projects（项目）** 模块，适合收录正在做、已发布，或值得记录实现取舍的小工具与系统。它和文章一样是内容集合，但走独立的路由 `/projects`。

### 文件结构

项目数据放在 `src/content/projects/` 下，每个 `.md` / `.mdx` 文件就是一条项目：

```
src/content/projects/
├── index.mdx        # 分区首页（特殊，不能用作普通项目名）
└── my-tool.mdx      # 单个项目 → 访问 /projects/my-tool/
```

- `index.mdx` 是项目分区的"落地页"：它的正文作为分区介绍，页面下方会自动把**其余所有非草稿项目**渲染成卡片网格（日期、标题、摘要、最多 3 个标签）。
- 其余文件名（去掉扩展名）即项目 slug，访问地址为 `/projects/<slug>/`。所以**不要**把普通项目命名为 `index`。

### 一条项目的 frontmatter

项目复用和博客文章相同的 schema，字段基本一致：

```yaml
---
title: "我的小工具"                          # 必填
description: "一句话说明这个项目解决什么问题" # 必填
date: "2026-07-14T18:00:00+08:00"            # 必填，用于排序
draft: false                                # true 时仅本地可见，不进卡片网格
heroImage: /images/cover.png                # 可选，详情页题图
showHeroImage: true                         # 是否显示题图
tags: [Python, 工具]                         # 可选
categories: [小工具]                         # 可选
comments: false                             # 项目页默认也可关评论
sidebar:
  enable: false
  toc: false
  relatedPosts: false
---

在这里写项目背景、能力清单、技术取舍和后续计划。
```

### 渲染位置

- 列表：`/projects` —— 渲染 `index.mdx` 的正文，并在下方自动生成项目卡片。
- 详情：`/projects/<slug>/` —— 完整文章式排版（标题、日期、正文、可选目录侧栏）。
- 入口：顶部导航的 **Projects** 直接链到 `/projects`。

也就是说，新增项目只需在 `src/content/projects/` 下建一个 `.mdx` 文件、填好 frontmatter 和正文，保存后它就会自动出现在 `/projects` 的卡片网格里。

## 数学与图表也能直接写

行内公式 $E = mc^2$，独立公式：

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

也支持 Mermaid 流程图、代码折叠、图片缩放——技术写作需要的基本都有了。

## 接下来

先把 About 页写成自己的介绍，然后陆续补上 AI 与 CTF 方向的笔记。慢慢来，博客本来就是长期的事。
