/**
 * 站点配置文件 —— 对应 Hexo 主题的 `_config.yml`。
 *
 * 重构思路：Redefine 主题把几乎所有外观/功能都做成了 YAML 开关，
 * 这里用「带类型的 TypeScript 对象」取代 YAML：
 *   - 有类型提示，改错了编辑器会报错；
 *   - 有注释，逐项对应原主题的配置项；
 *   - 需要新增配置时直接加字段，页面里 `site.xxx` 就能用。
 *
 * 视觉相关的值（颜色、圆角、字体、阴影）最终会被注入成 CSS 变量，
 * 详见 `src/styles/theme.css` 与 `src/layouts/BaseLayout.astro`。
 */

/** 图标名，必须是 `src/components/Icon.astro` 里已注册的名字 */
export type IconName =
  | 'home'
  | 'archive'
  | 'tag'
  | 'folder'
  | 'user'
  | 'link'
  | 'search'
  | 'github'
  | 'x'
  | 'mail'
  | 'rss'
  | 'telegram'
  | 'bilibili'
  | 'wechat'
  | 'calendar'
  | 'clock'
  | 'eye'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'close'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'chevron-down'
  | 'chevron-right'
  | 'external'
  | 'copy'
  | 'check'
  | 'list'
  | 'book';

/** 导航项，支持二级菜单（对应原主题 navbar.links 的 submenus） */
export interface NavLink {
  name: string;
  path: string;
  icon?: IconName;
  /** 是否新窗口打开（外链会自动判断） */
  external?: boolean;
  submenu?: { name: string; path: string; external?: boolean }[];
}

export interface SocialLink {
  name: string;
  icon: IconName;
  url: string;
}

export interface SiteConfig {
  /** 站点语言，写入 <html lang> */
  lang: string;
  title: string;
  subtitle: string;
  description: string;
  /** 部署域名，用于 sitemap / RSS / og 绝对地址，结尾不要带 / */
  url: string;
  author: {
    name: string;
    avatar: string;
    bio: string;
  };
  /** 社交链接，显示在侧栏与页脚 */
  social: SocialLink[];
  colors: {
    /** 主题色，对应 colors.primary */
    primary: string;
    /**
     * 首次访问的配色，对应 colors.default_mode。
     * 'auto' = 跟随系统 prefers-color-scheme；访客手动切换过则以 localStorage 为准。
     */
    defaultMode: 'light' | 'dark' | 'auto';
    /** 是否允许访客手动切换 */
    toggle: boolean;
  };
  layout: {
    /** 正文容器最大宽度，对应 global.content_max_width */
    contentMaxWidth: string;
    /** 文章页（左侧栏 + 正文 + 右目录）的容器最大宽度 */
    contentMaxWidthWide: string;
    /** 侧栏宽度，对应 global.sidebar_width */
    sidebarWidth: string;
    /** 右下角阅读进度环，对应 global.scroll_progress.percentage */
    scrollProgress: boolean;
  };
  navbar: {
    /** 标题（留空则用 site.title） */
    title?: string;
    logo?: string;
    links: NavLink[];
    /** 导航栏背景渐变，对应 navbar.color */
    color: { left: string; right: string; transparency: number };
    search: { enable: boolean };
    /** 导航栏内容最大宽度（全站统一，避免切页时左右位移） */
    width: string;
  };
  /** 首页侧栏，对应 home.sidebar */
  sidebar: {
    enable: boolean;
    position: 'left' | 'right';
    /** 侧栏第一块显示菜单还是作者信息，对应 home.sidebar.first_item */
    firstItem: 'menu' | 'info';
    announcement?: string;
    links: { name: string; path: string; icon?: IconName }[];
  };
  /** 首页，对应 home + home_banner */
  home: {
    pageSize: number;
    banner: {
      enable: boolean;
      /**
       * fixed：背景图固定铺满整页、不随滚动移动，滚出首屏后自动虚化（原主题的招牌效果）
       * static：背景图只属于首屏，随页面滚走
       */
      style: 'fixed' | 'static';
      image: { light: string; dark: string };
      title: string;
      /** 打字机循环的副标题，空数组则不显示 */
      subtitles: string[];
      typingSpeed: number;
      social: boolean;
    };
    excerptLength: number;
    /** 日期格式：auto(自动相对时间) | 具体格式串 */
    dateFormat: string;
    showCategories: boolean;
    showTags: boolean;
  };
  /** 文章页，对应 articles */
  post: {
    toc: { enable: boolean; maxDepth: number };
    copyright: { enable: boolean; license: string };
    prevNext: boolean;
    /** 图片点击放大 */
    imageViewer: boolean;
    /** mermaid 图表按需加载 */
    mermaid: boolean;
    /** 代码块复制按钮 */
    copyCode: boolean;
  };
  footer: {
    /** 建站年份，用于 © 起止年份 */
    since: number;
    /** 备案号等自定义文本，支持 HTML */
    customText?: string;
    showPoweredBy: boolean;
  };
  /** 文章区（/blog）的文案与分页，版式参考 Navfolio 的档案风 */
  blog: {
    kicker: string;
    title: string;
    subtitle: string;
    note: string;
    pageSize: number;
  };
  /** 本地搜索，对应 navbar.search + hexo-generator-searchdb */
  search: {
    enable: boolean;
    /** 命中结果条数上限 */
    limit: number;
  };
}

