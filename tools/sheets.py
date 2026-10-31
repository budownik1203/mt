from PIL import Image, ImageDraw, ImageFont
F=lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",s)
B=lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",s)
for w,wn in [('sword','Broń jednoręczna (miecz)'),('longsword','Broń dwuręczna (miecz dwuręczny)'),('spear','Broń drzewcowa (włócznia)')]:
  rows=[('over','Góra'),('right','Prawo'),('left','Lewo'),('thrust','Pchnięcie (dół)'),('blocks','Bloki')]
  cw,ch,lw,hd=260,300,170,70
  S=Image.new('RGB',(lw+cw*4,hd+ch*5),(18,19,21)); d=ImageDraw.Draw(S)
  d.text((14,10),wn,fill=(232,214,170),font=B(22))
  for i,n in enumerate(['zamach (trzymany)','w łuku','trafienie','dokończenie']): d.text((lw+i*cw+10,44),n,fill=(150,143,131),font=F(15))
  for j,(mv,mn) in enumerate(rows):
    d.text((14,hd+j*ch+ch//2-10),mn,fill=(226,220,205),font=B(19))
    if mv=='blocks': d.text((14,hd+j*ch+ch//2+16),'góra·prawo·lewo·dół',fill=(150,143,131),font=F(13))
    for i in range(4):
      im=Image.open(f'shots/a_{w}_{mv}_{i}.png'); W,H=im.size
      S.paste(im.crop((int(W*0.2),0,int(W*0.8),H)).resize((cw,ch),Image.NEAREST),(lw+i*cw,hd+j*ch))
  S.save(f'shots/ruchy_{w}.png')
