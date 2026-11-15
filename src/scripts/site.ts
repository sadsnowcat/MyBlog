/**
 * 全站客户端交互入口。
 *
 * 所有行为都挂在 `astro:page-load` 上，这样在 View Transitions 切换页面后
 * 依然会重新绑定；每个 init 内部都做了幂等保护（dataset 标记 / 模块级变量），
 * 所以首次加载与后续导航不会重复绑定。
 */
import { site } from '../config';

const html = document.documentElement;

/**
 * View Transitions 换页时会把 <html> 的属性一起替换掉，
 * 导致上一页加的 .dark 丢失（看起来像"切页后变回浅色"）。
 * 在交换发生前，把当前主题写到即将生效的文档上。
 */
function syncThemeBeforeSwap() {
  document.addEventListener('astro:before-swap', (event) => {
    const next = (event as unknown as { newDocument?: Document }).newDocument;
    if (!next) return;
    const isDark = document.documentElement.classList.contains('dark');
    next.documentElement.classList.toggle('dark', isDark);
    next.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  });
}
syncThemeBeforeSwap();

function onPageLoad(fn: () => void) {
  fn();
  document.addEventListener('astro:page-load', fn);
}

/* ------------------------------------------------------------------ 主题 */
function bindThemeToggle() {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const dark = html.classList.toggle('dark');
      const mode = dark ? 'dark' : 'light';
      html.dataset.theme = mode;
      try {
        localStorage.setItem('theme', mode);
      } catch {
        /* 隐私模式下忽略 */
      }
      // 只在这 300ms 内开启颜色过渡，避免影响其他动画
      html.classList.add('theme-transition');
      window.setTimeout(() => html.classList.remove('theme-transition'), 320);
    });
  });
}

/* ------------------------------------------------------------ 移动端菜单 */
function bindMobileMenu() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
  if (!toggle || !menu) return;

  const setOpen = (open: boolean) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.onclick = () => setOpen(!menu.classList.contains('is-open'));
  menu.querySelectorAll('[data-menu-close], a').forEach((el) => {
    el.addEventListener('click', () => setOpen(false));
  });
}

/* --------------------------------------------------------------- 打字机 */
function bindTyping() {
  const el = document.querySelector<HTMLElement>('[data-typing]');
  if (!el || el.dataset.started) return;
  el.dataset.started = '1';

  const target = el.querySelector<HTMLElement>('[data-typing-target]');
  if (!target) return;

  let list: string[] = [];
  try {
    list = JSON.parse(el.dataset.typing ?? '[]');
  } catch {
    return;
  }
  if (!list.length) return;

  const speed = Number(el.dataset.typingSpeed) || 100;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    target.textContent = list[0]!;
    return;
  }

  let index = 0;
  let current = '';
  let deleting = false;

  const tick = () => {
    const full = list[index % list.length]!;
    current = deleting ? full.slice(0, current.length - 1) : full.slice(0, current.length + 1);
    target.textContent = current;

    let delay = deleting ? speed / 2 : speed;
    if (!deleting && current === full) {
      // 只有一句时打完就停，不要反复删了重打
      if (list.length === 1) return;
      deleting = true;
      delay = 1600;
    } else if (deleting && current === '') {
      deleting = false;
      index += 1;
      delay = 400;
    }
    window.setTimeout(tick, delay);
  };

  window.setTimeout(tick, 500);
}

/** 复制文本：优先 Clipboard API，非安全上下文（http 域名）回退到 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走回退方案 */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- 代码块增强 */
function bindCodeBlocks() {
  document.querySelectorAll<HTMLPreElement>('.markdown-body pre').forEach((pre) => {
    if (pre.closest('.code-block') || pre.dataset.language === 'mermaid') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const toolbar = document.createElement('div');
    toolbar.className = 'code-block-toolbar';

    const lang = document.createElement('span');
    lang.textContent = pre.dataset.language || 'code';

    toolbar.append(lang);

    if (site.post.copyCode) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = '复制';
      button.setAttribute('aria-label', '复制代码');
      button.addEventListener('click', async () => {
        const ok = await copyText(pre.textContent ?? '');
        button.textContent = ok ? '已复制' : '复制失败';
        if (ok) button.dataset.copied = 'true';
        window.setTimeout(() => {
          button.textContent = '复制';
          delete button.dataset.copied;
        }, 1600);
      });
      toolbar.append(button);
    }

    wrapper.insertBefore(toolbar, pre);
  });
}

