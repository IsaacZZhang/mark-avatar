// 内置素材清单（兜底包）
// 作用：断网 / 远程清单拉取失败时，首屏依然有水可用。
// 这些素材打进主包，路径指向代码包内资源，离线可用。
//
// 替换为正式素材时：保持 id 与文件名不变，直接用设计稿覆盖 assets/stickers/ 下的 PNG 即可。

module.exports = {
  manifestVersion: 1,
  updatedAt: 0,

  categories: [
    { id: 'funny', name: '搞怪', sort: 1 },
    { id: 'mood', name: '心情', sort: 2 },
    { id: 'life', name: '生活', sort: 3 }
  ],

  templates: [
    {
      id: 'sold_out',
      name: '卖掉了',
      category: 'funny',
      type: 'sticker',
      asset: '/assets/stickers/sold_out.png',
      layout: { cx: 0.5, cy: 0.83, scale: 0.8, rotate: -8, opacity: 1 },
      builtin: true
    },
    {
      id: 'gone',
      name: '已出',
      category: 'funny',
      type: 'sticker',
      asset: '/assets/stickers/gone.png',
      layout: { cx: 0.5, cy: 0.84, scale: 0.55, rotate: -6, opacity: 1 },
      builtin: true
    },
    {
      id: 'declutter',
      name: '断舍离',
      category: 'life',
      type: 'sticker',
      asset: '/assets/stickers/declutter.png',
      layout: { cx: 0.5, cy: 0.83, scale: 0.85, rotate: 0, opacity: 1 },
      builtin: true
    },
    {
      id: 'refunding',
      name: '回血中',
      category: 'life',
      type: 'sticker',
      asset: '/assets/stickers/refunding.png',
      layout: { cx: 0.5, cy: 0.84, scale: 0.7, rotate: 5, opacity: 1 },
      builtin: true
    },
    {
      id: 'not_sell',
      name: '不卖',
      category: 'funny',
      type: 'sticker',
      asset: '/assets/stickers/not_sell.png',
      layout: { cx: 0.5, cy: 0.82, scale: 0.55, rotate: 8, opacity: 1 },
      builtin: true
    },
    {
      id: 'worker',
      name: '打工人',
      category: 'mood',
      type: 'sticker',
      asset: '/assets/stickers/worker.png',
      layout: { cx: 0.5, cy: 0.83, scale: 0.8, rotate: -4, opacity: 1 },
      builtin: true
    },
    {
      id: 'read_noreply',
      name: '已读不回',
      category: 'mood',
      type: 'sticker',
      asset: '/assets/stickers/read_noreply.png',
      layout: { cx: 0.5, cy: 0.85, scale: 0.85, rotate: 0, opacity: 1 },
      builtin: true
    },
    {
      id: 'wanted',
      name: '头像征集中',
      category: 'funny',
      type: 'sticker',
      asset: '/assets/stickers/wanted.png',
      layout: { cx: 0.5, cy: 0.86, scale: 0.95, rotate: -3, opacity: 1 },
      builtin: true
    }
  ]
};
