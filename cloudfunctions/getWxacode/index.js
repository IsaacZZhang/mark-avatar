const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * 生成带 scene 的小程序码，存到云存储并返回 fileID
 * 云调用免鉴权 —— 这是选云开发最实际的理由之一，
 * 自建后端要自己管 access_token，很烦。
 */
exports.main = async (event) => {
  const { scene = 'a', page = 'pages/editor/editor' } = event;

  // scene 最长 32 字符，超了微信会报错
  const safeScene = String(scene).slice(0, 32);
  const cloudPath = `qrcode/${hash(safeScene)}.png`;

  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: safeScene,
      page,
      width: 280,
      isHyaline: true // 透明底，角标垫白底由端上画
    });

    const upload = await cloud.uploadFile({
      cloudPath,
      fileContent: result.buffer
    });

    return { fileID: upload.fileID };
  } catch (e) {
    return { fileID: '', error: String((e && e.message) || e) };
  }
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
