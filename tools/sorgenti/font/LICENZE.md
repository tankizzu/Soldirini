# Font usati nei documenti di Soldirini

I file `.woff2` di questa cartella vengono incorporati in `soldirini/fonts.css` da `tools/genera-docs.py`.
Servono a riprodurre la nota spese e la ricevuta con caratteri simili a quelli dei modelli originali.

| File | Font | Licenza | Testo della licenza |
|---|---|---|---|
| `cal-r.woff2`, `cal-b.woff2` | Carlito (© 2013 The Carlito Project Authors) | SIL Open Font License 1.1 | `OFL-Carlito.txt` (da https://github.com/googlefonts/carlito) |
| `pal-r.woff2`, `pal-b.woff2`, `pal-i.woff2`, `pal-bi.woff2` | TeX Gyre Pagella (© B. Jackowski, J.M. Nowacki e altri, GUST e-foundry) | GUST Font License | https://www.gust.org.pl/projects/e-foundry/licenses |
| `tim-r.woff2`, `tim-b.woff2` | Liberation Serif (© 2010 Google Corporation, © 2012 Red Hat, Inc.) | SIL Open Font License 1.1 | `LICENSE-Liberation.txt` (da https://github.com/liberationfonts/liberation-fonts) |

Da verificare (segnalato nel report v20): i file sono versioni ridotte (solo i caratteri usati) in formato WOFF2.
Per la licenza OFL una versione modificata non dovrebbe usare il "nome riservato" del font (es. "Carlito").
Nell'app i font sono già rinominati (`XCal`, `XPal`, `XTim`), ma il nome interno dei file è rimasto quello originale.
