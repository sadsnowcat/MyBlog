import type { APIRoute } from 'astro';

import { getPosts, postExcerpt, postPath } from '../lib/posts';
import { formatDate, stripMarkup, truncate } from '../lib/utils';
import { site } from '../config';

/**
 * 构建期生成搜索索引：/search.json
 * 前端只在打开搜索框时 fetch 一次，比在浏览器里遍历全文省事，
 * 而且开发环境（astro dev）同样可用 —— 不需要先跑一次完整构建。
 */
export const GET: APIRoute = async () => {
  const posts = await getPosts();

  const items = posts.map((post) => ({
    title: post.data.title,
    url: postPath(post),
    description: postExcerpt(post, 200),
    tags: [...post.data.categories, ...post.data.tags],
    date: formatDate(post.data.date, 'YYYY-MM-DD', site.lang),
    body: truncate(stripMarkup(post.body ?? ''), 1500),
  }));

  return new Response(JSON.stringify(items), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