export const site: SiteConfig = {
  lang: 'zh-CN',
  title: 'snowcat',
  subtitle: 'snowcat 的电子小屋',
  description: 'CTFer | PWN。记录堆利用、IoT 固件与内核相关的笔记。',
  url: 'https://sadsnowcat.com',

  author: {
    name: 'snowcat',
    avatar: '/images/sadsnowcat.jpg',
    bio: 'CTFer | PWN',
  },

  social: [
    { name: 'GitHub', icon: 'github', url: 'https://github.com/sadsnowcat' },
    { name: 'Email', icon: 'mail', url: 'mailto:sadsnowcat@foxmail.com' },
    { name: 'RSS', icon: 'rss', url: '/rss.xml' },
  ],

  colors: {
    // 取自原站 themeColor.hue = 250（hsl(250, 70%, 60%)）
    primary: '#6952e0',
    defaultMode: 'dark',
    toggle: true,
  },

  layout: {
    contentMaxWidth: '1000px',
    contentMaxWidthWide: '1440px',
    sidebarWidth: '300px',
    scrollProgress: true,
  },

  navbar: {
    // title: 'Redefine',
    links: [
      { name: '首页', path: '/', icon: 'home' },
      { name: '文章', path: '/blog', icon: 'book' },
      { name: '友链', path: '/friends', icon: 'link' },
      { name: '关于', path: '/about', icon: 'user' },
    ],
    color: { left: '#f78736', right: '#367df7', transparency: 35 },
    search: { enable: true },
    width: '1200px',
  },

  sidebar: {
    enable: true,
    position: 'left',
    firstItem: 'info',
    announcement: '欢迎来到我的博客，这里记录一些想法与代码。',
    links: [
      { name: '全部文章', path: '/blog', icon: 'book' },
      { name: '标签', path: '/blog/tags', icon: 'tag' },
      { name: '年份归档', path: '/blog/archives', icon: 'archive' },
      { name: '友链', path: '/friends', icon: 'link' },
      { name: '关于', path: '/about', icon: 'user' },
    ],
  },

  home: {
    pageSize: 6,
    banner: {
      enable: true,
      style: 'fixed',
      image: {
        light: '/images/wallhaven-wqery6-light.webp',
        dark: '/images/wallhaven-wqery6-dark.webp',
      },
      title: 'snowcat',
      subtitles: ['Maybe every day will be better!'],
      typingSpeed: 100,
      social: true,
    },
    excerptLength: 180,
    dateFormat: 'auto',
    showCategories: true,
    showTags: true,
  },

  post: {
    toc: { enable: true, maxDepth: 3 },
    copyright: { enable: true, license: 'CC BY-NC-SA 4.0' },
    prevNext: true,
    imageViewer: true,
    mermaid: true,
    copyCode: true,
  },

  footer: {
    since: 2026,
    customText: '',
    showPoweredBy: true,
  },

  blog: {
    kicker: 'Notebook archive',
    title: '文章与笔记',
    subtitle: '旧文和开发杂记。',
    note: '把零散的笔记归档成一份可检索的档案。',
    pageSize: 6,
  },

  search: {
    enable: true,
    limit: 10,
  },
};
