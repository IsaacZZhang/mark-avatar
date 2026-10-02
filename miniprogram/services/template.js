// 素材清单服务：热更 + 三级缓存
// 策略 stale-while-revalidate：先用缓存渲染保证秒开，网络返回后静默替换。
// 网络挂了也能用 —— 这对工具型小程序的留存影响很大。

const BUILTIN = require('../config/templates.js');

// TODO: 开通云开发后，把 manifest.json 传到云存储，这里填它的 HTTPS 地址
//       （并在 mp 后台「开发设置 → 服务器域名 → downloadFile 合法域名」加入该域名）
const MANIFEST_URL = '';

const CACHE_KEY = 'wm_manifest';
const FETCH_TIMEOUT = 3000;

/** 取本地缓存的清单（同步，用于首帧渲染） */
function getCached() {
  return wx.getStorageSync(CACHE_KEY) || null;
}

/** 取内置兜底清单（离线可用） */
function getBuiltin() {
  return BUILTIN;
}

/**
 * 加载清单：立即返回可用清单，同时发起静默更新
 * @param {Function} onUpdate 静默更新成功后的回调（新版清单）
 * @returns {Object} 立刻可用的清单（缓存优先，其次内置）
 */
function load(onUpdate) {
  const cached = getCached();
  const initial = cached || getBuiltin();

  if (MANIFEST_URL) {
    fetchRemote(cached, onUpdate);
  }
  return initial;
}

async function fetchRemote(cached, onUpdate) {
  try {
    const remote = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT);
      wx.request({
        url: MANIFEST_URL,
        timeout: FETCH_TIMEOUT,
        success: (r) => {
          clearTimeout(timer);
          r.statusCode === 200 ? resolve(r.data) : reject(r);
        },
        fail: (e) => {
          clearTimeout(timer);
          reject(e);
        }
      });
    });

    if (!remote || !remote.manifestVersion) return;

    const localVersion = cached ? cached.manifestVersion || 0 : 0;
    if (remote.manifestVersion > localVersion) {
      wx.setStorageSync(CACHE_KEY, remote);
      if (typeof onUpdate === 'function') onUpdate(remote);
    }
  } catch (e) {
    // 网络失败静默：继续用缓存/内置清单
  }
}

/** 按分类过滤 */
function filterByCat(manifest, catId) {
  if (!manifest || !manifest.templates) return [];
  return !catId ? manifest.templates : manifest.templates.filter((t) => t.category === catId);
}

/** 分类列表（按 sort 排序） */
function categories(manifest) {
  if (!manifest || !manifest.categories) return [];
  return manifest.categories.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

module.exports = { load, getCached, getBuiltin, filterByCat, categories, CACHE_KEY };
