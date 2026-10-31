from PIL import Image, ImageDraw
import sys
fs=['windup_0','release_0','windup_1','release_1','windup_2','release_2','windup_3','release_3','block_0','block_1','block_2','block_3']
ims=[Image.open(f'shots/pose_{f}.png').resize((300,300)) for f in fs]
W=Image.new('RGB',(1200,900))
d=ImageDraw.Draw(W)
for i,im in enumerate(ims):
  W.paste(im,((i%4)*300,(i//4)*300)); d.text(((i%4)*300+6,(i//4)*300+6),fs[i],fill=(255,255,0))
W.save(sys.argv[1] if len(sys.argv)>1 else 'shots/sheet.png')
