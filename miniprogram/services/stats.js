// 埋点上报
// 设计要点：
//   1) 上报失败绝不阻塞主流程（工具型小程序不能有「转圈」）
//   2) 云未开通时存本地队列，开通后补报，数据不丢
//   3) 批量上报，避免每次操作都发一次网络请求

const { callWithRetry } = require('./cloud.js');

const QUEUE_KEY = 'wm_stat_queue';
const MAX_QUEUE = 100;      // 队列上限，防止无限膨胀
const FLUSH_THRESHOLD = 5;  // 攒够 5 条批量上报

function getQueue() {
  return wx.getStorageSync(QUEUE_KEY) || [];
}

function setQueue(q) {
  try {
    wx.setStorageSync(QUEUE_KEY, q);
  } catch (e) {
    // 存储异常就丢弃最老的一半
    wx.setStorageSync(QUEUE_KEY, q.slice(Math.floor(q.length / 2)));
  }
}

/**
 * 记录一个事件
 * @param {string} event 事件名：pick_image / apply_template / save_image / share / app_launch
 * @param {Object} data 附带参数
 */
function track(event, data = {}) {
  const q = getQueue();
  q.push({
    event,
    data,
    ts: Date.now()
  });

  // 超上限丢最老的
  if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
  setQueue(q);

  if (q.length >= FLUSH_THRESHOLD) flush();
}

/** 批量上报队列 */
async function flush() {
  const q = getQueue();
  if (!q.length) return;

  const batch = q.slice(0, 20);
  const res = await callWithRetry('reportUsage', { events: batch }, {
    retries: 1,
    timeout: 3000,
    fallback: null
  });

  if (res && res.ok) {
    // 上报成功才移除，失败保留下次重试
    setQueue(q.slice(batch.length));
  }
}

/** 启动时调用：补报上次没发出去的 */
function flushOnLaunch() {
  setTimeout(() => flush(), 2000);
}

module.exports = { track, flush, flushOnLaunch };
