from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
F='/System/Library/Fonts/AppleSDGothicNeo.ttc'
def font(sz, w='bold'):
    return ImageFont.truetype(F, sz, index={'bold':14,'semibold':4,'medium':2,'regular':0}[w])
INDIGO=(99,102,241); DARK=(22,22,30); SUB=(92,96,120)
SLIDES=[
 ("bookings","예약은 링크로,","입금 확인까지 한 번에","카톡·구글폼·계좌이체로 오가던 조율을 앱 하나로", "dark"),
 ("newslot","30초면 만드는","내 예약 링크","무엇을 · 얼마나 · 언제 — 세 가지만 정하면 끝","light"),
 ("booking_detail","입금 확인하면","예약 확정","계좌 안내는 자동으로, 24시간 미입금은 자동 취소","light"),
 ("calendar","구글 캘린더와","한 화면에서","일정마다 내 시간의 가치(₩)까지 보여줘요","light"),
 ("slots","링크 하나로","DM 대신 예약","인스타 프로필·카톡에 붙이면 바로 예약이 들어와요","light"),
 ("asset","이번 달,","시간으로 번 돈","판매 현황과 내 1시간의 가치를 한눈에","light"),
]
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
def make(W,H,key,l1,l2,sub,mode,out):
    im=bg(W,H,mode).convert('RGBA'); d=ImageDraw.Draw(im)
    s=W/1320
    tc=(255,255,255) if mode=='dark' else DARK
    hc=(199,210,254) if mode=='dark' else INDIGO
    sc=(224,231,255) if mode=='dark' else SUB
    y=int(170*s)
    for txt,col in ((l1,tc),(l2,hc)):
        f=font(int(112*s)); w=d.textlength(txt,font=f); d.text(((W-w)/2,y),txt,font=f,fill=col); y+=int(138*s)
    f=font(int(46*s),'medium'); w=d.textlength(sub,font=f); d.text(((W-w)/2,y+int(24*s)),sub,font=f,fill=sc)
    # 기기
    shot=Image.open(f'raw/{key}.png').convert('RGB')
    pw=int(1000*s); ph=int(shot.height*pw/shot.width)
    shot=shot.resize((pw,ph),Image.LANCZOS)
    bez=int(26*s); r=int(150*s)
    dev=Image.new('RGBA',(pw+bez*2,ph+bez*2),(0,0,0,0))
    ImageDraw.Draw(dev).rounded_rectangle([0,0,dev.size[0]-1,dev.size[1]-1],r+bez,fill=(18,18,22,255))
    dev.paste(rounded(shot,r),(bez,bez),rounded(shot,r))
    top=int(640*s)
    # 그림자
    sh=Image.new('RGBA',im.size,(0,0,0,0)); sd=ImageDraw.Draw(sh)
    x=(W-dev.size[0])//2
    sd.rounded_rectangle([x+int(10*s),top+int(40*s),x+dev.size[0]-int(10*s),top+dev.size[1]],r+bez,fill=(20,20,60,110 if mode=='light' else 160))
    sh=sh.filter(ImageFilter.GaussianBlur(int(50*s)))
    im=Image.alpha_composite(im,sh)
    im.alpha_composite(dev,(x,top))
    im.convert('RGB').save(out)
os.makedirs('out69',exist_ok=True); os.makedirs('out67',exist_ok=True)
for i,(k,a,b,c,m) in enumerate(SLIDES,1):
    make(1320,2868,k,a,b,c,m,f'out69/{i:02d}-{k}.png')
    make(1290,2796,k,a,b,c,m,f'out67/{i:02d}-{k}.png')
print('done')