/* ------------------------------------------------------------- 图片查看器 */
function bindImageViewer() {
  if (!site.post.imageViewer) return;

  const open = (src: string, alt: string) => {
    const overlay = document.createElement('div');
    overlay.className = 'iv-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', alt || '图片预览');

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    overlay.append(img);
    overlay.addEventListener('click', close);
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
  };

  document.querySelectorAll<HTMLImageElement>('.markdown-body img').forEach((img) => {
    if (img.dataset.zoomable !== undefined) return;
    img.dataset.zoomable = '';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => open(img.currentSrc || img.src, img.alt));
  });
}

/* ---------------------------------------------------------------- mermaid */
async function bindMermaid() {
  if (!site.post.mermaid) return;

  const blocks = document.querySelectorAll<HTMLPreElement>('.markdown-body pre[data-language="mermaid"]');
  if (!blocks.length) return;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: html.classList.contains('dark') ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'var(--font-sans)',
  });

  let index = 0;
  for (const pre of blocks) {
    if (pre.closest('[data-mermaid-done]')) continue;
    const source = pre.textContent ?? '';
    const holder = document.createElement('div');
    holder.className = 'mermaid-block';
    holder.dataset.mermaidDone = '1';
    pre.replaceWith(holder);

    try {
      const { svg } = await mermaid.render(`mermaid-svg-${index++}`, source);
      holder.innerHTML = svg;
    } catch (error) {
      holder.textContent = source;
      console.warn('[mermaid] 渲染失败', error);
    }
  }
}

/* ----------------------------------------------------------------- 搜索 */
interface SearchItem {
  title: string;
  url: string;
  description: string;
  tags: string[];
  body: string;
  date: string;
}

function scoreItem(item: SearchItem, keywords: string[]): number {
  const title = item.title.toLowerCase();
  const tags = item.tags.join(' ').toLowerCase();
  const description = item.description.toLowerCase();
  const body = item.body.toLowerCase();

  let score = 0;
  for (const keyword of keywords) {
    const inTitle = title.includes(keyword);
    const inTags = tags.includes(keyword);
    const inDescription = description.includes(keyword);
    const inBody = body.includes(keyword);
    // 每个关键词都必须命中，否则不算结果（多词搜索更精确）
    if (!inTitle && !inTags && !inDescription && !inBody) return 0;

    if (inTitle) score += title.startsWith(keyword) ? 12 : 8;
    if (inTags) score += 5;
    if (inDescription) score += 3;
    if (inBody) score += 1;
  }
  return score;
}

function bindSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-search-dialog]');
  if (!dialog || dialog.dataset.bound) return;
  dialog.dataset.bound = '1';

  const input = dialog.querySelector<HTMLInputElement>('[data-search-input]');
  const list = dialog.querySelector<HTMLElement>('[data-search-results]');
  const empty = dialog.querySelector<HTMLElement>('[data-search-empty]');
  const count = dialog.querySelector<HTMLElement>('[data-search-count]');
  if (!input || !list || !empty) return;

  let index: SearchItem[] | null = null;
  let loading: Promise<void> | null = null;
  let results: SearchItem[] = [];
  let active = -1;

  const loadIndex = () => {
    loading ??= fetch('/search.json')
      .then((response) => response.json())
      .then((data: SearchItem[]) => {
        index = data;
      })
      .catch(() => {
        index = [];
      });
    return loading;
  };

  const setActive = (next: number) => {
    const items = [...list.querySelectorAll<HTMLElement>('[data-search-item]')];
    if (!items.length) return;
    active = (next + items.length) % items.length;
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === active);
      item.setAttribute('aria-selected', String(i === active));
    });
    items[active]?.scrollIntoView({ block: 'nearest' });
  };

  const render = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    list.replaceChildren();

    if (!trimmed || !index) {
      empty.hidden = false;
      empty.textContent = index ? '输入关键词开始搜索' : '正在加载索引…';
      if (count) count.textContent = '';
      results = [];
      return;
    }

    const keywords = trimmed.split(/\s+/).filter(Boolean);
    results = index
      .map((item) => ({ item, score: scoreItem(item, keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, site.search.limit)
      .map(({ item }) => item);

    empty.hidden = results.length > 0;
    if (!results.length) empty.textContent = `没有找到与「${keyword}」相关的文章`;

    for (const item of results) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = item.url;
      link.dataset.searchItem = '';
      link.className =
        'flex flex-col gap-1 rounded-md px-3 py-2.5 transition-colors hover:bg-primary/8 [&.is-active]:bg-primary/10';

      const title = document.createElement('span');
      title.className = 'font-display text-[0.95rem] font-medium text-ink-strong';
      title.textContent = item.title;

      const meta = document.createElement('span');
      meta.className = 'line-clamp-1 text-[0.76rem] text-ink-muted';
      meta.textContent = [item.date, ...item.tags].join(' · ');

      link.append(title, meta);
      li.append(link);
      list.append(li);
    }

    active = -1;
    if (count) count.textContent = results.length ? `${results.length} 条结果` : '';
  };

  const open = async () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    await loadIndex();
    render(input.value);
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  // 导航栏按钮 + Ctrl/⌘ + K
  document.querySelectorAll('[data-search-open]').forEach((btn) => {
    btn.addEventListener('click', open);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  input.addEventListener('input', () => render(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active - 1);
    } else if (event.key === 'Enter') {
      const item = list.querySelectorAll<HTMLAnchorElement>('[data-search-item]')[active];
      if (item) {
        event.preventDefault();
        item.click();
        close();
      }
    }
  });
}

