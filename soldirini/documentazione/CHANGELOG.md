# Soldirini – Cronologia delle modifiche

## v14 – 5/11/2026
**Aggiunto**
- Documento di riferimento anche in PDF: riconoscimento automatico dei dati, anteprima con i riquadri, collegamento toccando la parola nel PDF, compilazione per uno o più mesi, scarica/invia/salva su Drive.
- Un solo pulsante per caricare Word, Documento Google, PDF, Excel o Foglio Google (dal telefono o da Drive).

**Bug corretti**
- Da Drive non si potevano scegliere i PDF.
- Word: un punto isolato poteva essere scambiato per un importo.

**File:** `pdfdoc.js` (nuovo), `lib/pdf-lib.min.js` (nuovo, pdf-lib 1.17.1, licenza MIT), `word.js`, `ui.js`, `index.html`, `sw.js`. **Dati:** `docTpl.kind='pdf'` con collegamenti `{pg,x,y,w,h,size,cover,campo,da,lim,dopo,mezzo}`; i progetti esistenti non cambiano.

## v13 – 5/11/2026
**Bug corretti**
- Selettore di Google Drive ingestibile su telefono e cartelle che sembravano vuote (il filtro nascondeva i file). Ora: vista a elenco, tutti i file visibili (si possono scegliere solo Word/Excel), dimensione adattata allo schermo, scheda “Recenti”.

**Modificato**
- Su telefono “Scegli da Google Drive” propone prima il selettore del telefono, che mostra Drive con la sua interfaccia normale.

**File:** `word.js`, `ui.js`, `sw.js`. **Dati:** nessuna modifica.

## v12 – 5/11/2026
**Bug corretti**
- Non si riusciva a caricare il documento Word (o il modello Excel) scelto da Google Drive: il telefono filtrava i file e quelli presi da Drive possono non avere l'estensione. Ora il tipo si riconosce dal contenuto del file.

**Aggiunto**
- Pulsante “Scegli da Google Drive” per il documento Word e per il modello Excel: funziona anche con Documenti e Fogli Google (convertiti in .docx/.xlsx).
- Messaggi chiari per .doc/.xls vecchi e PDF.

**File:** `word.js`, `index.html`, `ui.js`, `sw.js`. **Dati:** nessuna modifica.

## v11 – 5/11/2026
**Bug corretti**
- Ricevuta Word: cambiando mese in Documenti restava la scelta dei mesi precedente, quindi si scaricava il documento di un altro periodo. Ora la scelta riparte dal mese che stai guardando.
- Il documento Word caricato nelle impostazioni di un progetto esistente si salva subito (prima andava perso se si chiudeva senza “Salva progetto”).

**Modificato**
- Download bloccato se il documento non ha dati collegati o se nessun testo collegato si trova più nel file (si sarebbe scaricato il file originale); avviso con conferma se ne manca solo qualcuno.
- In Documenti la ricevuta Word sta subito sotto la scheda del progetto ed è aperta; il PDF delle ore si chiama “Prospetto ore (PDF)”.
- Il service worker chiede sempre al sito se i file sono cambiati (niente miscugli di file vecchi e nuovi).
- Numero di versione visibile in fondo a Impostazioni.

**File:** `word.js`, `plus.js`, `ui.js`, `sw.js`. **Dati:** nessuna modifica.

## v10 – 5/11/2026
**Modificato (app pronta per altri utenti)**
- Tolti i modelli pronti: niente progetto “Bulldogs Rignano” tra le scelte e niente “file di esempio” Excel.
- Nuovo progetto senza valori del proprietario: tariffa oraria, tariffa ACI e orari tipici vuoti (con esempi come suggerimento); descrizione “Altro” vuota.
- Modelli `tpl/ricevuta.xlsx` e `tpl/nota.xlsx` ripuliti: tolti nome, codice fiscale, indirizzo, auto, targa, dati della società, righe d’esempio, logo e autore del file. L’impaginazione è invariata.
- Nel PDF la riga “C.F.” della società compare solo se il codice fiscale è inserito.
- Attività con ore in un progetto senza orari tipici: la riga orario è già pronta da compilare.

