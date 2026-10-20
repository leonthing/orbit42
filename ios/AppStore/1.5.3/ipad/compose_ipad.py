"""1.5.3 iPad 13" 스토어 세트 — 1.5.2 iPhone set7 과 같은 순서·확정 문구(PO_orbit42/기획_스토어스크린샷_재구성.md).
실행: cd ios/AppStore/1.5.3/ipad && /usr/bin/python3 compose_ipad.py → out13/ (2064×2752)"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
F='/System/Library/Fonts/AppleSDGothicNeo.ttc'
def font(sz, w='bold'):
    return ImageFont.truetype(F, sz, index={'bold':14,'semibold':4,'medium':2,'regular':0}[w])
INDIGO=(99,102,241); DARK=(22,22,30); SUB=(92,96,120)
# 1.5.2 새 세트(7장, CEO 승인) — 예약 링크·캘린더·시간 자산 리포트를 앞에
SLIDES=[('guest','DM 대신 링크 하나로,','상대가 직접 시간을 골라요','코칭·상담·레슨 예약','dark',1),
('day','일정과 예약을 한 곳에,','하루를 한눈에','구글 캘린더를 연결하면 앱에서 고친 일정도 바로 반영돼요','light',2),
('value','내 시간이 얼마인지,','리포트로 확인해요','수입·투자·잃어버린 시간','light',3),
('bookings','예약 수락부터 확정까지,','앱에서 바로','계좌이체는 입금을 확인한 뒤 눌러 확정해요','dark',4),
('widgets','홈 화면에서 바로,','오늘 일정과 체크','위젯에서 완료 체크까지','light',5),
('important','중요한 일정엔 별,','30분·10분 전에 알려 줘요','중요함을 고르면 기본 알림이 두 번 울려요','light',6),
('report','끝낸 일에 하트,','나만 보는 리포트','이번 주·지난주·캘린더별로 돌아봐요','light',7)]
def rounded(im, r):
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,im.size[0]-1,im.size[1]-1],r,fill=255)
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.paste(im,(0,0),m); return out
def bg(W,H,mode):
    if mode=='dark':
        top=(79,70,229); bot=(49,46,129)
    else:
        top=(238,240,255); bot=(248,248,252)
    g=Image.new('RGB',(1,H))
    for y in range(H):
        t=y/(H-1); g.putpixel((0,y),tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3)))
    im=g.resize((W,H))
    # 부드러운 원형 광원
    glow=Image.new('L',(W,H),0); d=ImageDraw.Draw(glow); d.ellipse([W*0.45,-H*0.08,W*1.25,H*0.32],fill=90 if mode=='dark' else 120)
    glow=glow.filter(ImageFilter.GaussianBlur(160))
    tint=Image.new('RGB',(W,H),(129,140,248) if mode=='dark' else (199,210,254))
    im=Image.composite(tint,im,glow)
    return im

# ── iPad 13" 배치 (위: 1.5.2 compose_set7.py 와 같은 문구·배경) ──

W, H = 2064, 2752
HERE = os.path.dirname(os.path.abspath(__file__))


def clear_top_strip(im):
    """07 전용(PO 10/20 B안): iPad 13"은 리포트가 짧아 만족도까지 내리면 탭 바 양옆에 윗 카드
    (지난주 리포트)의 '수입·투자 시간·잃어버린 시간' 줄이 남는다. 상태 막대 아래~주간 목표 카드 위 띠만
    앱 배경색으로 칠한다. 시계·배터리 글자와 탭 바 캡슐은 원본 그대로. 좌표는 raw/report.png(2064×2752) 픽셀 기준."""
    W = im.width
    BG = (242, 242, 247)           # 앱 배경(systemGroupedBackground) — 왼쪽 여백 (40,700)에서 잰 값
    TOP = 236                      # 주간 목표 카드 위 경계(241px) 바로 위까지 칠함
    PILL = (656, 64, 1407, 152)    # 탭 바 캡슐(y=108 줄의 흰 구간), 모서리 반지름 44
    STATUS_Y, CLOCK_X, ICONS_X = 70, 400, 1860   # 상태 막대 높이, 시계 오른쪽 끝, 배터리·와이파이 왼쪽 끝
    pill = Image.new('L', im.size, 0); ImageDraw.Draw(pill).rounded_rectangle(PILL, 44, fill=255)
    out = im.copy(); px = out.load(); src = im.load(); pm = pill.load()
    for y in range(TOP):
        for x in range(W):
            if pm[x, y]:
                continue
            r, g, b = src[x, y]
            if y < STATUS_Y and (x < CLOCK_X or x > ICONS_X):
                # 상태 막대 글자: 밝은 바탕만 배경색으로 옮기고 글자 진하기(a)는 유지
                a = max(0.0, min(1.0, (255 - min(r, g, b)) / 200))
                px[x, y] = tuple(int(c * a + BG[i] * (1 - a)) if a > 0.02 else BG[i] for i, c in enumerate((r, g, b)))
            else:
                px[x, y] = BG
    # 지운 자리에 캡슐 그림자를 옅게 다시 그림
    sh = Image.new('L', im.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([PILL[0], 70, PILL[2], 160], 44, fill=60)
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    band = Image.composite(Image.new('RGB', im.size, (200, 200, 212)), out, sh); band.paste(im, (0, 0), pill)
    out.paste(band.crop((0, 0, W, TOP)), (0, 0))
    return out


def make(key, l1, l2, sub, mode, out):
    im = bg(W, H, mode).convert('RGBA'); d = ImageDraw.Draw(im)
    tc = (255, 255, 255) if mode == 'dark' else DARK
    hc = (199, 210, 254) if mode == 'dark' else INDIGO
    sc = (224, 231, 255) if mode == 'dark' else SUB
    y = 150
    for txt, col in ((l1, tc), (l2, hc)):
        f = font(120); w = d.textlength(txt, font=f); d.text(((W - w) / 2, y), txt, font=f, fill=col); y += 150
    f = font(54, 'medium'); w = d.textlength(sub, font=f); d.text(((W - w) / 2, y + 30), sub, font=f, fill=sc)
    shot = Image.open(os.path.join(HERE, 'raw', f'{key}.png')).convert('RGB')
    if key == 'report':
        shot = clear_top_strip(shot)
    pw = 1640; ph = int(shot.height * pw / shot.width); shot = shot.resize((pw, ph), Image.LANCZOS)
    bez, r = 30, 60
    dev = Image.new('RGBA', (pw + 2 * bez, ph + 2 * bez), (0, 0, 0, 0))
    ImageDraw.Draw(dev).rounded_rectangle([0, 0, dev.size[0] - 1, dev.size[1] - 1], r + bez, fill=(18, 18, 22, 255))
    rs = rounded(shot, r); dev.paste(rs, (bez, bez), rs)
    top = 640; x = (W - dev.size[0]) // 2
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x + 20, top + 50, x + dev.size[0] - 20, top + dev.size[1]], r + bez, fill=(20, 20, 60, 110 if mode == 'light' else 160))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(60)))
    im.alpha_composite(dev, (x, top))
    im.convert('RGB').save(out)


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'out13'), exist_ok=True)
    for k, a, b, c, m, n in SLIDES:
        make(k, a, b, c, m, os.path.join(HERE, 'out13', f'{n:02d}-{k}.png'))
    print('done')