/** 全局快捷键：Ctrl/⌘ + K 打开搜索 */
let hotkeyBound = false;
function bindSearchHotkey() {
  if (hotkeyBound) return;
  hotkeyBound = true;
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      const trigger = document.querySelector<HTMLButtonElement>('[data-search-open]');
      if (!trigger) return;
      event.preventDefault();
      trigger.click();
    }
  });
}

/* ------------------------------------------------------- 进度 / 目录 / 回顶 */
let currentScrollUpdate: (() => void) | null = null;
let scrollBound = false;

function bindScroll() {
  const tools = document.querySelector<HTMLElement>('[data-side-tools]');
  const circle = document.querySelector<SVGCircleElement>('[data-progress-circle]');
  const text = document.querySelector<HTMLElement>('[data-progress-text]');
  const backToTop = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
  const headings = tocLinks
    .map((link) => document.getElementById(link.dataset.tocLink ?? ''))
    .filter((el): el is HTMLElement => Boolean(el));

  const CIRCUMFERENCE = 100.53;

  // 首页 fixed 大图：滚出首屏后加模糊（对应 Redefine 的 home_banner.style: fixed）
  const bannerBg = document.querySelector<HTMLElement>('[data-home-bg]');
  const bannerSection = document.querySelector<HTMLElement>('[data-home-banner]');
  const bannerThreshold = () =>
    Math.max(((bannerSection?.offsetHeight ?? window.innerHeight) || 0) * 0.5, 200);
  let bannerBlurred = false;

  const updateBanner = (scrollTop: number) => {
    if (!bannerBg) return;
    const blurred = scrollTop >= bannerThreshold();
    if (blurred === bannerBlurred) return;
    bannerBlurred = blurred;
    bannerBg.style.filter = `blur(${blurred ? 15 : 0}px)`;
    // Safari 老版本
    (bannerBg.style as CSSStyleDeclaration & { webkitFilter?: string }).webkitFilter =
      `blur(${blurred ? 15 : 0}px)`;
  };

  const update = () => {
    const scrollTop = window.scrollY;
    updateBanner(scrollTop);
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const percent = height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0;

    if (circle) circle.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - percent / 100));
    if (text) text.textContent = String(Math.round(percent));

    if (tools) {
      const visible = scrollTop > 320;
      tools.style.opacity = visible ? '1' : '0';
      tools.style.pointerEvents = visible ? 'auto' : 'none';
    }

    // 目录高亮：最后一个越过视口上方的标题
    if (headings.length) {
      let current = headings[0]!;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 140) current = heading;
      }
      tocLinks.forEach((link) => {
        const isActive = link.dataset.tocLink === current.id;
        link.classList.toggle('is-active', isActive);
        link.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    }
  };

  if (backToTop) {
    backToTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  currentScrollUpdate = update;
  update();

  if (!scrollBound) {
    scrollBound = true;
    let ticking = false;
    document.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          currentScrollUpdate?.();
        });
      },
      { passive: true },
    );
  }
}

/* ------------------------------------------------------------------ 启动 */
function init() {
  bindThemeToggle();
  bindMobileMenu();
  bindTyping();
  bindCodeBlocks();
  bindImageViewer();
  bindMermaid();
  bindSearch();
  bindSearchHotkey();
  bindScroll();
}

onPageLoad(init);
