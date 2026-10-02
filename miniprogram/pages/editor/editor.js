const app = getApp();

const { createStickerLayer } = require('../../engine/layer.js');
const { render } = require('../../engine/renderer.js');
const { exportAndSave } = require('../../engine/exporter.js');
const { load, loadRemote } = require('../../engine/image-loader.js');
const { pickLayer, pinch, clampScale } = require('../../engine/geometry.js');
const BUILTIN = require('../../config/templates.js');

// TODO: 素材热更地址。开通云开发后，把 manifest.json 传到云存储，
//       在这里填它的下载域名地址（记得在 mp 后台加入 downloadFile 合法域名）
const MANIFEST_URL = '';

Page({
  data: {
    stageSize: 0,
    hasBase: false,
    categories: [],
    templates: [],
    activeCat: '',
    hasSelection: false,
    saving: false
  },

  // —— 非响应式状态：放 this 而不是 data ——
  // 手势过程中绝对不要 setData，跨线程桥接会打爆 60fps
  canvas: null,
  stageSize: 0,
  dpr: 2,
  baseImg: null,
  layers: [],
  current: null,
  rect: { left: 0, top: 0 },
  touchState: null,
  manifest: null,

  onReady() {
    this.initStage();
    this.initManifest();
  },

  // ---------- 画布初始化 ----------
  async initStage() {
    this.dpr = app.globalData.dpr || 2;

    const res = await new Promise((resolve) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#stage')
        .fields({ node: true, size: true, rect: true })
        .exec(resolve);
    });

    const node = res && res[0];
    if (!node || !node.node) {
      console.error('[editor] canvas 节点未找到');
      return;
    }

    this.canvas = node.node;
    this.stageSize = Math.floor(node.width);
    this.rect = { left: node.left || 0, top: node.top || 0 };
    this.setData({ stageSize: this.stageSize });

    // 默认底图：先用内置素材的第一个当示例，用户选图后替换
    // （让首次进来就有东西可看，而不是一块空白画布）
    await this.draw();
  },

  // ---------- 素材清单 ----------
  initManifest() {
    this.applyManifest(BUILTIN); // 先用内置包渲染，首屏不等网络
    if (MANIFEST_URL) this.fetchRemoteManifest();
  },

  applyManifest(m) {
    this.manifest = m;
    const cats = (m.categories || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const activeCat = cats.length ? cats[0].id : '';
    this.setData({
      categories: cats,
      activeCat: activeCat,
      templates: this.filterByCat(activeCat)
    });
  },

  filterByCat(catId) {
    return (this.manifest.templates || []).filter((t) => !catId || t.category === catId);
  },

  async fetchRemoteManifest() {
    try {
      const remote = await new Promise((resolve, reject) => {
        wx.request({
          url: MANIFEST_URL,
          timeout: 3000,
          success: (r) => (r.statusCode === 200 ? resolve(r.data) : reject(r)),
          fail: reject
        });
      });
      // 只在版本更新时替换，避免无谓刷新
      if (remote && remote.manifestVersion > (this.manifest.manifestVersion || 0)) {
        wx.setStorageSync('wm_manifest', remote);
        this.applyManifest(remote);
      }
    } catch (e) {
      // 网络失败就继续用内置/缓存清单，工具型小程序不能因为网络差打不开
      console.warn('[editor] 远程清单拉取失败，使用本地清单');
    }
  },

  onSwitchCat(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ activeCat: id, templates: this.filterByCat(id) });
  },

  // ---------- 选图 ----------
  async onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl;
    if (!url) return;
    await this.setBase(url);
  },

  async onChooseAlbum() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['original']
      });
      const file = res.tempFiles && res.tempFiles[0];
      if (file) await this.setBase(file.tempFilePath);
    } catch (err) {
      // 用户取消不算错误
      if (!/cancel/i.test((err && err.errMsg) || '')) {
        wx.showToast({ title: '选图失败', icon: 'none' });
      }
    }
  },

  /**
   * 设置底图
   * 必须压缩：相册原图动辄 4000px，直接进 canvas 会让低端机 OOM
   */
  async setBase(path) {
    wx.showLoading({ title: '处理中', mask: true });
    try {
      let src = path;
      try {
        const c = await wx.compressImage({
          src: path,
          quality: 80,
          compressedWidth: 1080,
          compressedHeight: 1080
        });
        src = c.tempFilePath;
      } catch (e) {
        // 压缩失败就用原图（微信头像本身不大，一般走不到这里）
      }

      this.baseImg = await load(this.canvas, src);
      this.setData({ hasBase: true });
      await this.draw();
    } catch (err) {
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // ---------- 加水印 ----------
  async onPickTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const tpl = (this.manifest.templates || []).find((t) => t.id === id);
    if (!tpl) return;

    // 预加载，保证点击即出效果
    let img = null;
    try {
      img = await loadRemote(this.canvas, tpl.asset);
    } catch (err) {
      wx.showToast({ title: '素材加载失败', icon: 'none' });
      return;
    }

    const layer = createStickerLayer(tpl);
    layer.asset.img = img;
    this.layers.push(layer);
    this.current = layer;

    this.setData({ hasSelection: true });
    await this.draw();
  },

  // ---------- 手势 ----------
  onTouchStart(e) {
    if (!this.layers.length || !this.stageSize) return;
    const t = e.touches[0];
    const px = t.x - this.rect.left;
    const py = t.y - this.rect.top;

    const hit = pickLayer(this.layers, px, py, this.stageSize, this.stageSize);
    this.current = hit;
    this.setData({ hasSelection: !!hit });
    if (!hit) return;

    this.touchState = {
      px: px,
      py: py,
      transform: Object.assign({}, hit.transform),
      pinch: e.touches.length === 2 ? pinch(e.touches[0], e.touches[1]) : null
    };
  },

  onTouchMove(e) {
    if (!this.current || !this.touchState) return;
    const ts = this.touchState;
    const t = e.touches[0];
    const px = t.x - this.rect.left;
    const py = t.y - this.rect.top;

    if (e.touches.length === 2) {
      // 双指：距离比 → scale，夹角差 → rotate
      const cur = pinch(e.touches[0], e.touches[1]);
      if (ts.pinch) {
        this.current.transform.scale = clampScale(
          ts.transform.scale * (cur.dist / ts.pinch.dist)
        );
        this.current.transform.rotate = ts.transform.rotate + (cur.angle - ts.pinch.angle);
      }
      ts.pinch = cur;
    } else {
      // 单指：拖拽
      const dx = px - ts.px;
      const dy = py - ts.py;
      this.current.transform.cx = ts.transform.cx + dx / this.stageSize;
      this.current.transform.cy = ts.transform.cy + dy / this.stageSize;
    }

    // 手势期间只重绘 canvas，不 setData
    this.draw();
  },

  onTouchEnd() {
    this.touchState = null;
  },

  // ---------- 工具条 ----------
  async onDeleteCurrent() {
    if (!this.current) return;
    this.layers = this.layers.filter((l) => l.id !== this.current.id);
    this.current = null;
    this.setData({ hasSelection: false });
    await this.draw();
  },

  async onClearAll() {
    this.layers = [];
    this.current = null;
    this.setData({ hasSelection: false });
    await this.draw();
  },

  // ---------- 保存 ----------
  async onSave() {
    if (!this.baseImg) {
      wx.showToast({ title: '先选一张图', icon: 'none' });
      return;
    }
    if (this.saving) return;
    this.saving = true;
    this.setData({ saving: true });

    wx.showLoading({ title: '生成中', mask: true });
    try {
      const badgeUrl = app.globalData.showBadge ? app.globalData.badgeUrl : '';
      const r = await exportAndSave({
        base: this.baseImg,
        layers: this.layers,
        badgeUrl: badgeUrl,
        size: 1080
      });
      if (r.saved) {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
        // TODO: 接入云函数后上报埋点 reportUsage({ templateId, cost })
      }
    } catch (err) {
      console.error('[editor] 导出失败', err);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.saving = false;
      this.setData({ saving: false });
    }
  },

  // ---------- 渲染 ----------
  async draw() {
    if (!this.canvas || !this.stageSize) return;
    await render(this.canvas, {
      base: this.baseImg,
      layers: this.layers,
      size: this.stageSize,
      dpr: this.dpr,
      bgColor: '#ffffff'
    });
  },

  onShareAppMessage() {
    return {
      title: '给头像加个水印，30 秒搞定',
      path: '/pages/editor/editor'
    };
  }
});
