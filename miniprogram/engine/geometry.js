// 几何计算：归一化坐标 ↔ 像素坐标、命中检测、变换

const MIN_SCALE = 0.15; // 最小缩放（占底图宽比例）
const MAX_SCALE = 1.6;

/** 归一化 → 像素 */
function toPixel(t, W, H) {
  return { x: t.cx * W, y: t.cy * H };
}

/** 像素 → 归一化 */
function toNorm(px, py, W, H) {
  return { cx: px / W, cy: py / H };
}

function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/**
 * 命中检测：判断触点 (px,py) 是否落在图层上
 * 做法：把触点反向平移+反向旋转到图层局部坐标系，再与图层矩形比较
 * @param {Object} layer 图层
 * @param {number} px,py 触点像素坐标
 * @param {number} W,H 底图逻辑尺寸
 * @param {number} iw,ih 图层原始像素宽高（文字图层传测量值）
 */
function hitTest(layer, px, py, W, H, iw, ih) {
  const t = layer.transform;
  const cx = t.cx * W;
  const cy = t.cy * H;
  const w = t.scale * W;
  const h = w * (ih / iw);

  // 反向旋转到图层局部坐标
  const rad = (-t.rotate * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

  // 放宽 12px 触控热区，手指没那么准
  const pad = 12;
  return Math.abs(lx) <= w / 2 + pad && Math.abs(ly) <= h / 2 + pad;
}

/** 从最上层往下找命中的图层 */
function pickLayer(layers, px, py, W, H) {
  const sorted = layers.slice().sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
  for (const layer of sorted) {
    if (layer.hidden || layer.locked) continue;
    const img = layer.asset && layer.asset.img;
    const iw = layer.type === 'text' ? 100 : img ? img.width : 100;
    const ih = layer.type === 'text' ? 100 : img ? img.height : 100;
    if (hitTest(layer, px, py, W, H, iw, ih)) return layer;
  }
  return null;
}

/** 两指距离与夹角，用于缩放/旋转手势 */
function pinch(t1, t2) {
  return {
    dist: Math.hypot(t2.x - t1.x, t2.y - t1.y),
    angle: (Math.atan2(t2.y - t1.y, t2.x - t1.x) * 180) / Math.PI
  };
}

/** 圆角矩形路径（角标白底用） */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

module.exports = {
  toPixel,
  toNorm,
  clampScale,
  hitTest,
  pickLayer,
  pinch,
  roundRect,
  MIN_SCALE,
  MAX_SCALE
};
