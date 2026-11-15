/**
 * 友链数据。
 * 想加友链就往数组里追加一项，页面按 group 分组排版；
 * avatar 可以填远程图片地址，也可以留空（会退化成一个字母头像）。
 */
export interface Friend {
  name: string;
  url: string;
  avatar?: string;
  description: string;
  /** 卡片右上角的小标签，比如「设计」「前端」 */
  tag?: string;
}

export const friends: Friend[] = [
  {
    name: 'dodola',
    url: 'https://dodolalorc.cn/',
    avatar: 'https://avatars.githubusercontent.com/u/114007020?v=4',
    description: '要是人生能像星露谷就好了。✨',
    tag: 'life',
  },
  {
    name: 'Findkey',
    url: 'https://find-key.github.io/',
    avatar: 'https://find-key.github.io/images/head_image.jpg',
    description: 'To Be PWN Master',
    tag: 'ctf',
  },
  {
    name: 'wuye',
    url: 'https://www.mgoyy.cn/',
    avatar: 'https://www.mgoyy.cn/images/b0c1d74766dd8bce0ad860be15c46993a.jpg',
    description: '逆向魔法师 | RE',
    tag: 'ctf',
  },
  {
    name: 'moyue',
    url: 'https://qmoyue.github.io/',
    avatar: 'https://qmoyue.github.io/images/avatar.jpg',
    description: '抹月的奇妙冒险 | Web',
    tag: 'ctf',
  },
  {
    name: 'SoloWalker',
    url: 'https://s0lowalker.github.io/',
    avatar: 'https://s0lowalker.github.io/images/logo/solowalker.png',
    description: 'Web 安全',
    tag: 'ctf',
  },
  {
    name: 'Junwei LI',
    url: 'https://nandcpointfm.github.io/',
    avatar: 'https://nandcpointfm.github.io/images/head1.jpg',
    description: 'Natika 的游戏开发博客',
    tag: 'dev',
  },
  {
    name: 'Chai_na',
    url: 'https://chaina1.com/',
    avatar: 'https://chaina1.com/avatar.jpg',
    description: '计科小奶猫 | Algo',
    tag: 'ctf',
  },
  {
    name: 'Chloe',
    url: 'https://hey-chloe.github.io',
    avatar: 'https://avatars.githubusercontent.com/u/246075173?v=4',
    description: '研究工程师 | AI 工程师',
    tag: 'ai',
  },
  {
    name: 'Citlali@Official',
    url: 'https://bit7428.github.io/',
    avatar: 'https://bit7428.github.io/_astro/avatar.BpWGvWTL_Z1tTn3m.webp',
    description: '都会一点点',
    tag: 'ctf',
  },
];
