# 生成二维码卡片（公众号文末用）与纯二维码
import sys, glob, io, qrcode
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://suiyuan.caowenhu.com/'
OUT = '/home/claude/suiyuan/site_assets/'
NM = '/home/claude/deploy_npm/node_modules/@fontsource/'
SILK, INK, INK2, RED = (231, 221, 196), (41, 37, 31), (91, 83, 71), (168, 58, 42)
_cache = {}
def brush_font(ch, size):
    # 马善政楷书按字分片，找含这个字的分片转成 ttf
    for f in sorted(glob.glob(NM + 'ma-shan-zheng/files/*-400-normal.woff2')):
        if f not in _cache:
            t = TTFont(f); t.flavor = None; b = io.BytesIO(); t.save(b); _cache[f] = (b.getvalue(), set(t.getBestCmap()))
        data, cmap = _cache[f]
        if ord(ch) in cmap: return ImageFont.truetype(io.BytesIO(data), size)
    raise KeyError(ch)
serif = lambda s, w='Regular': ImageFont.truetype(f'/usr/share/fonts/opentype/noto/NotoSerifCJK-{w}.ttc', s, index=2)  # index 2 = SC
def draw_brush(d, text, x, y, size, fill):
    for ch in text:
        f = brush_font(ch, size); d.text((x, y), ch, font=f, fill=fill); x += size * 1.02
    return x

q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=20, border=2)
q.add_data(URL); q.make(fit=True)
qr = q.make_image(fill_color=INK, back_color=SILK).convert('RGB')
# 中心钤一方"随园"朱印
def seal(sz):
    im = Image.new('RGB', (sz, sz), RED); d = ImageDraw.Draw(im)
    d.rectangle([6, 6, sz - 7, sz - 7], outline=(244, 233, 214), width=4)
    fs = int(sz * 0.40)
    for i, ch in enumerate('随园'):
        f = brush_font(ch, fs); bb = d.textbbox((0, 0), ch, font=f)
        d.text(((sz - (bb[2] - bb[0])) / 2 - bb[0], sz * 0.08 + i * sz * 0.43 - bb[1] + (sz * 0.43 - (bb[3] - bb[1])) / 2), ch, font=f, fill=(244, 233, 214))
    return im
s = int(qr.size[0] * 0.2); qr.paste(seal(s), ((qr.size[0] - s) // 2, (qr.size[1] - s) // 2))
qr.save(OUT + 'qr.png')

W, H = 900, 1180
card = Image.new('RGB', (W, H), SILK); d = ImageDraw.Draw(card)
d.rectangle([28, 28, W - 29, H - 29], outline=INK2, width=2); d.rectangle([40, 40, W - 41, H - 41], outline=(170, 158, 132), width=1)
title = '重游随园'; ts = 110
tw = ts * 1.02 * len(title); draw_brush(d, title, (W - tw) / 2, 92, ts, INK)
sub = '乾隆五十年 · 仲春 · 袁枚领你逛他的园子'; f = serif(30)
d.text(((W - d.textlength(sub, font=f)) / 2, 245), sub, font=f, fill=INK2)
qs = 560; qi = qr.resize((qs, qs), Image.LANCZOS); card.paste(qi, ((W - qs) // 2, 318))
t1 = '微信扫一扫 · 即刻入园'; f1 = serif(40, 'SemiBold')
d.text(((W - d.textlength(t1, font=f1)) / 2, 912), t1, font=f1, fill=INK)
t2 = '手机、电脑都能看，无需下载'; f2 = serif(28)
d.text(((W - d.textlength(t2, font=f2)) / 2, 978), t2, font=f2, fill=INK2)
u = URL.replace('https://', '').rstrip('/'); f3 = serif(26)
d.text(((W - d.textlength(u, font=f3)) / 2, 1060), u, font=f3, fill=(120, 110, 94))
card.save(OUT + 'qr_card.png')
# 网页图标
seal(192).save(OUT + 'favicon.png')
print('ok', q.version)
