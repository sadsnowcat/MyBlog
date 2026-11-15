/** 一些与框架无关的小工具函数 */

/** 把任意字符串变成 URL 安全的分段（中文标签会被保留，交给浏览器编码） */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[/?#[\]@!$&'()*+,;=]/g, '');
}

/** 站内绝对地址（用于 RSS / og:image） */
export function absoluteUrl(path: string, base: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const origin = base.replace(/\/+$/, '');
  return `${origin}/${path.replace(/^\/+/, '')}`;
}

const DATE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * 日期格式化。
 * @param format 'auto' → 一个月内显示「3 天前」，更早显示日期；
 *               其余情况按 YYYY-MM-DD / YYYY年MM月DD日 之类的模板输出。
 */
export function formatDate(date: Date, format = 'auto', lang = 'zh-CN'): string {
  const now = Date.now();
  const diff = (date.getTime() - now) / 1000;

  if (format === 'auto' || format === 'relative') {
    const abs = Math.abs(diff);
    if (format === 'relative' || abs < 30 * 24 * 3600) {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
      for (const [unit, seconds] of DATE_UNITS) {
        if (abs >= seconds || unit === 'minute') {
          return rtf.format(Math.round(diff / seconds), unit);
        }
      }
    }
    // 'auto' 对一个月以前的文章回落到具体日期
    format = 'YYYY-MM-DD';
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  return format
    .replace('YYYY', String(y))
    .replace('MM', m)
    .replace('DD', d)
    .replace('HH', hh)
    .replace('mm', mm);
}

/** 归档页用的「2024 年 3 月」 */
export function monthLabel(date: Date, lang = 'zh-CN'): string {
  return new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long' }).format(date);
}

/** 粗略阅读时长：中文按 400 字/分钟，英文按 200 词/分钟 */
export function readingTime(body: string): number {
  const cjk = (body.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (body.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_'-]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 200));
}

/** 去掉 Markdown / HTML 标记后的纯文本，用于摘要与搜索索引 */
export function stripMarkup(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 截断到指定长度，保留完整字符（不切坏 emoji / 中文） */
export function truncate(input: string, length: number): string {
  const chars = [...input];
  if (chars.length <= length) return input;
  return `${chars.slice(0, length).join('').trimEnd()}…`;
}
