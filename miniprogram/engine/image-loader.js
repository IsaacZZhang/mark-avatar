// 图片加载
// 关键：Canvas 2D 里图片对象必须用 canvas.createImage() 创建，
// 用 new Image() 或直接把 wx.downloadFile 的临时路径塞给 img.src 都会失败。

const memCache = new Map(); // url -> image（同一会话内复用）

function createImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed: ' + src));
    img.src = src;
  });
}

/**
 * 加载图片（带内存缓存）
 * @param {Object} canvas canvas 节点（页面 canvas 或离屏 canvas）
 * @param {string} src 本地路径(wxfile:// / 临时路径) 或 合法域名内的网络地址
 */
async function load(canvas, src) {
  if (!src) throw new Error('empty src');
  if (memCache.has(src)) return memCache.get(src);

  const img = await createImage(canvas, src);
  memCache.set(src, img);
  return img;
}

/**
 * 加载网络素材图：先落盘再加载
 * wx.getImageInfo 自带缓存，同一 URL 二次访问不重复下载，
 * 落盘后拿到本地路径还能规避 canvas 对跨域/域名的限制。
 */
async function loadRemote(canvas, url) {
  if (memCache.has(url)) return memCache.get(url);

  let src = url;
  try {
    const info = await wx.getImageInfo({ src: url });
    src = info.path;
  } catch (e) {
    // getImageInfo 失败就退回直接用 url（已配置 downloadFile 合法域名时可直连）
  }
  return load(canvas, src);
}

/** 预加载一组素材图，失败不抛错，渲染时再按需兜底 */
async function preload(canvas, urls) {
  return Promise.all(
    urls.map((u) =>
      loadRemote(canvas, u).catch(() => null)
    )
  );
}

function clearCache() {
  memCache.clear();
}

module.exports = { createImage, load, loadRemote, preload, clearCache };
