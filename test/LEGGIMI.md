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

Le prove con la lettura delle foto dei turni (OCR) non sono qui: sono lente e restano da fare a mano.
