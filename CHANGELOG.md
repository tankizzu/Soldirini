# Soldirini – Cronologia delle modifiche

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
