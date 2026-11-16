# SnowCat's blog

snowcat 的个人博客（[sadsnowcat.com](https://sadsnowcat.com)）：记录堆利用、IoT 固件与内核相关的笔记。
用 [Astro](https://astro.build) 写成，视觉上参考 [Hexo Theme Redefine](https://github.com/evannotfound/hexo-theme-redefine)
和 Astro Navfolio，内容从 Fuwari 迁移而来。

**技术栈**：Astro 7（静态输出）、Tailwind CSS v4 + CSS 变量、Content Collections、
Shiki 代码高亮、KaTeX、mermaid、原生 View Transitions、构建期搜索索引。

**本地开发**：
`npm install` 装依赖，`npm run dev` 起本地服务（<http://localhost:4321>），
`npm run check` 做类型检查，`npm run build` 产出 `dist/`。
本地 `~/.npm` 若没有写权限，可以用 `npm install --cache ./.npm-cache`。

**写文章**：在 `src/content/posts/` 下新建 Markdown，路径即 URL
（`heap/heap-00.md` → `/posts/heap/heap-00/`）。front-matter 常用字段：
`title`、`date`、`description`、`categories`、`tags`、`series`、`cover`、`draft`，
字段定义与校验在 `src/content.config.ts`。

**改样式**：站点信息、导航、首页文案都在 `src/config.ts`；
全局设计令牌在 `src/styles/theme.css`，正文排版在 `src/styles/markdown.css`，
内容页（文章区、关于、友链）的卡片样式在 `src/styles/content.css`。

**部署**：推送到 GitHub 后由 Vercel 构建（`vercel.json` 已指定 `npm ci` + `astro build` + `dist`）。
换域名后记得同步修改 `src/config.ts` 里的 `site.url` —— sitemap、RSS、canonical、robots 都依赖它。

版本记录见 [CHANGELOG.md](CHANGELOG.md)。
