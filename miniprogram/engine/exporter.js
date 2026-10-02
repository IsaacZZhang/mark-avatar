// 导出与保存
// 导出走「离屏 canvas 重新渲染一遍」而不是截取屏幕 canvas：
//   1) 导出尺寸固定 1080，不受屏幕分辨率影响
//   2) 屏幕上看到的是 540 预览档，导出不糊
//   3) 规避部分安卓机「canvas 被移出可视区导出黑屏」的已知问题

const { render } = require('./renderer.js');

const OUT_SIZE = 1080; // 导出边长（微信头像显示为正方形，1080 足够清晰）

/**
 * 高清导出并保存到相册
 * @param {Object} opts
 * @param {Object} opts.base  底图 image
 * @param {Array}  opts.layers 图层栈
 * @param {string} [opts.badgeUrl] 小程序码角标
 * @param {number} [opts.size] 导出边长，默认 1080
 */
/**
 * 只导出，不保存
 * 结果页要先给用户看成品再决定存不存，避免「保存了才发现不喜欢」污染相册
 * @returns {Promise<{tempFilePath:string, cost:number}>}
 */
async function exportImage(opts) {
  const size = opts.size || OUT_SIZE;
  const t0 = Date.now();

  // 离屏 canvas，dpr 固定 1（size 已是物理像素）
  const off = wx.createOffscreenCanvas({ type: '2d', width: size, height: size });

  await render(off, {
    base: opts.base,
    layers: opts.layers,
    badgeUrl: opts.badgeUrl,
    size: size,
    dpr: 1
  });

  const tempFilePath = await canvasToTemp(off, size);
  return { tempFilePath, cost: Date.now() - t0 };
}

/** 导出并直接保存（一键流程，结果页不再需要时用） */
async function exportAndSave(opts) {
  const r = await exportImage(opts);
  const saved = await saveToAlbum(r.tempFilePath);
  return { saved, tempFilePath: r.tempFilePath, cost: r.cost };
}

function canvasToTemp(canvas, size) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas, // 2d 模式必须传 canvas 实例，不是 canvasId
      x: 0,
      y: 0,
      width: size,
      height: size,
      destWidth: size,
      destHeight: size,
      fileType: 'jpg', // png 在相册里体积大，水印场景无透明需求
      quality: 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

/**
 * 保存到相册
 * 注意：用户曾拒绝过授权时，直接调用会走 fail，必须引导去设置页
 */
async function saveToAlbum(filePath) {
  try {
    const setting = await wx.getSetting();
    if (setting.authSetting['scope.writePhotosAlbum'] === false) {
      const res = await wx.showModal({
        title: '需要相册权限',
        content: '去设置页开启「保存到相册」，才能把头像存下来',
        confirmText: '去设置'
      });
      if (res.confirm) {
        await wx.openAppAuthorizeSetting();
      }
      return false;
    }

    await wx.saveImageToPhotosAlbum({ filePath });
    return true;
  } catch (e) {
    const msg = (e && e.errMsg) || '';
    // 用户主动取消不算失败，不弹错误提示
    if (!/auth deny|cancel|fail auth/i.test(msg)) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
    return false;
  }
}

module.exports = { exportImage, exportAndSave, canvasToTemp, saveToAlbum, OUT_SIZE };
