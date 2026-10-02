#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成占位水印素材（透明 PNG）

用途：项目初始化时没有设计资源，用它快速产出一批能跑通效果的贴纸，
      后续直接把文件替换成设计师产出的素材即可，文件名保持不变。

用法：python3 tools/gen_placeholder_stickers.py
输出：miniprogram/assets/stickers/*.png
"""
import os

from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "miniprogram", "assets", "stickers")

# 文案全部为通用表达，不含任何品牌 logo / 商标 / 未授权 IP
STICKERS = [
    ("sold_out",    "卖掉了",    (255,  59,  48)),
    ("gone",        "已出",      (255, 149,   0)),
    ("declutter",   "断舍离",    ( 52, 199,  89)),
    ("refunding",   "回血中",    (  0, 122, 255)),
    ("not_sell",    "不卖",      ( 88,  86, 214)),
    ("worker",      "打工人",    (255,  45,  85)),
    ("read_noreply","已读不回",  (255, 204,   0)),
    ("wanted",      "头像征集中", ( 90, 200, 250)),
]

CANVAS = (640, 240)
FONT_SIZE = 100
STROKE = 10


def stroke_offsets(width):
    """描边偏移点集：圆形采样，避免 4 次循环画 100+ 遍"""
    pts = []
    r = width
    for dx in range(-r, r + 1, 2):
        for dy in range(-r, r + 1, 2):
            if dx * dx + dy * dy <= r * r:
                pts.append((dx, dy))
    return pts


def make(text, color, out_path):
    img = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)

    bbox = d.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (CANVAS[0] - w) / 2 - bbox[0]
    y = (CANVAS[1] - h) / 2 - bbox[1]

    # 白色描边：复杂底图上不描边几乎看不清
    for dx, dy in stroke_offsets(STROKE):
        d.text((x + dx, y + dy), text, font=font, fill=(255, 255, 255, 255))
    d.text((x, y), text, font=font, fill=color + (255,))

    img.save(out_path, optimize=True)
    return out_path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for name, text, color in STICKERS:
        p = make(text, color, os.path.join(OUT_DIR, name + ".png"))
        size = os.path.getsize(p)
        total += size
        print("  %-14s %-6s %6.1f KB" % (name, text, size / 1024))
    print("\n共 %d 个素材，合计 %.1f KB -> %s" % (len(STICKERS), total / 1024, os.path.abspath(OUT_DIR)))


if __name__ == "__main__":
    main()
