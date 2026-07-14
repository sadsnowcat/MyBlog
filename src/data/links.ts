export interface LinkItem {
  name: string;
  url: string;
  bio?: string;
  avatar?: string | null;
  backgroundImage?: string | null;
}

export interface LinkGroup {
  title: string;
  description?: string;
  items: LinkItem[];
}

// 友链 / 收藏。按需增删；avatar 可用远程图片 URL 或站内 /images/xxx 路径。
export const linkGroups: LinkGroup[] = [
  {
    title: '友情链接',
    description: '',
    items: [
      {
        name: 'Findkey',
        url: 'https://find-key.github.io/',
        bio: 'To Be PWN Master',
        avatar: 'https://find-key.github.io/images/head_image.jpg',
      },
      {
        name: 'wuye',
        url: 'https://www.mgoyy.cn/',
        bio: '逆向魔法师',
        avatar: 'https://www.mgoyy.cn/images/b0c1d74766dd8bce0ad860be15c46993a.jpg',
      },
      {
        name: 'moyue',
        url: 'https://qmoyue.github.io/',
        bio: '抹月的奇妙冒险',
        avatar: 'https://qmoyue.github.io/images/avatar.jpg',
      },
      {
        name: 'SoloWalker',
        url: 'https://s0lowalker.github.io/',
        bio: 'WebSecurity Learner',
        avatar: 'https://s0lowalker.github.io/images/logo/solowalker.png',
      },
      {
        name: 'Junwei LI',
        url: 'https://nandcpointfm.github.io/',
        bio: 'Natika的游戏开发博客',
        avatar: 'https://nandcpointfm.github.io/images/head1.jpg',
      },
      {
        name: 'Yuoooka',
        url: 'https://yuoooka.cn/',
        bio: 'Dream to be an Agent Developer& Reverse engineer',
        avatar: 'https://yuoooka.cn/picture/avatar2.jpg',
      },
      {
        name: 'Chai_na',
        url: 'https://chaina1.com/',
        bio: '计科小奶猫',
        avatar: 'https://chaina1.com/avatar.jpg',
      },
      {
        name: 'd4yt1m3',
        url: 'https://d4yt1m3.github.io/',
        bio: '人工智能小奶猫',
        avatar: 'https://d4yt1m3.github.io/images/avatar.JPG',
      },
      {
        name: 'Chloe',
        url: 'https://hey-chloe.github.io',
        bio: 'Web 安全',
        avatar: 'https://avatars.githubusercontent.com/u/246075173?v=4',
      },
      {
        name: 'Citlali@Official',
        url: 'https://bit7428.github.io/',
        bio: '喜欢二次元的朋友',
        avatar: 'https://bit7428.github.io/_astro/avatar.BpWGvWTL_Z1tTn3m.webp',
      },

      // {
      //   name: 'Astro',
      //   url: 'https://astro.build',
      //   bio: '本站使用的 Web 框架',
      // },
      // {
      //   name: 'navfolio',
      //   url: 'https://astro.navfolio.site/',
      //   bio: '本站所用主题模板',
      // },
    ],
  },
  {
    title: '常用工具',
    description: '日常会用到的资源与站点。',
    items: [
      // {
      //   name: 'GitHub',
      //   url: 'https://github.com/sadsnowcat',
      //   bio: '我的代码仓库',
      // },
    ],
  },
];
