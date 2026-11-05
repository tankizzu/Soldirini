# Soldirini – Architettura

## Descrizione
App per allenatori e collaboratori: calendario delle attività, rimborsi km, ore e ritenuta d'acconto, documenti (ricevute, note, prospetti) e tasse, con i dati nel Google Drive di ogni utente. Nessun server proprio.

## Tecnologie
| Parte | Tecnologia |
|---|---|
| Interfaccia | HTML, CSS, JavaScript (nessun framework), PWA con service worker |
| Hosting | GitHub Pages, repository `tankizzu.github.io`, cartella `soldirini/` |
| Accesso | Google Identity Services (token OAuth, scope `drive.file`) |
| Dati | `localStorage` sul dispositivo + file JSON su Google Drive |
| Documenti | Drive API v3 (upload con conversione xlsx → Fogli Google), Google Picker |
| Excel | JSZip 3.10.1 (`lib/jszip.min.js`) + motore proprio `xlsx.js` |
| PDF | jsPDF (`lib/jspdf.umd.min.js`) + html2canvas 1.4.1 (`lib/html2canvas.min.js`) |
| Lettura PDF (CU) | pdf.js 3.11.174 legacy (`lib/pdf.min.js`, `lib/pdf.worker.min.js`), caricato solo quando serve |
| Compilazione PDF | pdf-lib 1.17.1 (`lib/pdf-lib.min.js`, MIT), caricato solo quando serve |
| Mappe km | Nominatim + OSRM (OpenStreetMap), servizi pubblici gratuiti |
| Font | Pally (Fontshare, caricato online e messo in cache) + font PDF incorporati in `fonts.css` |

Progetto Google Cloud “Soldirini”: client OAuth web (origine `https://tankizzu.github.io`), chiave API limitata a Picker e al referrer, numero di progetto `1065907133263`. Nessun segreto nel codice: client ID e chiave sono pubblici per natura.

## File (cartella `soldirini/`)
| File | Ruolo |
|---|---|
| `index.html` | Struttura delle schermate, finestre, stili (token colore, temi) |
| `app.js` | Nucleo: dati, calcoli, accesso Google, Drive, sincronizzazione, coda dei Fogli, PDF base, interfaccia base |
| `plus.js` | v2: ricorrenze, spese con foto, pagamenti, soglie, grafico, modelli Excel personalizzati, firma, invio, Excel scaricabili, avvio app |
| `tasse.js` | v5: tipi di compenso, ritenuta sportivi, resoconto commercialista, Tasse, CU, cestino, storico, PIN, promemoria |
| `ui.js` | v8: calendario a schermo pieno, gesti sul giorno, sottopagine Documenti/Tasse |
| `word.js` | v9: documento di riferimento Word: lettura, riconoscimento campi, compilazione multi-mese, salvataggio su Drive/PDF |
| `pdfdoc.js` | v14: documento di riferimento PDF (lettura con pdf.js, riconoscimento, anteprima a tocco, compilazione con pdf-lib) e pulsante unico di caricamento |
| `xlsx.js` | Modifica di file Excel mantenendo l'impaginazione (celle, righe, unioni, più fogli) |
| `modelli.js` | Riempie i modelli: ricevuta, nota km, ritenuta d'acconto |
| `docs.js` | Disegna ricevuta e nota per il PDF (generato dagli strumenti di sviluppo) |
| `fonts.css` | Font per i PDF (Palatino/Calibri/Times sostitutivi) |
| `sw.js` | Cache offline, font, promemoria in background |
| `manifest.json` | Installazione (icone, colori, scorciatoie) |
| `tpl/` | Modelli: `ricevuta.xlsx`, `nota.xlsx`, `ore.xlsx`, `esempio-polisportiva.xlsx` |
| `lib/` | Librerie di terze parti |

**Nota sull'organizzazione:** i file si caricano in ordine (`app.js` → `plus.js` → `tasse.js` → `ui.js` → `word.js` → `pdfdoc.js`) e i successivi estendono o sostituiscono funzioni dei precedenti. Funziona ed è testato, ma rende il codice più difficile da seguire: riordino in moduli consigliato.

## Dati (`DB.data`, sincronizzato su Drive)
- `profilo`: dati personali, auto, firma.
- `progetti{id}`: nome, colore, cartella, `rimborso` (origine, tariffa ACI, luoghi, intestazione, logo), `ore` (tariffa, ritenuta %, fasce, categoria), `pagamento.ritardo`, `modello` (standard/personalizzato + mappatura), `docTpl` (Word: nome, file in base64, collegamenti `{p: paragrafo, da: testo, campo}`, titolo, % INPS; per il PDF `kind:'pdf'` e collegamenti `{pg, x, y, w, h, size, cover, campo, da}`), email.
- `eventi{id}`: data, progetto, tipo, km/luogo, ore/fasce/fisso, spese (foto), `stato` (previsto), `serie`, `deleted/deletedAt`.
- `mesi{progetto|mese}`: spese extra e dati della ricevuta.
- `pagamenti{progetto|mese|o/r}`: pagato e data.
- `files{chiave}`: ID e link di Fogli/PDF su Drive (`doc|progetto|mesi` per i documenti Word).
- `impost`: soglie, tema, promemoria, dati tasse per anno.
- `cu{id}`: Certificazioni Uniche. `storico[]`: ultime 400 modifiche. `root`: cartella Soldirini.

Ogni voce ha `updatedAt`; l'unione tra dispositivi tiene la modifica più recente (le eliminazioni restano come voce `deleted`).

**Solo sul dispositivo (`DB.meta` e altre chiavi):** ID del file dati, coda dei Fogli da aggiornare, account, sezioni aperte/chiuse. `soldirini-tok` (token, 1 ora), `soldirini-lock` (PIN cifrato con SHA-256 + sale, impronta), `rimborsi-pwa-v1` (vecchia app, solo per l'importazione).

## Su Google Drive
`Soldirini/` → `Soldirini - dati (non cancellare).json`, `Ritenuta d'acconto AAAA` (Foglio), CU caricate, PDF prospetti; una cartella per progetto con Ricevute/Nota (o modello personalizzato), PDF e foto scontrini.

## Pubblicazione
Non c'è compilazione: si caricano i file della cartella `soldirini/` nel repository GitHub. A ogni aggiornamento si cambia `VERSIONE` in `sw.js` per far scaricare la nuova versione ai telefoni.
`docs.js` e `fonts.css` sono generati dagli strumenti di sviluppo di Claude: non vanno modificati a mano.
