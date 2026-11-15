import type { APIRoute } from 'astro';

import { site } from '../config';

/** 构建期生成 robots.txt，sitemap 地址跟着 site.url 走 */
export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${site.url.replace(/\/+$/, '')}/sitemap-index.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