**File:** `app.js`, `ui.js`, `index.html`, `docs.js`, `sw.js`, `tpl/ricevuta.xlsx`, `tpl/nota.xlsx`; rimosso `tpl/esempio-polisportiva.xlsx`. **Dati:** nessuna modifica; i progetti già esistenti mantengono i loro valori.

## v9 – 5/11/2026
**Aggiunto**
- Documento di riferimento Word (.docx) nelle impostazioni del progetto: Soldirini riconosce da solo mese, anno, competenze, ritenuta d'acconto, ritenuta INPS, netto e data; altri testi si collegano selezionandoli.
- In Documenti: compilazione per uno o più mesi insieme (periodo, ore e importi sommati), scarica, invia, salva su Drive con PDF.
- Ritenuta INPS a carico (es. 11,68%) calcolata solo sulla parte oltre la soglia annua delle prestazioni occasionali.

**File:** `word.js` (nuovo), `index.html`, `sw.js`. **Dati:** nuova voce facoltativa `progetti[].docTpl`; nessun dato esistente modificato.

## v8 – 4/11/2026
**Modificato**
- Il calendario occupa tutto lo schermo; tolte le sezioni sotto (riepilogo del giorno ed elenco del mese).
- Tocco su un giorno: finestra con il riepilogo del giorno; doppio tocco: nuova attività; pressione lunga: selezione di più giorni (tolto il pulsante “Più giorni”).
- Elenco del mese e ricerca spostati nell'icona lente; “Da confermare” diventa un avviso compatto che apre una finestra.
- Documenti e Tasse tolti dalla barra: sono due pulsanti con icona in Riepilogo e si aprono a tutta pagina (con “‹ Riepilogo” e tasto Indietro del telefono).
- “Progetti” diventa “Impostazioni” con l'ingranaggio; le impostazioni si dividono in Aspetto e Promemoria; le soglie si modificano nella pagina Tasse.
- Su schermi larghi il calendario mostra il nome completo delle attività.

**File:** `index.html`, `ui.js` (nuovo), `sw.js`. **Dati:** nessuna modifica.

## v7 – 2/11/2026
- Font Pally; palette grafite/grigi con un colore spento per sezione; PDF in grafite; colori dei nuovi progetti più tenui.

## v6 – 2/11/2026
- Corretta la larghezza della pagina su telefono (tabelle che allargavano tutto).

## v5 – 2/11/2026
- Tipo di compenso per progetto con percentuale; ritenuta dei compensi sportivi solo oltre 15.000 €; soglie per tipo.
- Resoconto per il commercialista completo (PDF + CSV) ed elenco pagamenti.
- Pagina Tasse: quanto mettere da parte, Certificazioni Uniche (lettura PDF e confronto).
- Cestino 30 giorni, storico modifiche, blocco con PIN/impronta, promemoria (ora, .ics, notifica in background).
- **Dati:** nuove voci `cu`, `storico`, `impost.tasse`; eventi eliminati conservati con `deletedAt`.

## v4 – 2/11/2026
- Anno contato per data di pagamento; impostazione “Di solito mi pagano”; sezioni riducibili; soglie con un solo totale.

## v3 – 31/10/2026
- Data di pagamento; selettore lavoro/pagamento (poi sostituito in v4).

## v2 – 31/10/2026
- Funzioni della demo nella versione vera: ripetute, previste, km con mappa, spese con foto (su Drive), pagato/da incassare, soglie, grafico, PDF per il commercialista, invio, firma, modelli Excel personalizzati, promemoria ACI, ricerca, tema, scorciatoie.

## v1 – 30/10/2026
- Prima versione di Soldirini: accesso Google, progetti, calendario unico, rimborsi km, ore e ritenuta, Fogli Google e PDF, offline, importazione dalla vecchia app Rimborsi.
