import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { site } from './src/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: site.url,

  // 预取 + 原生 View Transitions 取代原主题的 swup（pjax 单页体验）
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  integrations: [sitemap()],

  // 归档 / 分类 / 标签已合并到「文章」区（/blog），旧地址做永久重定向
  redirects: {
    '/archives': '/blog/archives',
    '/archive': '/blog/archives',
    '/posts': '/blog',
    '/categories': '/blog',
    '/tags': '/blog/tags',
  },

  markdown: {
    // Astro 7 默认的 Sätteri 处理器不支持 remark/rehype 插件，
    // 这里显式换回 unified 管线（数学公式需要 remark-math + rehype-katex）。
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: false, output: 'html' }]],
    }),
    // 代码高亮：Shiki 双主题，跟随 .dark 切换（颜色由 CSS 变量驱动）
    // 用 Catppuccin 官方 Shiki 主题，保证代码块和正文配色是同一套色板
    shikiConfig: {
      themes: { light: 'catppuccin-latte', dark: 'catppuccin-mocha' },
      defaultColor: false,
      wrap: true,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
