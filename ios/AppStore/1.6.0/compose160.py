# 1.6.0 스토어 스크린샷 새 세트(개선-51) — iPhone 6.9" 9장 + iPad 13"
# 실행: /usr/bin/python3 compose160.py  (원본은 raw/, 결과는 out69/ · outipad/)
# 원본: 둘러보기 예시 데이터(실명·실계정 없음). link.png 는 로컬 dev 임시 화면(예시 데이터)을 렌더링한 것.
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
F = '/System/Library/Fonts/AppleSDGothicNeo.ttc'


def font(sz, w='bold'):
    return ImageFont.truetype(F, int(sz), index={'bold': 14, 'semibold': 4, 'medium': 2, 'regular': 0}[w])


# (원본, 제목 1줄, 제목 2줄, 부제)
SLIDES = [
    ('orbit', '가까운 사람이 가까이,', '자주 만나는 사람을 한눈에', '캘린더 속 만남으로 나만의 관계 궤도를 그려요', None),
    ('guest', 'DM 대신 링크 하나로,', '상대가 직접 시간을 골라요', '코칭·상담·레슨 예약을 링크 하나로', None),
    ('link', '인스타·유튜브 프로필에', '거는 내 페이지', '테마를 골라 꾸미고, 방문자는 바로 예약해요', None),
    ('day', '할 일처럼', '체크하는 캘린더', '중요한 일정엔 별, 끝낸 일엔 체크', None),
    ('newslot', '내 일정과 겹치지 않는 시간만,', '예약 링크에 자동으로', '캘린더와 예약이 한 앱에 — 구글 일정도 피해서 열려요', (36, 1450, 1284, 2310)),
    ('bookings', '받은 예약은', '한 곳에서', '수락부터 입금 확인 뒤 확정까지', None),
    ('widgets', '홈 화면에서', '오늘을 한눈에', '위젯에서 바로 완료 체크', None),
    ('report', '이번 달 시간으로', '번 돈', '예약 거래와 직접 기록을 한눈에', None),
]

TOP = (91, 82, 236)
BOT = (49, 40, 140)
GLOW = (150, 160, 255)


def background(W, H):
    g = Image.new('RGB', (1, H))
    for y in range(H):
        t = y / (H - 1)
        g.putpixel((0, y), tuple(int(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)))
    im = g.resize((W, H))
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.40, -H * 0.10, W * 1.30, H * 0.30], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(int(W * 0.12)))
    return Image.composite(Image.new('RGB', (W, H), GLOW), im, glow)


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out


def status_glyphs(src, box_h, bg):
    """원본 iOS 화면 위 상태바의 글자·아이콘만 떼어 낸다(배경색과 다른 픽셀)."""
    strip = src.crop((0, 0, src.width, box_h)).convert('RGBA')
    px = strip.load()
    for y in range(strip.height):
        for x in range(strip.width):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 60:
                px[x, y] = (0, 0, 0, 0)
    return strip


def link_screen():
    """웹 링크 페이지에는 상태바가 없어 하루 보기 원본의 상태바를 얹는다."""
    page = Image.open(os.path.join(RAW, 'link.png')).convert('RGB')
    day = Image.open(os.path.join(RAW, 'day.png')).convert('RGB')
    sb_h = 150
    canvas_c = page.getpixel((10, 10))
    out = Image.new('RGB', page.size, canvas_c)
    out.paste(page.crop((0, 0, page.width, page.height - sb_h)), (0, sb_h))
    glyphs = status_glyphs(day, sb_h, day.getpixel((660, 20)))
    out.paste(glyphs, (0, 0), glyphs)
    return out


