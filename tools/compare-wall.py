from PIL import Image, ImageDraw, ImageFont

pairs = [("design-preview/before-200.png", "design-preview/after-200.png", "Lv.200"),
         ("design-preview/before-51.png", "design-preview/after-51.png", "Lv.51")]

GAP = 24
PAD = 24
LABEL_H = 46
imgs = []
for b, a, tag in pairs:
    imgs.append((Image.open(b).convert("RGB"), Image.open(a).convert("RGB"), tag))

w, h = imgs[0][0].size
sheet_w = PAD * 2 + w * 4 + GAP * 3
sheet_h = PAD * 2 + LABEL_H + h
sheet = Image.new("RGB", (sheet_w, sheet_h), (14, 23, 38))
d = ImageDraw.Draw(sheet)

def font(sz):
    for p in ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf"]:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

f = font(24)
x = PAD
for i, (bimg, aimg, tag) in enumerate(imgs):
    for j, (img, lab) in enumerate([(bimg, "改前"), (aimg, "改后")]):
        d.text((x, PAD), f"{tag}  {lab}", font=f, fill=(226, 238, 250) if j else (150, 168, 190))
        sheet.paste(img, (x, PAD + LABEL_H))
        x += w + GAP
    if i < len(imgs) - 1:
        x += GAP

sheet.save("design-preview/wall-compare.png")
print("saved", sheet.size)
