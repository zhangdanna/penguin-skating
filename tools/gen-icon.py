"""
一企推推乐 — 游戏头像生成器
无文字/数字，纯图形：海洋渐变背景 + 气泡 + 雪花 + 冰面棋盘 + 橙色目标区 + 蓝色冰块 + 企鹅
"""
from PIL import Image, ImageDraw
import math, random

random.seed(42)
SIZE = 288
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# ---- 海洋渐变背景 ----
for y in range(SIZE):
    t = y / SIZE
    r = int(20 + (10 - 20) * t)
    g = int(60 + (30 - 60) * t)
    b = int(120 + (80 - 120) * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

# ---- 气泡 ----
for _ in range(12):
    bx = random.randint(20, SIZE - 20)
    by = random.randint(20, SIZE // 2)
    br = random.randint(3, 8)
    draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(255, 255, 255, 40), outline=(255, 255, 255, 80))

# ---- 雪花 ----
for _ in range(20):
    sx = random.randint(10, SIZE - 10)
    sy = random.randint(10, SIZE - 10)
    sr = random.randint(1, 3)
    draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(255, 255, 255, 200))

# ---- 冰面棋盘区域 ----
BOARD_X = 40
BOARD_Y = 80
CELL = 35
COLS = 6
ROWS = 4
BOARD_W = COLS * CELL
BOARD_H = ROWS * CELL

# 棋盘背板（白色半透明）
draw.rounded_rectangle(
    [BOARD_X - 6, BOARD_Y - 6, BOARD_X + BOARD_W + 6, BOARD_Y + BOARD_H + 6],
    radius=8, fill=(230, 240, 250, 220), outline=(180, 200, 220, 255), width=2
)

# 棋盘格线
for c in range(COLS + 1):
    x = BOARD_X + c * CELL
    draw.line([(x, BOARD_Y), (x, BOARD_Y + BOARD_H)], fill=(180, 200, 220, 150), width=1)
for r in range(ROWS + 1):
    y = BOARD_Y + r * CELL
    draw.line([(BOARD_X, y), (BOARD_X + BOARD_W, y)], fill=(180, 200, 220, 150), width=1)

# ---- 目标区（橙色，棋盘右下角 2x2） ----
tgt_x = BOARD_X + (COLS - 2) * CELL
tgt_y = BOARD_Y + (ROWS - 2) * CELL
draw.rounded_rectangle(
    [tgt_x + 2, tgt_y + 2, tgt_x + 2 * CELL - 2, tgt_y + 2 * CELL - 2],
    radius=6, fill=(255, 140, 50, 200), outline=(255, 100, 0, 255), width=2
)
# 目标区中心点
cx = tgt_x + CELL
cy = tgt_y + CELL
draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 200, 100, 255))

# ---- 冰块（蓝色，棋盘中部偏左） ----
bx = BOARD_X + 1 * CELL + CELL // 2
by = BOARD_Y + 1 * CELL + CELL // 2
bs = CELL - 6
draw.rounded_rectangle(
    [bx - bs // 2, by - bs // 2, bx + bs // 2, by + bs // 2],
    radius=5, fill=(80, 150, 230, 230), outline=(50, 100, 200, 255), width=2
)
# 冰块高光
draw.ellipse([bx - 8, by - 10, bx + 4, by - 4], fill=(200, 230, 255, 150))

# ---- 企鹅（棋盘左下角格子） ----
px = BOARD_X + 0 * CELL + CELL // 2
py = BOARD_Y + (ROWS - 1) * CELL + CELL // 2
pr = CELL // 2 - 4

# 企鹅身体（黑色圆）
draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(30, 30, 40, 255))
# 白色腹部
draw.ellipse([px - pr + 4, py - pr + 6, px + pr - 4, py + pr], fill=(255, 255, 255, 255))
# 头部（黑色小圆）
hr = pr - 2
draw.ellipse([px - hr, py - pr - 6, px + hr, py - 6], fill=(30, 30, 40, 255))
# 白色脸部
draw.ellipse([px - hr + 3, py - pr - 4, px + hr - 3, py - 8], fill=(255, 255, 255, 255))
# 眼睛
draw.ellipse([px - 6, py - pr - 4, px - 2, py - pr], fill=(20, 20, 30, 255))
draw.ellipse([px + 2, py - pr - 4, px + 6, py - pr], fill=(20, 20, 30, 255))
# 眼睛高光
draw.ellipse([px - 5, py - pr - 3, px - 3, py - pr - 1], fill=(255, 255, 255, 255))
draw.ellipse([px + 3, py - pr - 3, px + 5, py - pr - 1], fill=(255, 255, 255, 255))
# 嘴（橙色三角）
draw.polygon([(px - 3, py - 8), (px + 3, py - 8), (px, py - 4)], fill=(255, 140, 0, 255))

# ---- 保存 ----
img.save(r'D:\working\play\other\penguin-skating-game\images\app-icon.png')
print(f'app-icon.png saved: {img.size}')

# 生成 144x144 版本
img144 = img.resize((144, 144), Image.LANCZOS)
img144.save(r'D:\working\play\other\penguin-skating-game\images\app-icon-144.png')
print(f'app-icon-144.png saved: {img144.size}')
