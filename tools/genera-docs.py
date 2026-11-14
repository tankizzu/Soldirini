#!/usr/bin/env python3
"""Rigenera soldirini/docs.js e soldirini/fonts.css a partire da tools/sorgenti/.

Uso (dalla radice del repository):   python3 tools/genera-docs.py
Controllo senza scrivere nulla:       python3 tools/genera-docs.py --controlla

- docs.js  = sorgenti/docs-base.js + misure della ricevuta (sorgenti/ric_spec.json) + due ritocchi
             (firma sulla ricevuta, codice fiscale dell'associazione facoltativo).
- fonts.css = i font di sorgenti/font/ incorporati in base64 (licenze in sorgenti/font/LICENZE.md).
Serve solo Python 3, nessuna libreria esterna.
"""
import base64, json, sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
SORG = Path(__file__).resolve().parent / 'sorgenti'
SITO = RADICE / 'soldirini'

FONT = [('XPal', 'pal-r', 400, 'normal'), ('XPal', 'pal-b', 700, 'normal'), ('XPal', 'pal-i', 400, 'italic'), ('XPal', 'pal-bi', 700, 'italic'),
        ('XCal', 'cal-r', 400, 'normal'), ('XCal', 'cal-b', 700, 'normal'), ('XTim', 'tim-r', 400, 'normal'), ('XTim', 'tim-b', 700, 'normal')]


def b64(p):
    return base64.b64encode(p.read_bytes()).decode()


def fonts_css():
    return '\n'.join(
        f"@font-face{{font-family:'{f}';src:url(data:font/woff2;base64,{b64(SORG / 'font' / (n + '.woff2'))}) format('woff2');"
        f"font-weight:{w};font-style:{s};font-display:block}}" for f, n, w, s in FONT)


def sostituisci(testo, vecchio, nuovo):
    assert testo.count(vecchio) == 1, 'punto non trovato in docs-base.js: ' + vecchio[:50]
    return testo.replace(vecchio, nuovo)


def docs_js():
    s = json.loads((SORG / 'ric_spec.json').read_text(encoding='utf-8'))
    js = (SORG / 'docs-base.js').read_text(encoding='utf-8')
    js = (js.replace('/*RIC_COLS*/[]', json.dumps(s['cols'])).replace('/*RIC_ROWS*/[]', json.dumps(s['rows']))
            .replace('/*RIC_H*/[]', json.dumps(s['H'])).replace('/*RIC_V*/[]', json.dumps(s['V'])).replace('/*RIC_LOGO*/{}', json.dumps(s['logo'])))
    js = sostituisci(js, "function buildRicevuta(d,logoSrc){", "function buildRicevuta(d,logoSrc,sigSrc){")
    js = sostituisci(js, "  return page;\n}\n\n// ---------- NOTA", """  if(sigSrc){const x=ox+colX[14]*scale,y=oy+rowY[45]*scale,w=(colX[20]-colX[14])*scale,hh=(rowY[48]-rowY[45])*scale;
    const img=el('img',`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${hh}px;object-fit:contain`);img.src=sigSrc;img.alt='';page.appendChild(img);}
  return page;
}

// ---------- NOTA""")
    js = js.replace("'C.F.'+h(d.assoc.cf)", "(d.assoc.cf?'C.F.'+h(d.assoc.cf):'')")
    return js


def main():
    risultati = {'fonts.css': fonts_css(), 'docs.js': docs_js()}
    if '--controlla' in sys.argv:
        diversi = [n for n, t in risultati.items() if (SITO / n).read_text(encoding='utf-8') != t]
        print('Diversi da quelli nel sito: ' + ', '.join(diversi) if diversi else 'docs.js e fonts.css sono identici a quelli rigenerati.')
        sys.exit(1 if diversi else 0)
    for n, t in risultati.items():
        (SITO / n).write_text(t, encoding='utf-8')
        print('Scritto soldirini/' + n)


if __name__ == '__main__':
    main()
