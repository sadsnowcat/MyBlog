import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 内容集合（Astro Content Layer）。
 * 对应 Hexo 的 `source/_posts/*.md`，但 front-matter 有类型校验：
 * 写错字段会在 dev / build 时直接报错，而不是静默失效。
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    description: z.string().optional(),
    /** 列表页封面图 */
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    /** 所属系列（同系列文章按日期正序阅读） */
    series: z.array(z.string()).default([]),
    /** 置顶 */
    sticky: z.boolean().default(false),
    /** 草稿：不会出现在任何页面 */
    draft: z.boolean().default(false),
    /** 是否显示目录 */
    toc: z.boolean().default(true),
    /** 是否显示版权信息 */
    copyright: z.boolean().default(true),
  }),
});

/** 单页内容（关于、友链等），对应 Hexo 的独立页面 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { posts, pages };
