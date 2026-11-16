# Font usati nei documenti di Soldirini

I file `.woff2` di questa cartella vengono incorporati in `soldirini/fonts.css` da `tools/genera-docs.py`.
Servono a riprodurre la nota spese e la ricevuta con caratteri simili a quelli dei modelli originali.

## Modifiche fatte rispetto agli originali (v21b, 15–16/11/2026)
1. **Ridotti:** tenuti solo i caratteri usati nei documenti (210–275 glifi per file).
2. **Formato WOFF2.**
3. **Rinominati** con `tools/rinomina-font.py`, perché le licenze non permettono di usare il nome originale per una versione modificata:
   - nomi interni 1, 3, 4, 6 → `XCal` / `XTim` / `XPal` con lo stile (per esempio `XPal Bold Italic`, `XPal-BoldItalic`);
   - per Pagella anche i nomi nella tabella CFF;
   - tolti i nomi tipografici 16, 17, 21, 22;
   - **conservati** il copyright (nome 0) e il marchio (nome 7).
4. **Aggiunti dentro i file:**
   - nome 10: "Versione ridotta di … per Soldirini …" con l'indirizzo dell'originale;
   - nome 13: la licenza in breve;
   - nome 14: l'indirizzo della licenza.

L'aspetto non cambia: ricevuta, nota spese e un testo di prova con tutti gli 8 font sono risultati identici pixel per pixel prima e dopo il cambio di nome.

| File | Nome nell'app | Originale | Licenza | Testo della licenza |
|---|---|---|---|---|
| `cal-r.woff2`, `cal-b.woff2` | XCal | Carlito (© 2013 The Carlito Project Authors), nome riservato "Carlito" | SIL Open Font License 1.1 | `OFL-Carlito.txt` (da https://github.com/googlefonts/carlito) |
| `tim-r.woff2`, `tim-b.woff2` | XTim | Liberation Serif (© 2010 Google Corporation, © 2012 Red Hat, Inc.), nome riservato "Liberation" | SIL Open Font License 1.1 | `LICENSE-Liberation.txt` (da https://github.com/liberationfonts/liberation-fonts) |
| `pal-r.woff2`, `pal-b.woff2`, `pal-i.woff2`, `pal-bi.woff2` | XPal | TeX Gyre Pagella (© B. Jackowski, J.M. Nowacki e altri, GUST e-foundry) | GUST Font License (LPPL 1.3c) | `GUST-FONT-LICENSE.txt` |

`GUST-FONT-LICENSE.txt` è preso dal pacchetto Debian `fonts-texgyre` (20180621), che contiene la distribuzione TeX Gyre di CTAN. Il sito CTAN non era raggiungibile dall'ambiente di sviluppo.

**Pubblicazione:** le licenze sono anche in `soldirini/licenze/`, insieme alla pagina "Licenze" dell'app (Impostazioni → Licenze). In quella cartella ci sono anche:
- `LPPL-1.3c.txt`;
- `OFL-Nunito.txt`, per il font dell'interfaccia;
- le licenze delle librerie.

**Font dell'interfaccia:** Nunito. Si crea con `tools/crea-nunito.py` partendo da `tools/sorgenti/nunito/`.
