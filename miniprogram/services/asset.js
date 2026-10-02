// 素材图缓存：网络图 → 落盘 → 本地路径
// 落盘的好处：
//   1) 二次打开秒开，不重复下载
//   2) 拿到本地路径后 canvas 加载更稳，规避跨域/域名限制
// 用 LRU 控制总量，避免撑爆用户存储

const fs = wx.getFileSystemManager();

const MAP_KEY = 'wm_asset_map'; // { url: { path, size, used } }
const MAX_COUNT = 200;          // 最多缓存张数
const MAX_SIZE = 20 * 1024 * 1024; // 最多 20MB

function getMap() {
  return wx.getStorageSync(MAP_KEY) || {};
}

function saveMap(map) {
  try {
    wx.setStorageSync(MAP_KEY, map);
  } catch (e) {
    // 存储写满：清掉一半再试，不让它影响主流程
    evict(Object.keys(map).length / 2);
  }
}

/** 查本地缓存，命中则刷新使用时间 */
function getLocal(url) {
  const map = getMap();
  const item = map[url];
  if (!item) return null;
  item.used = Date.now();
  map[url] = item;
  saveMap(map);
  return item.path;
}

/**
 * 取素材的可用路径：本地缓存优先，否则下载并落盘
 * @returns {Promise<string>} 本地文件路径；失败时回退传入的 url（直连）
 */
async function resolve(url) {
  if (!url) return '';
  // 内置素材（代码包内路径）直接返回
  if (url.indexOf('http') !== 0 && url.indexOf('cloud://') !== 0) return url;

  const local = getLocal(url);
  if (local) return local;

  try {
    const saved = await downloadAndSave(url);
    return saved || url;
  } catch (e) {
    // 下载失败就回退直连（已配合法域名时仍可渲染）
    return url;
  }
}

function downloadAndSave(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      timeout: 8000,
      success: (d) => {
        if (d.statusCode !== 200) return reject(new Error('bad status'));
        fs.saveFile({
          tempFilePath: d.tempFilePath,
          success: (s) => {
            const map = getMap();
            map[url] = { path: s.savedFilePath, size: d.fileSize || 0, used: Date.now() };
            saveMap(map);
            evictIfNeeded();
            resolve(s.savedFilePath);
          },
          fail: reject
        });
      },
      fail: reject
    });
  });
}

/** 总量超限时按 LRU 清理 */
function evictIfNeeded() {
  const map = getMap();
  const keys = Object.keys(map);
  let total = keys.reduce((sum, k) => sum + (map[k].size || 0), 0);

  if (keys.length <= MAX_COUNT && total <= MAX_SIZE) return;

  const sorted = keys.sort((a, b) => (map[a].used || 0) - (map[b].used || 0));
  let i = 0;
  while (i < sorted.length && (Object.keys(map).length > MAX_COUNT || total > MAX_SIZE)) {
    const k = sorted[i++];
    total -= map[k].size || 0;
    try {
      fs.unlink({ filePath: map[k].path });
    } catch (e) {
      // 文件可能已被系统清理，忽略
    }
    delete map[k];
  }
  saveMap(map);
}

/** 强制清理指定数量的条目 */
function evict(count) {
  const map = getMap();
  const sorted = Object.keys(map).sort((a, b) => (map[a].used || 0) - (map[b].used || 0));
  sorted.slice(0, count).forEach((k) => {
    try {
      fs.unlink({ filePath: map[k].path });
    } catch (e) {}
    delete map[k];
  });
  saveMap(map);
}

/** 预下载一组素材（分类切换时调用，失败不影响使用） */
function preload(urls) {
  return Promise.all(urls.map((u) => resolve(u).catch(() => u)));
}

module.exports = { resolve, getLocal, preload, evictIfNeeded };
