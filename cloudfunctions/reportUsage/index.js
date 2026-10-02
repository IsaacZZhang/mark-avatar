const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 事件 → 统计字段映射
// 转化漏斗：use(选了水印) → export(出图) → save(存相册) → share(分享拉新)
// export 单独拆出来是为了定位「编辑完但没存」的流失点
const FIELD_MAP = {
  apply_template: 'use',
  export_image: 'export',
  save_image: 'save',
  share: 'share'
};

exports.main = async (event) => {
  const { events = [] } = event;
  const { OPENID } = cloud.getWXContext();

  if (!events || !events.length) return { ok: true };

  const date = ymd();

  // ① 原始流水：用于细粒度分析
  const docs = events.map((e) => ({
    openid: OPENID,
    event: e.event,
    data: e.data || {},
    ts: e.ts || Date.now(),
    date,
    createTime: db.serverDate()
  }));

  try {
    await db.collection('wm_event').add({ data: docs });
  } catch (e) {
    // 流水写失败不影响主流程
  }

  // ② 聚合表：供热榜直接读，避免每次全表扫
  const bumps = [];
  for (const e of events) {
    const field = FIELD_MAP[e.event];
    const templateId = e.data && e.data.templateId;
    if (!field || !templateId) continue;
    bumps.push(bumpStat(templateId, date, field));
  }
  await Promise.all(bumps.map((p) => p.catch(() => null)));

  return { ok: true };
};

async function bumpStat(templateId, date, field) {
  const col = db.collection('wm_stat');
  const exist = await col.where({ templateId, date }).limit(1).get();
  if (exist.data && exist.data.length) {
    return col.doc(exist.data[0]._id).update({ data: { [field]: _.inc(1) } });
  }
  return col.add({
    data: { templateId, date, use: 0, export: 0, save: 0, share: 0, [field]: 1 }
  });
}

function ymd() {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // UTC+8
  return d.toISOString().slice(0, 10);
}
