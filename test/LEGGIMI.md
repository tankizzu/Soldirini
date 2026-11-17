# Prove automatiche di Soldirini

Questa cartella **non viene pubblicata** sul sito: il sito pubblica solo la cartella `soldirini/`.

## Cosa provano
| File | Cosa controlla |
|---|---|
| `fumo.spec.js` | l'app si apre, si accede con Google finto, un'attività arriva su Drive |
| `calcoli.spec.js` | i casi di prova T1–T22 del report Fisco (ritenuta, sportivi, IRPEF, stima tasse, INPS, km, festività, stipendio) e i soldi rimanenti |
| `sync.spec.js` | file dati illeggibile (non viene toccato), telefono e tablet insieme, due file dati, Drive che non risponde |
| `coda.spec.js` | un caricamento che fallisce non blocca gli altri e viene ritentato; foto scontrini; copia di sicurezza |
| `vecchie-versioni.spec.js` | i dati salvati dalle versioni 14, 15 e 18 si aprono senza perdere niente |
| `nota-autore.spec.js` | la nota d'autore c'è dove deve e non è nei documenti |
| `csp.spec.js` | (v24csp) politica di sicurezza dei contenuti: posizione e testo del `<meta>`, codice estraneo bloccato, pagine Privacy e Licenze, anti-riquadro, diagnostica, documenti identici alla 23b, uso senza rete, Tesseract |

Google (accesso, Drive, Calendar) è **finto**: vive solo in memoria durante la prova (`helpers/google-finto.js`).
Nessuna richiesta arriva a Google e nessun account reale viene usato. Tutta la rete esterna è bloccata.

## Regola sui dati
**Solo dati inventati.** Mai buste paga, contratti, nomi, codici fiscali, indirizzi o targhe reali in questa cartella.

## Come si avviano
Le prove partono da sole su GitHub a ogni invio sul ramo `main`: se una fallisce il sito non viene aggiornato.
Sul computer (serve Node.js 22):
```
cd test
npm ci
npx playwright install chromium
npx playwright test
```
Per provare un'altra copia del sito: `SOLDIRINI_SITO=/percorso/della/cartella npx playwright test`.

La prova di compatibilità della pensione (`pensione-app.spec.js`) usa anche la v21 pubblicata (commit `0d04c94`): la prende da sola dal repository git (con `git fetch` se il commit non c'è) e la mette in una cartella temporanea. In alternativa si indica una copia con `SOLDIRINI_V21=/percorso/della/cartella/soldirini`. Se non c'è git o la rete, la prova viene saltata e il motivo compare nel risultato.

**Blocchi CSP (dalla v24csp).** Tutte le prove importano `test` da `helpers/prova.js` invece che da `@playwright/test`: se una pagina ha anche un solo blocco della politica di sicurezza, la prova fallisce e mostra cosa è stato bloccato. Le prove che provocano blocchi apposta chiamano `consentiBlocchiCsp()`.

Il confronto dei documenti (`csp.spec.js`) usa la 23b pubblicata (commit `091612a`), presa dal repository git come la v21 (in alternativa `SOLDIRINI_23B=/percorso/della/cartella/soldirini`).

**Tesseract (lettura delle foto) sotto la CSP.** La prova usa i veri file di Tesseract 5.1.1, serviti agli stessi indirizzi di jsDelivr. Per non appesantire il repository non sono inclusi: senza di loro la prova viene saltata. Per scaricarli (circa 25 MB, cartella ignorata da git):
```
mkdir -p test/.tesseract && cd test/.tesseract
for p in tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng@1.0.0; do npm pack $p; done
for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done
```
La lettura delle foto dei turni con foto vere resta da provare a mano.
