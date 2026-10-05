from compose import bg, font, rounded, DARK, INDIGO, SUB
from PIL import Image, ImageDraw, ImageFilter
import os
SL=[("bookings","예약은 링크로,","입금 확인까지 한 번에","카톡·구글폼·계좌이체로 오가던 조율을 앱 하나로","dark"),
 ("booking_detail","입금 확인하면","예약 확정","계좌 안내는 자동으로, 24시간 미입금은 자동 취소","light"),
 ("calendar","구글 캘린더와","한 화면에서","일정마다 내 시간의 가치(₩)까지 보여줘요","light"),
 ("slots","링크 하나로","DM 대신 예약","인스타 프로필·카톡에 붙이면 바로 예약이 들어와요","light"),
 ("asset","이번 달,","시간으로 번 돈","판매 현황과 내 1시간의 가치를 한눈에","light")]
W,H=2064,2752
os.makedirs("outipad",exist_ok=True)
for i,(k,l1,l2,sub,mode) in enumerate(SL,1):
    im=bg(W,H,mode).convert("RGBA"); d=ImageDraw.Draw(im)
    tc=(255,255,255) if mode=="dark" else DARK; hc=(199,210,254) if mode=="dark" else INDIGO; sc=(224,231,255) if mode=="dark" else SUB
    f=font(120); y=150
    line=l1+" "+l2
    w1=d.textlength(l1+" ",font=f); w2=d.textlength(l2,font=f); x=(W-w1-w2)/2
    d.text((x,y),l1+" ",font=f,fill=tc); d.text((x+w1,y),l2,font=f,fill=hc)
    f2=font(54,"medium"); w=d.textlength(sub,font=f2); d.text(((W-w)/2,y+175),sub,font=f2,fill=sc)
    shot=Image.open(f"rawipad/{k}.png").convert("RGB")
    pw=1720; ph=int(shot.height*pw/shot.width); shot=shot.resize((pw,ph),Image.LANCZOS)
    bez=30; r=60
    dev=Image.new("RGBA",(pw+2*bez,ph+2*bez),(0,0,0,0))
    ImageDraw.Draw(dev).rounded_rectangle([0,0,dev.size[0]-1,dev.size[1]-1],r+bez,fill=(18,18,22,255))
    rs=rounded(shot,r); dev.paste(rs,(bez,bez),rs)
    top=520; x=(W-dev.size[0])//2
    sh=Image.new("RGBA",im.size,(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([x+20,top+50,x+dev.size[0]-20,top+dev.size[1]],r+bez,fill=(20,20,60,110 if mode=="light" else 160))
    im=Image.alpha_composite(im,sh.filter(ImageFilter.GaussianBlur(60)))
    im.alpha_composite(dev,(x,top))
    im.convert("RGB").save(f"outipad/{i:02d}-{k}.png")
print("ok")
