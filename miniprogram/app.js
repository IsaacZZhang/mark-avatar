// TODO: 开通云开发后填入环境 ID（微信开发者工具 → 云开发 → 环境 → 环境 ID）
// 留空时小程序以纯离线模式运行，内置素材照常可用，只是没有热更和统计。
const CLOUD_ENV = '';

App({
  onLaunch() {
    if (CLOUD_ENV && wx.cloud) {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
    }

    const sys = wx.getSystemInfoSync();
    this.globalData.dpr = Math.min(sys.pixelRatio || 2, 2); // 顶到 2 就够，3x 屏再乘收益极小但内存翻倍
    this.globalData.windowWidth = sys.windowWidth;
    this.globalData.cloudReady = !!CLOUD_ENV;
  },

  globalData: {
    dpr: 2,
    windowWidth: 375,
    cloudReady: false,
    badgeUrl: '', // 小程序码角标，云函数就绪后写入
    showBadge: true
  }
});
