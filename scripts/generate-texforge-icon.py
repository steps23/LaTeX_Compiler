#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_MONO = "/System/Library/Fonts/Menlo.ttc"

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    return mask

def make_icon(size=1024):
    scale = size / 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # background gradient
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    pix = bg.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(10 + 8 * t)
            g = int(18 + 30 * t)
            b = int(28 + 36 * t)
            pix[x, y] = (r, g, b, 255)
    mask = rounded_mask(size, int(210 * scale))
    img.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(img)

    # glow
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((int(130*scale), int(80*scale), int(930*scale), int(880*scale)), fill=(32, 214, 136, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(int(80*scale)))
    img.alpha_composite(glow)

    # paper sheet
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sheet = (int(235*scale), int(145*scale), int(790*scale), int(880*scale))
    sd.rounded_rectangle(sheet, radius=int(54*scale), fill=(0, 0, 0, 125))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(24*scale)))
    img.alpha_composite(shadow)
    d.rounded_rectangle(sheet, radius=int(54*scale), fill=(244, 248, 255, 255))
    d.rounded_rectangle(sheet, radius=int(54*scale), outline=(255, 255, 255, 210), width=max(1, int(6*scale)))

    # folded corner
    fold = [(int(650*scale), int(145*scale)), (int(790*scale), int(285*scale)), (int(650*scale), int(285*scale))]
    d.polygon(fold, fill=(214, 224, 238, 255))
    d.line((int(650*scale), int(145*scale), int(650*scale), int(285*scale), int(790*scale), int(285*scale)), fill=(186, 199, 216, 255), width=max(1, int(4*scale)))

    # TeX wordmark
    tex_font = font(FONT_BLACK, int(218*scale))
    text = "TeX"
    bbox = d.textbbox((0,0), text, font=tex_font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    tx = int(512*scale - tw/2)
    ty = int(320*scale - th/2)
    d.text((tx + int(6*scale), ty + int(7*scale)), text, font=tex_font, fill=(5, 22, 34, 65))
    d.text((tx, ty), text, font=tex_font, fill=(6, 28, 44, 255))

    # green forge underline + terminal prompt
    green = (35, 211, 137, 255)
    d.rounded_rectangle((int(330*scale), int(545*scale), int(695*scale), int(588*scale)), radius=int(22*scale), fill=green)
    mono = font(FONT_MONO, int(92*scale))
    d.text((int(355*scale), int(620*scale)), r"\>_", font=mono, fill=(6, 28, 44, 255))

    # small compile sparkle
    d.line((int(770*scale), int(565*scale), int(840*scale), int(565*scale)), fill=green, width=max(1, int(18*scale)))
    d.line((int(805*scale), int(530*scale), int(805*scale), int(600*scale)), fill=green, width=max(1, int(18*scale)))

    # subtle outer stroke
    d.rounded_rectangle((int(8*scale), int(8*scale), size-int(8*scale), size-int(8*scale)), radius=int(205*scale), outline=(255,255,255,55), width=max(1, int(8*scale)))
    return img

master = make_icon(1024)
master.save(ICON_DIR / "icon.png")

sizes = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "StoreLogo.png": 50,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
}
for name, sz in sizes.items():
    master.resize((sz, sz), Image.Resampling.LANCZOS).save(ICON_DIR / name)

# Windows .ico
ico_sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
master.save(ICON_DIR / "icon.ico", sizes=ico_sizes)

# macOS .icns source iconset
iconset = ICON_DIR / "icon.iconset"
iconset.mkdir(exist_ok=True)
for pts, scale in [(16,1),(16,2),(32,1),(32,2),(128,1),(128,2),(256,1),(256,2),(512,1),(512,2)]:
    px = pts * scale
    suffix = "@2x" if scale == 2 else ""
    master.resize((px, px), Image.Resampling.LANCZOS).save(iconset / f"icon_{pts}x{pts}{suffix}.png")
print(f"Generated TeXForge icons in {ICON_DIR}")
