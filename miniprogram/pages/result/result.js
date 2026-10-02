const app = getApp();
const { saveToAlbum } = require('../../engine/exporter.js');
const stats = require('../../services/stats.js');

// 微信不开放「程序化更换用户头像」的 API，任何声称能自动换的都是假的。
// 唯一能做的是把成品存进相册，再引导用户走微信自己的换头像路径。
// 这段引导文案是这个小程序的转化咽喉，写清楚比写漂亮重要。
const CHANGE_STEPS = [
  '微信 →「我」→ 点头像',
  '右上角「…」→「从相册选择」',
  '选刚保存的这张图 → 完成'
];

Page({
  data: {
    path: '',
    saved: false,
    steps: CHANGE_STEPS
  },

  onLoad() {
    const r = app.globalData.lastResult;
    if (!r || !r.path) {
      // 直接进结果页没有成品，退回编辑器，不留空白页
      wx.redirectTo({ url: '/pages/editor/editor' });
      return;
    }
    this.setData({ path: r.path });
    stats.track('view_result', { templateId: r.templateId || '', cost: r.cost || 0 });
  },

  async onSave() {
    if (this.data.saved) return;
    const r = app.globalData.lastResult || {};
    const ok = await saveToAlbum(this.data.path);
    this.setData({ saved: ok });
    if (ok) {
      wx.showToast({ title: '已存到相册', icon: 'success' });
      stats.track('save_image', { templateId: r.templateId || '', cost: r.cost || 0 });
    }
  },

  onPreview() {
    wx.previewImage({ urls: [this.data.path], current: this.data.path });
  },

  // 回编辑器继续调：保留原图与图层，不清空
  onBackEdit() {
    const r = app.globalData.lastResult || {};
    stats.track('back_edit', { templateId: r.templateId || '' });
    wx.navigateBack();
  },

  onRestart() {
    app.globalData.lastResult = null;
    wx.reLaunch({ url: '/pages/editor/editor' });
  },

  /**
   * 分享卡片带成品图：朋友点开看到的不是默认灰图，而是用户自己做好的头像。
   * 这是这个小程序唯一的低成本增长口子（个人主体开不了流量主，没有别的投放渠道）。
   */
  onShareAppMessage() {
    const r = app.globalData.lastResult || {};
    if (r.templateId) stats.track('share', { templateId: r.templateId, from: 'result' });
    return {
      title: '我刚给头像加了个水印，你也来试试',
      path: '/pages/editor/editor',
      imageUrl: this.data.path || ''
    };
  },

  onShareTimeline() {
    return {
      title: '给头像加个水印，30 秒搞定',
      query: '',
      imageUrl: this.data.path || ''
    };
  }
});
