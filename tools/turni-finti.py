# 24c.15 (D-170): genera le immagini inventate della tabella turni "stile Excel larga" per le prove.
# Forma e generatore del Coordinatore (coordinamento/consegne/00-formato-turni-excel-larga.md), solo dati inventati.
# Uso: python3 tools/turni-finti.py CARTELLA  → turni-larga.jpg (pulita, quality 85), turni-larga-sporca.jpg
# (numeri e nomi non in grassetto, quality 60, rimpicciolita del 15% e riallargata), turni-larga-tagliata.jpg
# (la pulita con l'ultima colonna tagliata dal bordo), turni-larga-piccola.jpg (la pulita all'80%) e turni-larga.json (turni attesi).
# Seme fisso: le due immagini hanno gli stessi turni.
import sys, random, json, io, os
from PIL import Image, ImageDraw, ImageFont
def crea(sporca):
    W,H=1284,192
    im=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(im)
    F=lambda s,b=True:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf'%('-Bold' if b else ''),s)
    fb=not sporca  # numeri e nomi sottili nella versione sporca
    pink=(242,220,232);grid=(200,200,200)
    d.rectangle([0,0,W,42],fill=pink);d.text((560,12),'STRUTTURA ESEMPIO',font=F(10),fill='black');d.text((20,30),'TOT REPARTO',font=F(7),fill='black')
    d.rectangle([0,42,W,80],fill=pink)
    x0,step=128,36.6;gs='MMGVSDL'
    for i in range(31):
        x=x0+i*step;d.line([x,44,x,H],fill=grid)
        d.text((x+step/2-4,47),str(i+1),font=F(8,fb),fill='black');d.text((x+step/2-3,63),gs[i%7],font=F(8),fill='black')
    d.line([0,60,W,60],fill=grid);d.line([0,76,W,76],fill=grid)
    d.text((18,64),'REPARTO esempio',font=F(7),fill='black')
    nomi=['ROSSI ANNA','BIANCHI MARIA LUISA','VERDI CHIARA','NERI PAOLA','GIALLI SARA','BRUNI MARIA TERESA']
    random.seed(4);righe=[]
    for r,n in enumerate(nomi):
        y=82+r*18;d.line([0,y,W,y],fill=grid);d.text((2,y+5),n,font=F(6,fb),fill='black');d.text((103,y+4),'ABC',font=F(7),fill='black')
        rr=[]
        for i in range(31):
            x=x0+i*step;v=random.choice(['','','M','P','P','MP'])
            if random.random()<0.06: d.rectangle([x+1,y+1,x+step-1,y+17],fill=(190,190,190));v=''
            if v: d.text((x+step/2-4*len(v)+random.choice([-6,0,4]),y+3),v,font=F(10),fill='black')
            rr.append(v)
        righe.append(rr)
    if sporca:
        im=im.resize((round(W*0.85),round(H*0.85)),Image.BILINEAR).resize((W,H),Image.BILINEAR)
    return im,{n:{str(i+1):v for i,v in enumerate(rr) if v} for n,rr in zip(nomi,righe)}
def classica():
    # forma "classica" (screenshot del telefono, scritte grandi): 14 giorni, nomi Cognome Nome, celle colorate,
    # una sigla bianca su fondo scuro. Serve a controllare che le tabelle già lette bene prima lo siano ancora.
    W,H=1080,560
    im=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(im)
    F=lambda s,b=False:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf'%('-Bold' if b else ''),s)
    x0,step,y0,rh=230,60,70,64
    for i in range(14):
        x=x0+i*step;d.line([x,10,x,H],fill=(160,160,160),width=2)
        tw=d.textlength(str(i+1),font=F(24,True));d.text((x+step/2-tw/2,24),str(i+1),font=F(24,True),fill='black')
    nomi=['Rossi Anna','Bianchi Luca','Verdi Sara','Neri Paolo','Gialli Marta','Bruni Elena','Fabbri Ugo']
    random.seed(7);attesi={}
    for r,n in enumerate(nomi):
        y=y0+r*rh;d.line([0,y,W,y],fill=(160,160,160),width=2);d.text((12,y+18),n,font=F(24),fill='black')
        g={}
        for i in range(14):
            x=x0+i*step;v=random.choice(['','M','P','P','N','R'])
            fondo,col=None,'black'
            if v=='N': fondo,col=(120,20,40),'white'
            elif v=='R': fondo=(255,200,230)
            if fondo: d.rectangle([x+2,y+2,x+step-2,y+rh-2],fill=fondo)
            if v:
                tw=d.textlength(v,font=F(28,True));d.text((x+step/2-tw/2,y+16),v,font=F(28,True),fill=col);g[str(i+1)]=v
        attesi[n]=g
    d.line([0,y0+len(nomi)*rh,W,y0+len(nomi)*rh],fill=(160,160,160),width=2)
    return im,attesi
out=sys.argv[1]
c,attesoC=classica();c.save(os.path.join(out,'turni-classica.jpg'),quality=90)
json.dump(attesoC,open(os.path.join(out,'turni-classica.json'),'w'),ensure_ascii=False,indent=1)
a,atteso=crea(False);a.save(os.path.join(out,'turni-larga.jpg'),quality=85)
b,atteso2=crea(True);b.save(os.path.join(out,'turni-larga-sporca.jpg'),quality=60)
# ultima colonna (31) tagliata dal bordo destro dell'immagine: se ne vedono circa due terzi
a.crop((0,0,1256,a.height)).save(os.path.join(out,'turni-larga-tagliata.jpg'),quality=85)
# 24c.16: la pulita rimpicciolita all'80% (righe alte circa 14 px): serve per l'avviso "La foto è piccola"
a.resize((round(a.width*0.8),round(a.height*0.8)),Image.LANCZOS).save(os.path.join(out,'turni-larga-piccola.jpg'),quality=85)
assert atteso==atteso2
json.dump(atteso,open(os.path.join(out,'turni-larga.json'),'w'),ensure_ascii=False,indent=1)
print('\n'.join(n+': '+' '.join(f'{d}:{v}' for d,v in g.items()) for n,g in atteso.items()))
