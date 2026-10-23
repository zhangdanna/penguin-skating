# -*- coding: utf-8 -*-
"""生成微信分享卡片图 images/share-image.png（500x400，5:4）"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 500, 400
S = 4  # 超采样倍数，先画大图再缩小，边缘更平滑

CREAM      = (255, 249, 238)
ICE_LIGHT  = (234, 249, 255)
ICE        = (190, 235, 255)
ICE_DEEP   = (127, 212, 245)
WATER      = (91, 200, 245)
WATER_DEEP = (44, 156, 214)
NAVY       = (31, 58, 95)
NAVY_DEEP  = (21, 42, 69)
YELLOW     = (255, 201, 74)
ORANGE     = (255, 159, 90)
CORAL      = (255, 122, 107)
WHITE      = (255, 255, 255)
MINT       = (47, 191, 155)

FONT_DIR = r"C:\Windows\Fonts"


def load_font(names, size):
    for name in names:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


F_TITLE = load_font(["msyhbd.ttc", "msyh.ttc", "simhei.ttf"], 62 * S)
F_SUB   = load_font(["msyh.ttc", "simhei.ttf"], 24 * S)
F_TAG   = load_font(["msyhbd.ttc", "msyh.ttc"], 22 * S)

img = Image.new("RGB", (W * S, H * S), ICE_LIGHT)
d = ImageDraw.Draw(img)

# ---------- 天空渐变 ----------
top = (222, 245, 255)
bottom = (168, 224, 250)
for y in range(H * S):
    t = y / (H * S - 1)
    r = int(top[0] + (bottom[0] - top[0]) * t)
    g = int(top[1] + (bottom[1] - top[1]) * t)
    b = int(top[2] + (bottom[2] - top[2]) * t)
    d.line([(0, y), (W * S, y)], fill=(r, g, b))

# ---------- 气泡 ----------
bubbles = [
    (60, 70, 26, 90), (120, 40, 14, 70), (430, 60, 30, 80),
    (390, 120, 16, 60), (35, 170, 12, 55), (465, 200, 20, 65),
]
for cx, cy, rad, alpha in bubbles:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([(cx - rad) * S, (cy - rad) * S, (cx + rad) * S, (cy + rad) * S],
               fill=(255, 255, 255, alpha))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
d = ImageDraw.Draw(img)

# ---------- 冰面 ----------
ICE_Y = 268
d.rectangle([0, ICE_Y * S, W * S, H * S], fill=(238, 250, 255))
d.rectangle([0, ICE_Y * S, W * S, (ICE_Y + 6) * S], fill=(255, 255, 255))

# 冰面网格线
for i in range(1, 7):
    y = (ICE_Y + 6 + i * 22) * S
    d.line([(0, y), (W * S, y)], fill=(214, 238, 250), width=max(1, S // 2))

# ---------- 目标格 ----------
def draw_target(dx, dy, size):
    pad = size * 0.12
    box = [dx - size / 2 + pad, dy - size / 2 + pad, dx + size / 2 - pad, dy + size / 2 - pad]
    d.rounded_rectangle([box[0] * S, box[1] * S, box[2] * S, box[3] * S],
                        radius=int(size * 0.22 * S), fill=(255, 232, 160))
    # 内圈
    inner = size * 0.30
    d.ellipse([(dx - inner) * S, (dy - inner) * S, (dx + inner) * S, (dy + inner) * S],
              fill=(255, 201, 74))


# ---------- 冰块 ----------
def draw_stone(sx, sy, size):
    half = size / 2
    pts = [(sx, sy - half), (sx + half, sy), (sx, sy + half), (sx - half, sy)]
    d.polygon([(x * S, y * S) for x, y in pts], fill=ICE_DEEP, outline=WATER_DEEP)
    # 高光
    hi = [(sx, sy - half * 0.62), (sx + half * 0.42, sy), (sx, sy + half * 0.62), (sx - half * 0.42, sy)]
    d.polygon([(x * S, y * S) for x, y in hi], fill=(214, 244, 255))


draw_target(130, 318, 62)
draw_target(250, 318, 62)
draw_target(370, 318, 62)

draw_stone(130, 318, 52)
draw_stone(250, 318, 52)


# ---------- 企鹅 ----------
def draw_penguin(px, py, scale):
    body_w = 58 * scale
    body_h = 72 * scale

    # 影子
    d.ellipse([(px - body_w * 0.62) * S, (py + body_h * 0.44) * S,
               (px + body_w * 0.62) * S, (py + body_h * 0.62) * S],
              fill=(205, 233, 246))

    # 身体
    d.ellipse([(px - body_w / 2) * S, (py - body_h / 2) * S,
               (px + body_w / 2) * S, (py + body_h / 2) * S],
              fill=NAVY_DEEP)

    # 肚皮
    d.ellipse([(px - body_w * 0.31) * S, (py - body_h * 0.26) * S,
               (px + body_w * 0.31) * S, (py + body_h * 0.44) * S],
              fill=WHITE)

    # 脚
    for dx in (-0.22, 0.22):
        fx = px + body_w * dx
        fy = py + body_h * 0.48
        d.ellipse([(fx - 11 * scale) * S, (fy - 5 * scale) * S,
                   (fx + 11 * scale) * S, (fy + 7 * scale) * S],
                  fill=ORANGE)

    # 眼睛
    for dx in (-0.15, 0.15):
        ex = px + body_w * dx
        ey = py - body_h * 0.20
        d.ellipse([(ex - 5 * scale) * S, (ey - 6 * scale) * S,
                   (ex + 5 * scale) * S, (ey + 6 * scale) * S], fill=WHITE)
        d.ellipse([(ex - 2.6 * scale) * S, (ey - 3 * scale) * S,
                   (ex + 2.6 * scale) * S, (ey + 3.4 * scale) * S], fill=NAVY_DEEP)

    # 嘴
    beak = [(px - 8 * scale, py - body_h * 0.07), (px + 8 * scale, py - body_h * 0.07),
            (px, py + body_h * 0.03)]
    d.polygon([(x * S, y * S) for x, y in beak], fill=ORANGE)

    # 腮红
    for dx in (-0.30, 0.30):
        cx = px + body_w * dx
        cy = py - body_h * 0.02
        d.ellipse([(cx - 6 * scale) * S, (cy - 4 * scale) * S,
                   (cx + 6 * scale) * S, (cy + 4 * scale) * S], fill=CORAL)


draw_penguin(258, 232, 1.05)

# ---------- 标题 ----------
def draw_text_center(text, y, font, fill, stroke=None, stroke_w=0):
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (W * S - tw) / 2 - bbox[0]
    if stroke:
        d.text((x, y * S), text, font=font, fill=fill,
               stroke_width=stroke_w, stroke_fill=stroke)
    else:
        d.text((x, y * S), text, font=font, fill=fill)


draw_text_center("一企推推乐", 52, F_TITLE, YELLOW, NAVY_DEEP, 6 * S)

# 副标题胶囊
sub_text = "冰上推箱子 · 一滑到底"
bbox = d.textbbox((0, 0), sub_text, font=F_SUB)
tw = bbox[2] - bbox[0]
pad_x, pad_y = 20 * S, 9 * S
box_w = tw + pad_x * 2
box_h = (bbox[3] - bbox[1]) + pad_y * 2
bx = (W * S - box_w) / 2
by = 138 * S
d.rounded_rectangle([bx, by, bx + box_w, by + box_h], radius=box_h / 2,
                    fill=(255, 255, 255, 255))
d.text((bx + pad_x - bbox[0], by + pad_y - bbox[1]), sub_text, font=F_SUB, fill=NAVY)

# 左下角标签
tag = "48 关等你挑战"
tb = d.textbbox((0, 0), tag, font=F_TAG)
d.rounded_rectangle([22 * S, 352 * S, 22 * S + (tb[2] - tb[0]) + 28 * S, 352 * S + 36 * S],
                    radius=18 * S, fill=MINT)
d.text((22 * S + 14 * S - tb[0], 352 * S + 18 * S - (tb[1] + tb[3]) / 2), tag,
       font=F_TAG, fill=WHITE)

# 缩小
img = img.resize((W, H), Image.LANCZOS)

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "images")
os.makedirs(out_dir, exist_ok=True)
out = os.path.abspath(os.path.join(out_dir, "share-image.png"))
img.save(out, "PNG", optimize=True)
print("saved:", out, os.path.getsize(out), "bytes")
