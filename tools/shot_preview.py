"""给预览页截图，产出 docs/shots/ 下的 PNG。

用途：不开浏览器也能一眼看到当前做到哪、长什么样。
截图对象限定 .phone 元素，避免把页面的说明文字也截进去。
"""

import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "preview", "index.html")
OUT_DIR = os.path.join(ROOT, "docs", "shots")
CHROME = "/usr/bin/chromium"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    url = "file://" + HTML

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 520, "height": 900},
                                device_scale_factor=2)
        page.goto(url)
        page.wait_for_timeout(1500)  # 等 init 加载完 base64 素材

        phone = page.locator(".phone")

        # ① 编辑器默认态：进来就带一个「卖掉了」
        phone.screenshot(path=os.path.join(OUT_DIR, "01-editor.png"))

        # ② 编辑器多素材：第二个挪到左上，模拟用户拖拽后的错落效果
        page.evaluate("""async () => {
          await addSticker('gone', (STICKERS.find(s=>s.id==='gone')||{}).src);
          await addSticker('worker', (STICKERS.find(s=>s.id==='worker')||{}).src);
          const g = layers.find(l => l.templateId === 'gone');
          if (g) { g.t.cx = 0.30; g.t.cy = 0.22; g.t.scale = 0.5; g.t.rotate = -12; }
          current = null; syncControls(); draw();
        }""")
        page.wait_for_timeout(600)
        phone.screenshot(path=os.path.join(OUT_DIR, "02-editor-multi.png"))

        # ③ 结果页
        page.evaluate("goResult()")
        page.wait_for_timeout(600)
        phone.screenshot(path=os.path.join(OUT_DIR, "03-result.png"))

        browser.close()

    for f in sorted(os.listdir(OUT_DIR)):
        fp = os.path.join(OUT_DIR, f)
        print("  %-24s %.0f KB" % (f, os.path.getsize(fp) / 1024))


if __name__ == "__main__":
    main()
