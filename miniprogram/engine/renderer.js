// 渲染核心：把「底图 + 图层栈」画到一张 canvas 上
// 设计要点：
//   1) 纯函数式，不碰页面 state，预览与导出复用同一份逻辑
//   2) 画布 buffer 必须按 dpr 放大，否则 3x 屏导出必虚
//   3) 所有图片必须 await 加载完成再绘制，否则导出空白

const { sortByZ } = require('./layer.js');
const { roundRect } = require('./geometry.js');
const { load, loadRemote } = require('./image-loader.js');

const BADGE_RATIO = 0.12; // 小程序码角标占底图宽度比例

/**
 * @param {Object} canvas canvas 节点（页面 canvas 或离屏 canvas）
 * @param {Object} opts
 * @param {Object} opts.base   已加载的底图 image
 * @param {Array}  opts.layers 图层栈
 * @param {number} opts.size   逻辑边长（正方形）
 * @param {number} opts.dpr    像素比
 * @param {string} [opts.badgeUrl] 小程序码角标（不传则不画）
 * @param {string} [opts.bgColor]  背景色
 * @returns {Promise<{width:number, height:number}>} 物理像素尺寸
 */
async function render(canvas, opts) {
  const { base, layers, size, dpr, badgeUrl, bgColor } = opts;
  const ctx = canvas.getContext('2d');

  // 物理像素尺寸
  const pw = Math.round(size * dpr);
  const ph = Math.round(size * dpr);
  // 只在尺寸变化时才重设：手势期间每帧都调用 render，
  // 无条件重设 width 会每帧重新分配 buffer，低端机直接掉帧
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  ctx.clearRect(0, 0, pw, ph);
  ctx.save();
  ctx.scale(dpr, dpr); // 之后一律按逻辑像素作图

  const W = size;
  const H = size;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  // ① 底图：cover 裁剪居中
  if (base) drawCover(ctx, base, 0, 0, W, H);

  // ② 图层栈：按 zIndex 升序绘制
  const sorted = sortByZ(layers || []);
  for (const layer of sorted) {
    if (!layer || layer.hidden) continue;
    let img = null;
    if (layer.type !== 'text') {
      if (!layer.asset || !layer.asset.url) continue;
      img = layer.asset.img || (await loadRemote(canvas, layer.asset.url).catch(() => null));
      if (layer.asset) layer.asset.img = img; // 回填缓存
      if (!img) continue;
    }
    drawLayer(ctx, layer, img, W, H);
  }

  // ③ 角标：仅导出时绘制，固定右下，用户不可编辑
  if (badgeUrl) {
    const badge = await loadRemote(canvas, badgeUrl).catch(() => null);
    if (badge) drawBadge(ctx, badge, W, H);
  }

  ctx.restore();
  return { width: pw, height: ph };
}

/** 底图 cover 裁剪：居中裁掉多余部分，铺满目标区域 */
function drawCover(ctx, img, dx, dy, dw, dh) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sw, sh, sx, sy;
  if (ir > dr) {
    // 底图更宽，裁左右
    sh = img.height;
    sw = sh * dr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // 底图更高，裁上下
    sw = img.width;
    sh = sw / dr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** 单个图层：以中心点定位，支持旋转与透明度 */
function drawLayer(ctx, layer, img, W, H) {
  const t = layer.transform;
  const px = t.cx * W;
  const py = t.cy * H;

  let w, h;
  if (layer.type === 'text') {
    ctx.font = layer.text.font;
    w = ctx.measureText(layer.text.content).width;
    h = parseFloat(layer.text.font) || 96;
  } else {
    w = t.scale * W;
    h = w * (img.height / img.width);
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((t.rotate * Math.PI) / 180);
  ctx.globalAlpha = t.opacity;

  if (layer.type === 'text') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (layer.text.stroke) {
      // 描边：中文字体在复杂底图上不描边几乎看不清
      ctx.lineWidth = h * (layer.text.strokeWidthRatio || 0.12);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = layer.text.stroke;
      ctx.strokeText(layer.text.content, 0, 0);
    }
    ctx.fillStyle = layer.text.color;
    ctx.fillText(layer.text.content, 0, 0);
  } else {
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

/**
 * 小程序码角标
 * 必须垫白底：深色背景上不垫白底，码的边缘会被背景干扰导致扫不出来
 */
function drawBadge(ctx, badge, W, H) {
  const size = W * BADGE_RATIO;
  const pad = 5;
  const x = W - size - 8;
  const y = H - size - 8;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 6;
  roundRect(ctx, x, y, size, size, 6);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(badge, x + pad, y + pad, size - pad * 2, size - pad * 2);
}

module.exports = { render, drawCover, drawLayer, drawBadge, BADGE_RATIO };
