// 云调用统一封装
// 核心原则：任何云调用失败都不能阻塞出图。
// 工具型小程序最忌讳「网络转圈导致用不了」，所以这里一律带 timeout + fallback。

const DEFAULT_TIMEOUT = 3000;

function isReady() {
  const app = getApp();
  return !!(app && app.globalData && app.globalData.cloudReady);
}

/**
 * 调用云函数
 * @param {string} name 云函数名
 * @param {Object} data 参数
 * @param {Object} opts
 * @param {number} opts.timeout 超时毫秒
 * @param {*} opts.fallback 失败时的返回值（不抛错）
 * @returns {Promise<*>} 成功返回 result，失败返回 fallback
 */
async function call(name, data, opts = {}) {
  const { timeout = DEFAULT_TIMEOUT, fallback = null } = opts;

  if (!isReady()) return fallback; // 未开通云开发：静默降级

  let timer = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('cloud timeout')), timeout);
    });
    const res = await Promise.race([
      wx.cloud.callFunction({ name, data }),
      timeoutPromise
    ]);
    return res && res.result ? res.result : fallback;
  } catch (e) {
    // 失败就失败，不打日志轰炸，也不弹提示
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 带重试的调用（埋点这类允许重试的场景用） */
async function callWithRetry(name, data, { retries = 1, timeout = DEFAULT_TIMEOUT, fallback = null } = {}) {
  for (let i = 0; i <= retries; i++) {
    const r = await call(name, data, { timeout, fallback: null });
    if (r !== null && r !== undefined) return r;
  }
  return fallback;
}

module.exports = { call, callWithRetry, isReady };
