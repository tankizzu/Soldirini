#!/usr/bin/env python3
"""Crea soldirini/nunito.woff2 (font dell'interfaccia, D-022/D-032) dal font ufficiale di Google Fonts.

Sorgente: tools/sorgenti/nunito/Nunito[wght].ttf, da https://github.com/google/fonts/tree/main/ofl/nunito
(licenza SIL OFL 1.1, senza nome riservato: il file ridotto può chiamarsi "Nunito").
Cosa fa: limita il peso a 400–800, tiene solo i caratteri usati in italiano (indicazione A di 02 del 15/11/2026),
conserva tutta la tabella dei nomi (copyright e licenza) e salva in WOFF2.
Serve fontTools con brotli:  pip install fonttools brotli   — poi, dalla radice del repository:  python3 tools/crea-nunito.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

RADICE = Path(__file__).resolve().parent.parent
SORG = RADICE / 'tools' / 'sorgenti' / 'nunito' / 'Nunito[wght].ttf'
DEST = RADICE / 'soldirini' / 'nunito.woff2'
CARATTERI = ('U+0020-007E,U+00A0-00FF,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,'
             'U+2039-203A,U+2190-2193,U+2212,U+00D7,U+2122')


def main():
    f = TTFont(SORG)
    opz = subset.Options()
    opz.layout_features = ['*']
    opz.name_IDs = ['*']
    opz.name_languages = ['*']
    opz.name_legacy = True
    opz.notdef_outline = True
    s = subset.Subsetter(opz)
    s.populate(unicodes=subset.parse_unicodes(CARATTERI))
    s.subset(f)
    # prima la riduzione dei caratteri, poi il limite dei pesi (nell'ordine inverso fontTools dà errore sulle variazioni)
    io = __import__('io').BytesIO(); f.save(io); io.seek(0)
    f = instancer.instantiateVariableFont(TTFont(io), {'wght': (400, 800)}, updateFontNames=True)
    f.flavor = 'woff2'
    f.save(DEST)
    print(f'Scritto {DEST.relative_to(RADICE)} ({DEST.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
