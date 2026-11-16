#!/usr/bin/env python3
"""Rinomina i font dei documenti (D-022, report 03 sulle licenze del 15/11/2026).

I file di tools/sorgenti/font/ sono versioni ridotte (solo i caratteri usati, WOFF2) di Carlito, Liberation Serif e
TeX Gyre Pagella. Per le licenze (SIL OFL 1.1 con "nome riservato"; GUST Font License/LPPL) una versione modificata
non deve usare il nome originale e deve dire che è modificata e dove trovare l'originale.
Questo script, una volta sola: cambia i nomi interni in XCal / XTim / XPal (come già nel CSS), conserva il copyright
(nome 0) e il marchio (nome 7), aggiunge la descrizione della modifica (nome 10) e la licenza (nomi 13 e 14),
e rinomina anche i nomi nella tabella CFF di Pagella. È ripetibile: rilanciarlo non cambia di nuovo i file.
Serve fontTools con brotli:  pip install fonttools brotli   — poi, dalla radice:  python3 tools/rinomina-font.py
Dopo: python3 tools/genera-docs.py  (rigenera soldirini/fonts.css).
"""
from pathlib import Path
from fontTools.ttLib import TTFont

DIR = Path(__file__).resolve().parent / 'sorgenti' / 'font'
OFL = ('Questo font è distribuito con licenza SIL Open Font License, versione 1.1.', 'https://openfontlicense.org')
GUST = ('Questo font è distribuito con licenza GUST Font License (LaTeX Project Public License 1.3c).',
        'https://www.gust.org.pl/projects/e-foundry/licenses')
FAMIGLIE = {
    'cal': ('XCal', 'Carlito', 'https://github.com/googlefonts/carlito', OFL),
    'tim': ('XTim', 'Liberation Serif', 'https://github.com/liberationfonts/liberation-fonts', OFL),
    'pal': ('XPal', 'TeX Gyre Pagella', 'https://www.gust.org.pl/projects/e-foundry/tex-gyre', GUST),
}
STILI = {'r': 'Regular', 'b': 'Bold', 'i': 'Italic', 'bi': 'Bold Italic'}


def rinomina(p):
    fam, stile = p.stem.split('-')
    nuovo, orig, url, (lic, lic_url) = FAMIGLIE[fam]
    sub = STILI[stile]
    ps = f'{nuovo}-{sub.replace(" ", "")}'
    f = TTFont(p)
    n = f['name']
    versione = n.getDebugName(5) or ''
    valori = {
        1: nuovo, 2: sub, 3: f'{ps};Soldirini;{versione}', 4: f'{nuovo} {sub}', 6: ps,
        10: f'Versione ridotta di {orig} per Soldirini: solo i caratteri usati, formato WOFF2, nomi cambiati. '
            f'Originale: {url}',
        13: lic, 14: lic_url,
    }
    for nid in (16, 17, 21, 22):  # nomi tipografici: se presenti, tolti (rimarrebbe il nome originale)
        n.removeNames(nameID=nid)
    for nid, testo in valori.items():
        n.removeNames(nameID=nid)
        n.setName(testo, nid, 3, 1, 0x409)
    if 'CFF ' in f:
        cff = f['CFF '].cff
        cff.fontNames = [ps]
        td = cff.topDictIndex[0]
        td.FullName = f'{nuovo} {sub}'
        td.FamilyName = nuovo
    f.save(p)
    print(f'{p.name}: {orig} {sub} -> {nuovo} {sub}')


if __name__ == '__main__':
    for p in sorted(DIR.glob('*.woff2')):
        rinomina(p)
