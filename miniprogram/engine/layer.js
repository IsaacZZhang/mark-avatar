// 图层模型
// 坐标一律使用「相对底图的归一化比例」(0~1)，不存像素值。
// 这样同一份配置在 540 预览 / 1080 导出 / 任意尺寸底图上都能正确还原。

let _seq = 0;

/**
 * 从素材模板创建贴纸图层
 * @param {Object} tpl manifest 中的模板项
 */
function createStickerLayer(tpl) {
  const l = tpl.layout || {};
  return {
    id: 'L' + ++_seq,
    type: 'sticker',
    zIndex: 10 + _seq,
    transform: {
      cx: l.cx != null ? l.cx : 0.5,
      cy: l.cy != null ? l.cy : 0.82,
      scale: l.scale != null ? l.scale : 0.78, // 宽度占底图宽的比例
      rotate: l.rotate != null ? l.rotate : 0, // 角度
      opacity: l.opacity != null ? l.opacity : 1
    },
    asset: {
      url: tpl.asset,
      img: null // 加载后填充
    },
    templateId: tpl.id,
    hidden: false,
    locked: false
  };
}

/**
 * 创建文字图层（二期自定义文字水印用）
 */
function createTextLayer(content, opts = {}) {
  return {
    id: 'L' + ++_seq,
    type: 'text',
    zIndex: 10 + _seq,
    transform: {
      cx: opts.cx != null ? opts.cx : 0.5,
      cy: opts.cy != null ? opts.cy : 0.85,
      scale: opts.scale != null ? opts.scale : 0.8,
      rotate: opts.rotate != null ? opts.rotate : 0,
      opacity: opts.opacity != null ? opts.opacity : 1
    },
    text: {
      content: content,
      font: opts.font || 'bold 96px sans-serif',
      color: opts.color || '#FF3B30',
      stroke: opts.stroke || '#FFFFFF',
      strokeWidthRatio: 0.12
    },
    hidden: false,
    locked: false
  };
}

/** 按 zIndex 升序返回副本，供渲染遍历 */
function sortByZ(layers) {
  return layers.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
}

/** 顶层图层（最后绘制 = 视觉最上层） */
function topLayer(layers) {
  if (!layers.length) return null;
  return sortByZ(layers)[layers.length - 1];
}

module.exports = {
  createStickerLayer,
  createTextLayer,
  sortByZ,
  topLayer
};
