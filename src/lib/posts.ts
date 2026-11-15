import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

import { site } from '../config';
import { slugify, stripMarkup, truncate } from './utils';

export type Post = CollectionEntry<'posts'>;

/** 所有文章：置顶优先，然后按日期倒序（对应 Hexo 的 sticky + date 排序） */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => {
    if (a.data.sticky !== b.data.sticky) return a.data.sticky ? -1 : 1;
    return b.data.date.getTime() - a.data.date.getTime();
  });
}

/** 文章 URL：/posts/<id>，id 由 glob loader 从文件名推导 */
export function postPath(post: Post): string {
  return `/posts/${post.id}`;
}

export function postExcerpt(post: Post, length = site.home.excerptLength): string {
  if (post.data.description) return post.data.description;
  const body = stripMarkup(post.body ?? '');
  return truncate(body, length);
}

/** 按日期倒序分页 */
export function paginatePosts<T>(items: T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages.length ? pages : [[]];
}

export interface TermStat {
  name: string;
  slug: string;
  count: number;
  latest: Date;
}

/** 分类 / 标签聚合，按文章数倒序 */
export function collectTerms(posts: Post[], field: 'tags' | 'categories'): TermStat[] {
  const map = new Map<string, TermStat>();
  for (const post of posts) {
    for (const name of post.data[field]) {
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
        if (post.data.date > existing.latest) existing.latest = post.data.date;
      } else {
        map.set(name, { name, slug: slugify(name), count: 1, latest: post.data.date });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 某分类 / 标签下的文章，按时间倒序 */
export function postsWithTerm(posts: Post[], field: 'tags' | 'categories', name: string): Post[] {
  return posts.filter((post) => post.data[field].includes(name));
}

export interface SeriesStat {
  name: string;
  slug: string;
  count: number;
  /** 最早 / 最新一篇的日期 */
  first: Date;
  latest: Date;
  /** 按时间正序（即阅读顺序） */
  posts: Post[];
}

/** 把所有系列聚合成「按最新一篇倒序」的列表 */
export function collectSeries(posts: Post[]): SeriesStat[] {
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    for (const name of post.data.series) {
      map.set(name, [...(map.get(name) ?? []), post]);
    }
  }

  return [...map.entries()]
    .map(([name, list]) => {
      const ordered = [...list].sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
      return {
        name,
        slug: slugify(name),
        count: ordered.length,
        first: ordered[0]!.data.date,
        latest: ordered[ordered.length - 1]!.data.date,
        posts: ordered,
      };
    })
    .sort((a, b) => b.latest.getTime() - a.latest.getTime());
}

/** 某篇文章所属的系列（含序号），供文章页展示进度 */
export function seriesOfPost(post: Post, posts: Post[]) {
  const all = collectSeries(posts);
  return post.data.series
    .map((name) => {
      const series = all.find((item) => item.name === name);
      if (!series) return null;
      const index = series.posts.findIndex((item) => item.id === post.id);
      return { ...series, index: index + 1 };
    })
    .filter((item): item is SeriesStat & { index: number } => item !== null);
}

/** 按年份分组（归档页） */
export function groupByYear(
  posts: Post[],
): { year: number; total: number; months: { index: number; posts: Post[] }[] }[] {
  const years = new Map<number, Post[]>();
  for (const post of posts) {
    const year = post.data.date.getFullYear();
    years.set(year, [...(years.get(year) ?? []), post]);
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => {
      const months = new Map<string, Post[]>();
      for (const post of items) {
        const key = `${post.data.date.getMonth()}`;
        months.set(key, [...(months.get(key) ?? []), post]);
      }
      return {
        year,
        total: items.length,
        months: [...months.entries()]
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([month, monthPosts]) => ({
            index: Number(month),
            posts: monthPosts,
          })),
      };
    });
}

/** 相关文章：同分类 > 同标签 > 最新，去重后取 limit 条 */
export function relatedPosts(current: Post, posts: Post[], limit = 3): Post[] {
  const scored = posts
    .filter((post) => post.id !== current.id)
    .map((post) => {
      const sharedCategories = post.data.categories.filter((c) => current.data.categories.includes(c)).length;
      const sharedTags = post.data.tags.filter((t) => current.data.tags.includes(t)).length;
      return { post, score: sharedCategories * 3 + sharedTags };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.data.date.getTime() - a.post.data.date.getTime());

  const result = scored.slice(0, limit).map(({ post }) => post);
  if (result.length < limit) {
    const filler = posts.filter((p) => p.id !== current.id && !result.includes(p)).slice(0, limit - result.length);
    result.push(...filler);
  }
  return result;
}

/** 取一个 Markdown 页面（如 about） */
export async function getPage(id: string) {
  return getEntry('pages', id);
}
