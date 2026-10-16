from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
F='/System/Library/Fonts/AppleSDGothicNeo.ttc'
def font(sz, w='bold'):
    return ImageFont.truetype(F, sz, index={'bold':14,'semibold':4,'medium':2,'regular':0}[w])
INDIGO=(99,102,241); DARK=(22,22,30); SUB=(92,96,120)
# 1.5.2 개선-19 — 중요 일정 별·만족도 하트로 01·04·05·06만 다시 찍음 (02·03·07은 1.5.0 세트 그대로)
SLIDES=[('drag','하루를 한눈에,','끌어서 바로 옮기기','꾹 눌러 옮기고, 아래 끝을 끌어 길이를 바꿔요','light',1),('new','빈 곳을 꾹 눌러','바로 새 일정','캘린더는 버튼으로, 중요도도 함께','light',4),('month','한 달을 한눈에,','중요한 일정엔 별 하나','구글 캘린더 일정도 함께 보여요','light',5),('report','끝낸 일에 하트,','나만 보는 리포트','이번 주·지난주·캘린더별로 돌아봐요','light',6)]
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

os.makedirs('out67',exist_ok=True)
for k,a,b,c,m,n in SLIDES:
    make(1290,2796,k,a,b,c,m,f'out67/{n:02d}-{k}.png')
print('done')
