from PIL import Image, ImageDraw, ImageFont
F=lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",s)
B=lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",s)
for w,wn in [('sword','Jednoręczna (miecz)'),('longsword','Dwuręczna (miecz dwuręczny)'),('glaive','Drzewcowa (glewia)')]:
  rows=[('over','Góra'),('right','Prawo'),('left','Lewo'),('thrust','Pchnięcie'),('blocks','Bloki')]
  cw,ch,lw,hd=220,260,130,64
  S=Image.new('RGB',(lw+cw*5,hd+ch*5+(ch if w=='sword' else 0)),(18,19,21)); d=ImageDraw.Draw(S)
  d.text((14,8),wn,fill=(232,214,170),font=B(22))
  for i,n in enumerate(['zamach (trzymany)','cios','trafienie','dokończenie','powrót']): d.text((lw+i*cw+8,40),n,fill=(150,143,131),font=F(14))
  if w=='sword': rows=rows+[('shield','Tarcza')]
  for j,(mv,mn) in enumerate(rows):
    d.text((12,hd+j*ch+ch//2-10),mn,fill=(226,220,205),font=B(18))
    if mv in ('blocks','shield'): d.text((12,hd+j*ch+ch//2+14),'góra·prawo·\nlewo·dół',fill=(150,143,131),font=F(12))
    for i in range(4 if mv in ('blocks','shield') else 5):
      f=f'shots/b_{w}_{mv}_{i}.png' if mv!='shield' else f'shots/b_shield_blocks_{i}.png'
      im=Image.open(f); W,H=im.size
      S.paste(im.crop((int(W*0.2),0,int(W*0.8),H)).resize((cw,ch),Image.NEAREST),(lw+i*cw,hd+j*ch))
  S.save(f'shots/v_{w}.png')