def remind_screen():
    """잠금화면 — 예약 1시간 전 리마인더 메일 + Orbit42 아침 일정 요약 알림(실제 문구와 같게)."""
    wall = Image.open(os.path.join(RAW, 'widgets.png')).convert('RGB')
    W, H = wall.size
    sb = status_glyphs(wall, 150, wall.getpixel((660, 20)))
    sb = sb.crop((W // 2, 0, W, 150))   # 잠금화면은 상태바에 시각이 없다 — 오른쪽 아이콘만
    bg = wall.filter(ImageFilter.GaussianBlur(60))
    bg = Image.blend(bg, Image.new('RGB', bg.size, (60, 50, 160)), 0.25).convert('RGBA')
    bg.alpha_composite(sb, (W // 2, 0))
    d = ImageDraw.Draw(bg)
    white = (255, 255, 255)
    t = '10월 25일 일요일'
    f = font(64, 'semibold')
    d.text(((W - d.textlength(t, font=f)) / 2, 300), t, font=f, fill=white)
    f = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', 330, index=1)
    t = '9:41'
    d.text(((W - d.textlength(t, font=f)) / 2, 360), t, font=f, fill=white)

    icon = Image.open(os.path.join(RAW, 'icon.png')).convert('RGB').resize((132, 132), Image.LANCZOS)

    def mail_icon(sz):
        im = Image.new('RGB', (sz, sz))
        for y in range(sz):
            k = y / sz
            ImageDraw.Draw(im).line([(0, y), (sz, y)], fill=(int(30 + 30 * k), int(150 - 40 * k), 255))
        dd = ImageDraw.Draw(im)
        m = sz * 0.2
        dd.rounded_rectangle([m, sz * 0.3, sz - m, sz * 0.72], 8, fill=white)
        dd.line([(m, sz * 0.3), (sz / 2, sz * 0.53), (sz - m, sz * 0.3)], fill=(40, 120, 255), width=max(3, sz // 30))
        return im

    def card(y, ic, app, when, title, lines):
        x0, x1 = 50, W - 50
        h = 120 + 66 + 54 * len(lines)
        layer = Image.new('RGBA', bg.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle([x0, y, x1, y + h], 64, fill=(255, 255, 255, 215))
        bg.alpha_composite(layer)
        bg.paste(rounded(ic, 30), (x0 + 36, y + 40), rounded(ic, 30))
        tx = x0 + 36 + 132 + 34
        d.text((tx, y + 40), app, font=font(42, 'semibold'), fill=(90, 90, 100))
        fw = font(40, 'medium')
        d.text((x1 - 40 - d.textlength(when, font=fw), y + 42), when, font=fw, fill=(110, 110, 120))
        d.text((tx, y + 98), title, font=font(52, 'bold'), fill=(20, 20, 30))
        yy = y + 166
        for ln in lines:
            d.text((tx, yy), ln, font=font(46, 'medium'), fill=(45, 45, 55))
            yy += 54
        return y + h + 28

    y = 1040
    y = card(y, mail_icon(132), '메일', '지금', 'Orbit42',
             ['[Orbit42] 1시간 뒤 예약: 커피챗 30분', '10월 25일 (일) 오전 10:45 · 예시 게스트 A'])
    card(y, icon, 'ORBIT42', '오전 8:00', '오늘 일정 3개',
         ['오전 7:30 아침 운동', '오전 10:45 커피챗 30분', '오후 2:00 브랜드 시안 작업'])
    return bg.convert('RGB')


def widgets_screen():
    """1.5.2 위젯 원본의 상태바 시각(24시간제 09:41)을 새 원본의 9:41 로 바꾼다."""
    w = Image.open(os.path.join(RAW, 'widgets.png')).convert('RGB')
    day = Image.open(os.path.join(RAW, 'day.png')).convert('RGB')
    half = w.width // 2
    d = ImageDraw.Draw(w)
    for y in range(0, 150):
        d.line([(0, y), (half, y)], fill=w.getpixel((half + 40, y)))
    glyphs = status_glyphs(day, 150, day.getpixel((660, 20))).crop((0, 0, half, 150))
    w.paste(glyphs, (0, 0), glyphs)
    # 배경화면(보라→분홍)을 한 계열 보라로 — 위젯 카드·아이콘은 그대로, 배경화면 픽셀만 바꾼다
    px = w.load()
    W2, H2 = w.size
    top, bot = (110, 112, 240), (64, 52, 190)
    for y in range(H2):
        ref = w.getpixel((6, y)) if y >= 150 else None
        t = y / (H2 - 1)
        new = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(W2):
            r, g, b = px[x, y]
            if ref is None:
                # 상태바 줄 — 글자·아이콘(어두운 픽셀·초록 배터리)은 남긴다
                if r + g + b > 300 and not (g > r + 40):
                    px[x, y] = new
                continue
            if abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) < 40:
                px[x, y] = new
    return w


def screen(key, ipad=False):
    if ipad:
        return Image.open(os.path.join(RAW, 'ipad', f'{key}.png')).convert('RGB')
    if key == 'widgets':
        return widgets_screen()
    if key == 'link':
        return link_screen()
    if key == 'remind':
        return remind_screen()
    return Image.open(os.path.join(RAW, f'{key}.png')).convert('RGB')


def compose(W, H, key, l1, l2, sub, out, zoom=None, device_w_ratio=0.80, top_ratio=0.235, ipad=False):
    im = background(W, H).convert('RGBA')
    d = ImageDraw.Draw(im)
    s = W / 1320
    y = int(150 * s)
    size = 108 * s
    while max(d.textlength(t, font=font(size)) for t in (l1, l2)) > W * 0.90:
        size -= 2
    for txt, col in ((l1, (255, 255, 255)), (l2, (214, 220, 255))):
        f = font(size)
        d.text(((W - d.textlength(txt, font=f)) / 2, y), txt, font=f, fill=col)
        y += int(134 * s)
    f = font(46 * s, 'medium')
    d.text(((W - d.textlength(sub, font=f)) / 2, y + int(22 * s)), sub, font=f, fill=(226, 230, 255))

    shot = screen(key, ipad)
    pw = int(W * device_w_ratio)
    ph = int(shot.height * pw / shot.width)
    shot = shot.resize((pw, ph), Image.LANCZOS)
    bez = int(24 * s)
    r = int(140 * s * (device_w_ratio / 0.80))
    dev = Image.new('RGBA', (pw + bez * 2, ph + bez * 2), (0, 0, 0, 0))
    ImageDraw.Draw(dev).rounded_rectangle([0, 0, dev.size[0] - 1, dev.size[1] - 1], r + bez, fill=(16, 16, 22, 255))
    rs = rounded(shot, r)
    dev.paste(rs, (bez, bez), rs)
    top = int(H * top_ratio)
    x = (W - dev.size[0]) // 2
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x + int(12 * s), top + int(40 * s), x + dev.size[0] - int(12 * s), top + dev.size[1]], r + bez, fill=(10, 6, 50, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(int(48 * s)))
    im = Image.alpha_composite(im, sh)
    im.alpha_composite(dev, (x, top))   # 아래는 화면 밖으로 넘어가 잘린다(글씨를 크게 보이게)
    if zoom:
        # 작은 글씨 부분을 크게 — 원본의 그 영역을 1.25배로 카드처럼 띄운다
        raw = screen(key, ipad)
        crop = raw.crop(zoom)
        k = pw / raw.width
        zw = int(crop.width * k * 1.25)
        zh = int(crop.height * k * 1.25)
        card = rounded(crop.resize((zw, zh), Image.LANCZOS), int(48 * s))
        cx = (W - zw) // 2
        cy = top + bez + int(zoom[1] * k) - int((zh - crop.height * k) / 2)
        sh2 = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh2).rounded_rectangle([cx, cy + int(20 * s), cx + zw, cy + zh + int(20 * s)], int(48 * s), fill=(10, 6, 50, 140))
        sh2 = sh2.filter(ImageFilter.GaussianBlur(int(40 * s)))
        im = Image.alpha_composite(im, sh2)
        im.alpha_composite(card, (cx, cy))
    im.convert('RGB').save(out)


if __name__ == '__main__':
    out = os.path.join(HERE, 'out69')
    os.makedirs(out, exist_ok=True)
    for n, (k, a, b, c, z) in enumerate(SLIDES, 1):
        compose(1320, 2868, k, a, b, c, os.path.join(out, f'{n:02d}-{k}.png'), zoom=z)
    print('iphone done')
    # iPad 13" — 같은 구성에서 6장(링크 페이지·위젯은 iPad 원본이 없어 뺌), 오르빗 첫 장
    outp = os.path.join(HERE, 'outipad')
    os.makedirs(outp, exist_ok=True)
    pick = ['orbit', 'guest', 'day', 'newslot', 'bookings', 'report']
    ipad_zoom = {'newslot': None}
    n = 0
    for k, a, b, c, z in SLIDES:
        if k not in pick:
            continue
        n += 1
        compose(2064, 2752, k, a, b, c, os.path.join(outp, f'{n:02d}-{k}.png'), zoom=ipad_zoom.get(k), device_w_ratio=0.84, top_ratio=0.30, ipad=True)
    print('ipad done')
