#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成本地预览页 preview/index.html

用途：不用装微信开发者工具，直接在浏览器里体验编辑器效果，
      方便随时 review 交互和视觉方向。素材与底图以 base64 内嵌，
      生成的是单文件 HTML，双击即可打开。

说明：预览页用 Web Canvas 2D 复刻了小程序端 engine/ 的渲染逻辑
      （分层绘制、归一化坐标、cover 裁剪、变换），API 与小程序基本一致。

用法：python3 tools/gen_preview.py
"""
import base64
import os

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
STICKER_DIR = os.path.join(ROOT, "miniprogram", "assets", "stickers")
SAMPLE_PATH = os.path.join(ROOT, "preview", "sample-avatar.png")
OUT_PATH = os.path.join(ROOT, "preview", "index.html")

# 与 miniprogram/config/templates.js 保持一致
STICKERS = [
    ("sold_out",     "卖掉了",   "funny", 0.5, 0.83, 0.80,  -8),
    ("gone",         "已出",     "funny", 0.5, 0.84, 0.55,  -6),
    ("not_sell",     "不卖",     "funny", 0.5, 0.82, 0.55,   8),
    ("wanted",       "头像征集中","funny", 0.5, 0.86, 0.95,  -3),
    ("declutter",    "断舍离",   "life",  0.5, 0.83, 0.85,   0),
    ("refunding",    "回血中",   "life",  0.5, 0.84, 0.70,   5),
    ("worker",       "打工人",   "mood",  0.5, 0.83, 0.80,  -4),
    ("read_noreply", "已读不回", "mood",  0.5, 0.85, 0.85,   0),
]

CATS = [("funny", "搞怪"), ("mood", "心情"), ("life", "生活")]


def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def make_sample_avatar(size=640):
    """生成示例底图：渐变背景 + 人物剪影，代替真实头像"""
    img = Image.new("RGB", (size, size), (255, 255, 255))
    d = ImageDraw.Draw(img)

    # 竖向渐变
    for y in range(size):
        t = y / size
        r = int(120 + 135 * t)
        g = int(190 - 60 * t)
        b = int(240 - 90 * t)
        d.line([(0, y), (size, y)], fill=(r, g, b))

    # 人物剪影：头 + 肩
    cx = size / 2
    head_r = size * 0.17
    head_cy = size * 0.40
    d.ellipse(
        [cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
        fill=(255, 255, 255),
    )
    d.ellipse(
        [cx - size * 0.26, size * 0.62, cx + size * 0.26, size * 1.12],
        fill=(255, 255, 255),
    )
    os.makedirs(os.path.dirname(SAMPLE_PATH), exist_ok=True)
    img.save(SAMPLE_PATH)
    return SAMPLE_PATH


HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>头像水印 · 本地预览</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; padding: 24px; background: #eceef2; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .hint { max-width: 420px; font-size: 13px; line-height: 1.7; color: #666; background: #fff;
          border-radius: 12px; padding: 14px 16px; }
  .hint b { color: #1a1a1a; }
  .phone {
    width: 375px; background: #f5f5f7; border-radius: 28px; overflow: hidden;
    box-shadow: 0 12px 40px rgba(0,0,0,.18); border: 8px solid #222;
  }
  .navbar { height: 44px; line-height: 44px; text-align: center; font-size: 15px;
            font-weight: 600; background: #fff; border-bottom: 1px solid #eee; }
  .stage-wrap { position: relative; margin: 12px auto; width: 335px; height: 335px;
                background: #fff; border-radius: 14px; overflow: hidden;
                box-shadow: 0 4px 16px rgba(0,0,0,.06); }
  canvas { display: block; width: 335px; height: 335px; touch-action: none; }
  .picker { background: #fff; border-radius: 16px 16px 0 0; padding: 8px 0 4px; }
  .cats { display: flex; gap: 8px; padding: 4px 12px 8px; overflow-x: auto; }
  .cat { flex: none; padding: 6px 14px; font-size: 12px; color: #666; background: #f2f2f7;
         border-radius: 16px; cursor: pointer; }
  .cat.on { color: #fff; background: #07c160; }
  .stickers { display: flex; gap: 8px; padding: 4px 12px 10px; overflow-x: auto; }
  .sticker { flex: none; width: 78px; text-align: center; cursor: pointer; }
  .sticker img { width: 78px; height: 48px; object-fit: contain; background: #fafafa;
                 border-radius: 8px; }
  .sticker span { display: block; font-size: 11px; color: #666; margin-top: 4px; }
  .toolbar { display: flex; gap: 8px; padding: 10px 12px 16px; background: #fff; }
  .btn { flex: 1; height: 40px; line-height: 40px; font-size: 13px; color: #333;
         background: #f2f2f7; border: none; border-radius: 10px; cursor: pointer; }
  .btn.primary { flex: 1.6; color: #fff; background: #07c160; }
  .controls { width: 375px; background: #fff; border-radius: 14px; padding: 12px 14px;
              font-size: 12px; color: #555; display: none; }
  .controls.show { display: block; }
  .row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
  .row label { width: 52px; flex: none; }
  .row input[type=range] { flex: 1; }
  .row .val { width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
  /* —— 结果页视图，与 miniprogram/pages/result 一一对应 —— */
  #resultView { display: none; padding: 0 12px 16px; }
  #resultView.show { display: block; }
  .r-card { background: #fff; border-radius: 14px; padding: 12px; margin-top: 12px; }
  .r-img { width: 100%; height: 280px; object-fit: contain; background: #eee; border-radius: 10px; }
  .r-tip { text-align: center; font-size: 11px; color: #999; margin-top: 8px; }
  .r-guide { background: #fff; border-radius: 14px; padding: 14px; margin-top: 16px; }
  .r-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
  .r-step { display: flex; align-items: flex-start; margin-bottom: 9px; font-size: 13px; color: #333; }
  .r-idx { flex: none; width: 18px; height: 18px; line-height: 18px; text-align: center;
           border-radius: 50%; background: #07c160; color: #fff; font-size: 10px;
           margin-right: 8px; margin-top: 2px; }
  .r-note { font-size: 11px; color: #a0a0a0; margin-top: 6px; line-height: 1.5; }
  .r-btn { width: 100%; height: 42px; line-height: 42px; font-size: 14px; color: #fff;
           background: #07c160; border: none; border-radius: 22px; cursor: pointer; margin-top: 18px; }
  .r-sub { display: flex; gap: 10px; margin-top: 10px; }
  .r-ghost { flex: 1; height: 38px; line-height: 38px; font-size: 13px; color: #333;
             background: #fff; border: none; border-radius: 19px; cursor: pointer; }
  .r-back { text-align: center; font-size: 12px; color: #8a8a8a; margin-top: 14px; cursor: pointer; }
</style>
</head>
<body>

<div class="hint">
  <b>本地预览页</b>：复刻小程序端 <code>engine/</code> 的渲染逻辑，交互与真机一致。<br>
  编辑器：点素材加水印 → 拖拽移动 → 用控制条或双指/滚轮调整。<br>
  点「做好了」进<b>结果页</b>（换头像引导 + 保存到相册），点「继续调整」可退回。<br>
  想看真实效果：点「换底图」或直接把照片拖到画布上。<br>
  <span style="color:#999">这是产物预览，不是小程序本身；真机效果请用微信开发者工具导入项目。</span>
</div>

<div class="phone">
  <div class="navbar">头像水印</div>
  <div class="stage-wrap"><canvas id="stage"></canvas></div>

  <div class="picker">
    <div class="cats" id="cats"></div>
    <div class="stickers" id="stickers"></div>
  </div>

  <div class="toolbar">
    <button class="btn" onclick="pickImage()">换底图</button>
    <button class="btn" onclick="delCurrent()">删除</button>
    <button class="btn" onclick="resetAll()">清空</button>
    <button class="btn primary" onclick="goResult()">做好了</button>
  </div>

  <div id="resultView">
    <div class="r-card">
      <img class="r-img" id="rImg" />
      <div class="r-tip">点图片可以放大看细节</div>
    </div>
    <div class="r-guide">
      <div class="r-title">怎么换成微信头像</div>
      <div class="r-step"><span class="r-idx">1</span><span>微信 →「我」→ 点头像</span></div>
      <div class="r-step"><span class="r-idx">2</span><span>右上角「…」→「从相册选择」</span></div>
      <div class="r-step"><span class="r-idx">3</span><span>选刚保存的这张图 → 完成</span></div>
      <div class="r-note">微信不开放自动换头像的接口，这步只能手动，3 秒的事</div>
    </div>
    <button class="r-btn" id="rSave" onclick="download()">保存到相册</button>
    <div class="r-sub">
      <button class="r-ghost" onclick="backEdit()">继续调整</button>
      <button class="r-ghost" onclick="alert('真机上这里是微信分享面板，会带成品图作为卡片封面')">分享给朋友</button>
    </div>
    <div class="r-back" onclick="backEdit()">换张图重做</div>
  </div>
</div>

<input type="file" id="fileIn" accept="image/*" style="display:none">

<div class="controls" id="controls">
  <div class="row"><label>缩放</label><input type="range" id="cScale" min="15" max="160" value="80"><span class="val" id="vScale"></span></div>
  <div class="row"><label>旋转</label><input type="range" id="cRot" min="-180" max="180" value="0"><span class="val" id="vRot"></span></div>
  <div class="row"><label>透明度</label><input type="range" id="cOpa" min="20" max="100" value="100"><span class="val" id="vOpa"></span></div>
</div>

<script>
const STICKERS = __STICKERS__;
const CATS = __CATS__;
const AVATAR = "__AVATAR__";
const SIZE = 335;
const DPR = Math.min(window.devicePixelRatio || 2, 2);

const cv = document.getElementById('stage');
const ctx = cv.getContext('2d');
cv.width = SIZE * DPR; cv.height = SIZE * DPR;
ctx.scale(DPR, DPR);

let base = null;
let layers = [];
let current = null;
let seq = 0;
let activeCat = CATS[0][0];
const imgCache = {};

function loadImg(src) {
  return new Promise((res, rej) => {
    if (imgCache[src]) return res(imgCache[src]);
    const im = new Image();
    im.onload = () => { imgCache[src] = im; res(im); };
    im.onerror = rej;
    im.src = src;
  });
}

// —— 渲染：与 engine/renderer.js 同构 ——
function drawCover(img, w, h) {
  const ir = img.width / img.height, dr = w / h;
  let sw, sh, sx, sy;
  if (ir > dr) { sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function draw() {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (base) drawCover(base, SIZE, SIZE);

  layers.slice().sort((a, b) => a.z - b.z).forEach((l) => {
    const img = l.img;
    if (!img) return;
    const t = l.t;
    const px = t.cx * SIZE, py = t.cy * SIZE;
    const w = t.scale * SIZE, h = w * (img.height / img.width);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t.rotate * Math.PI / 180);
    ctx.globalAlpha = t.opacity;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  });
}

// —— 素材选择 ——
function renderCats() {
  document.getElementById('cats').innerHTML = CATS.map(([id, name]) =>
    `<div class="cat ${id === activeCat ? 'on' : ''}" data-c="${id}">${name}</div>`).join('');
  document.querySelectorAll('.cat').forEach((el) =>
    el.onclick = () => { activeCat = el.dataset.c; renderCats(); renderStickers(); });
}

function renderStickers() {
  const list = STICKERS.filter((s) => s.cat === activeCat);
  document.getElementById('stickers').innerHTML = list.map((s) =>
    `<div class="sticker" data-id="${s.id}" data-src="${s.src}" title="${s.name}">
       <img src="${s.src}"><span>${s.name}</span></div>`).join('');
  document.querySelectorAll('.sticker').forEach((el) =>
    el.onclick = () => addSticker(el.dataset.id, el.dataset.src));
}

async function addSticker(id, src) {
  const s = STICKERS.find((x) => x.id === id);
  const img = await loadImg(src);
  const layer = { id: ++seq, z: 10 + seq, img: img, templateId: id,
    t: { cx: s.cx, cy: s.cy, scale: s.scale, rotate: s.rotate, opacity: 1 } };
  layers.push(layer);
  current = layer;
  syncControls();
  draw();
}

// —— 命中检测（与 engine/geometry.js 同构）——
function hitTest(l, px, py) {
  const cx = l.t.cx * SIZE, cy = l.t.cy * SIZE;
  const w = l.t.scale * SIZE, h = w * (l.img.height / l.img.width);
  const rad = -l.t.rotate * Math.PI / 180;
  const dx = px - cx, dy = py - cy;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(lx) <= w / 2 + 12 && Math.abs(ly) <= h / 2 + 12;
}

function pick(px, py) {
  const sorted = layers.slice().sort((a, b) => b.z - a.z);
  for (const l of sorted) if (hitTest(l, px, py)) return l;
  return null;
}

// —— 手势：单指/鼠标拖拽 + 双指缩放旋转 + 滚轮缩放 ——
let drag = null, pinchState = null;

function localPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

cv.addEventListener('pointerdown', (e) => {
  const p = localPos(e);
  const hit = pick(p.x, p.y);
  current = hit;
  syncControls();
  if (!hit) return;
  drag = { px: p.x, py: p.y, t: Object.assign({}, hit.t) };
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointermove', (e) => {
  if (!drag || !current) return;
  const p = localPos(e);
  current.t.cx = drag.t.cx + (p.x - drag.px) / SIZE;
  current.t.cy = drag.t.cy + (p.y - drag.py) / SIZE;
  draw();
});

cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('pointercancel', () => { drag = null; });

cv.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2 && current) {
    pinchState = pinch(e.touches[0], e.touches[1]);
    pinchState.baseT = Object.assign({}, current.t);
  }
}, { passive: true });

cv.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinchState && current) {
    e.preventDefault();
    const cur = pinch(e.touches[0], e.touches[1]);
    const ratio = cur.dist / pinchState.dist;
    current.t.scale = Math.min(1.6, Math.max(0.15, pinchState.baseT.scale * ratio));
    current.t.rotate = pinchState.baseT.rotate + (cur.angle - pinchState.angle);
    syncControls();
    draw();
  }
}, { passive: false });

cv.addEventListener('touchend', () => { pinchState = null; });

cv.addEventListener('wheel', (e) => {
  if (!current) return;
  e.preventDefault();
  const d = e.deltaY > 0 ? -0.03 : 0.03;
  current.t.scale = Math.min(1.6, Math.max(0.15, current.t.scale + d));
  syncControls();
  draw();
});

function pinch(t1, t2) {
  return {
    dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
    angle: Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI
  };
}

// —— 控制条 ——
function syncControls() {
  const box = document.getElementById('controls');
  if (!current) { box.classList.remove('show'); return; }
  box.classList.add('show');
  document.getElementById('cScale').value = Math.round(current.t.scale * 100);
  document.getElementById('cRot').value = Math.round(current.t.rotate);
  document.getElementById('cOpa').value = Math.round(current.t.opacity * 100);
  updateVals();
}

function updateVals() {
  document.getElementById('vScale').textContent = document.getElementById('cScale').value + '%';
  document.getElementById('vRot').textContent = document.getElementById('cRot').value + '°';
  document.getElementById('vOpa').textContent = document.getElementById('cOpa').value + '%';
}

['cScale', 'cRot', 'cOpa'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    if (!current) return;
    const v = +document.getElementById(id).value;
    if (id === 'cScale') current.t.scale = v / 100;
    if (id === 'cRot') current.t.rotate = v;
    if (id === 'cOpa') current.t.opacity = v / 100;
    updateVals();
    draw();
  });
});

function delCurrent() {
  if (!current) return;
  layers = layers.filter((l) => l.id !== current.id);
  current = null;
  syncControls();
  draw();
}

function resetAll() {
  layers = []; current = null;
  syncControls();
  draw();
}

// 导出 1080 成品，返回 dataURL（与小程序 exporter.exportImage 同构）
function exportImage() {
  const off = document.createElement('canvas');
  off.width = 1080; off.height = 1080;
  const octx = off.getContext('2d');
  const k = 1080 / SIZE;
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, 1080, 1080);
  if (base) {
    const ir = base.width / base.height, dr = 1;
    let sw, sh, sx, sy;
    if (ir > dr) { sh = base.height; sw = sh * dr; sx = (base.width - sw) / 2; sy = 0; }
    else { sw = base.width; sh = sw / dr; sx = 0; sy = (base.height - sh) / 2; }
    octx.drawImage(base, sx, sy, sw, sh, 0, 0, 1080, 1080);
  }
  layers.slice().sort((a, b) => a.z - b.z).forEach((l) => {
    const t = l.t;
    const w = t.scale * 1080, h = w * (l.img.height / l.img.width);
    octx.save();
    octx.translate(t.cx * 1080, t.cy * 1080);
    octx.rotate(t.rotate * Math.PI / 180);
    octx.globalAlpha = t.opacity;
    octx.drawImage(l.img, -w / 2, -h / 2, w, h);
    octx.restore();
  });
  return off.toDataURL('image/jpeg', 0.92);
}

// —— 结果页视图：与 miniprogram/pages/result 一一对应 ——
let resultDataUrl = '';

function goResult() {
  resultDataUrl = exportImage();
  document.getElementById('rImg').src = resultDataUrl;
  document.getElementById('rSave').textContent = '保存到相册';
  // 切视图：藏画布与素材条，显示结果页
  document.querySelector('.stage-wrap').style.display = 'none';
  document.querySelector('.picker').style.display = 'none';
  document.querySelector('.toolbar').style.display = 'none';
  document.querySelector('.navbar').textContent = '做好了';
  document.getElementById('resultView').classList.add('show');
  document.getElementById('controls').classList.remove('show');
}

function backEdit() {
  document.querySelector('.stage-wrap').style.display = '';
  document.querySelector('.picker').style.display = '';
  document.querySelector('.toolbar').style.display = '';
  document.querySelector('.navbar').textContent = '头像水印';
  document.getElementById('resultView').classList.remove('show');
  if (current) document.getElementById('controls').classList.add('show');
}

function download() {
  const a = document.createElement('a');
  a.download = 'avatar-watermark.jpg';
  a.href = resultDataUrl || exportImage();
  a.click();
  document.getElementById('rSave').textContent = '已存到相册';
}

// —— 换底图：上传自己的照片/头像看真实效果 ——
function pickImage() { document.getElementById('fileIn').click(); }
document.getElementById('fileIn').addEventListener('change', async function (e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const im = await loadImg(url);
    base = im;
    draw();
  } catch (err) { alert('这张图读不出来，换一张试试'); }
  e.target.value = '';
});

// 舞台支持直接把图片拖进来
const wrap = document.querySelector('.stage-wrap');
wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.style.outline = '2px dashed #07c160'; });
wrap.addEventListener('dragleave', () => { wrap.style.outline = ''; });
wrap.addEventListener('drop', async (e) => {
  e.preventDefault(); wrap.style.outline = '';
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f || !f.type.startsWith('image/')) return;
  try { base = await loadImg(URL.createObjectURL(f)); draw(); } catch (err) {}
});

// —— 启动 ——
(async function init() {
  base = await loadImg(AVATAR);
  renderCats();
  renderStickers();
  await addSticker('sold_out', STICKERS[0].src); // 默认给一个，进来就有东西看
  current = null;
  syncControls();
  draw();
})();
</script>
</body>
</html>
"""


def main():
    avatar = make_sample_avatar()

    stickers_js = "[\n" + ",\n".join(
        '  { id: "%s", name: "%s", cat: "%s", src: "data:image/png;base64,%s", '
        "cx: %s, cy: %s, scale: %s, rotate: %s }" % (
            sid, name, cat, b64(os.path.join(STICKER_DIR, sid + ".png")),
            cx, cy, scale, rot)
        for sid, name, cat, cx, cy, scale, rot in STICKERS
    ) + "\n]"

    cats_js = "[" + ", ".join('["%s", "%s"]' % (i, n) for i, n in CATS) + "]"

    html = HTML.replace("__STICKERS__", stickers_js)
    html = html.replace("__CATS__", cats_js)
    html = html.replace("__AVATAR__", "data:image/png;base64," + b64(avatar))

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print("生成完成: %s (%.1f KB)" % (os.path.abspath(OUT_PATH), os.path.getsize(OUT_PATH) / 1024))


if __name__ == "__main__":
    main()
