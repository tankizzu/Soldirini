# Soldirini – Stato del progetto

_Aggiornato: 5 novembre 2026 · versione 9 (cache `soldirini-9`)_

## Stato attuale
Web app installabile (PWA) su GitHub Pages: https://tankizzu.github.io/soldirini/
Accesso con Google, dati e documenti nel Google Drive dell'utente. Funziona anche offline e sincronizza quando torna la rete.

## Funzionalità completate
- Accesso Google (permesso minimo `drive.file`), cartella Soldirini scelta dall'utente, sincronizzazione con file JSON su Drive.
- Progetti (squadre/lavori) con cartella su Drive, colore, rimborso km e/o ore.
- Calendario a schermo pieno: tocco = riepilogo del giorno, doppio tocco = nuova attività, pressione lunga = selezione di più giorni. Ricerca ed elenco del mese dall'icona lente.
- Attività ripetute settimanali, attività “previste” e conferma con un tocco.
- Rimborso km: ricevuta a piè di lista + nota km (Fogli Google e PDF), calcolo km con OpenStreetMap, spese con foto degli scontrini.
- Ore e ritenuta: fasce orarie, compenso fisso, tipo di compenso (occasionale 20% modificabile, sportivo esente fino a 15.000 €, altro con % libera).
- Modelli Excel personalizzati della società (mappatura delle celle).
- Documento di riferimento Word (.docx) per progetto: riconoscimento automatico di mese, anno, importi e data; collegamento manuale selezionando il testo; compilazione per uno o più mesi; scarica, invia, salva su Drive (+ PDF tramite conversione Google).
- Riepilogo mese/anno per data di pagamento, pagato/da incassare con data, soglie per tipo di compenso, grafico, elenco pagamenti.
- Documenti e Tasse come sottopagine di Riepilogo (tasto Indietro del telefono supportato).
- Tasse: stima di quanto mettere da parte (IRPEF 2026 23/33/43 %), Certificazioni Uniche (lettura PDF + confronto).
- Resoconto per il commercialista (PDF completo + CSV).
- Impostazioni (ingranaggio): progetti, account, dati personali, firma, Aspetto, Promemoria, blocco PIN/impronta, cestino 30 giorni, storico modifiche, backup.
- Firma sulle ricevute, invio PDF (condivisione o email).
- Font Pally, palette scura con un colore spento per sezione, tema chiaro/scuro.

## In sviluppo
- Nessuna funzionalità in corso.

## Da realizzare (richieste dell'utente)
- Analisi della busta paga e sezione stipendio, risparmi e tasse.
- Analisi per il modello 730, per arrivare preparati ogni anno.

## Idee proposte, non ancora approvate
- Autocertificazione dei compensi sportivi già percepiti.
- Attività preferite con un tocco.
- APK (TWA) con widget e notifiche a orario.

## Problemi conosciuti / limiti
- Documento Word: il PDF passa dalla conversione di Google Docs, verificata solo con Drive simulato; il testo fisso del modello (es. “nel mese di”) resta com'è anche con più mesi.
- Documento Word: il file è salvato dentro i dati sincronizzati (~0,4 MB per un documento con font incorporati): con molti modelli conviene spostarli su Drive.
- Lettura delle CU: provata solo su PDF di esempio creati per il test, non su CU reali; i valori vanno sempre controllati.
- Calcolo km (Nominatim/OSRM) e font Pally (Fontshare): non verificati dal vivo dall'ambiente di sviluppo.
- I Fogli Google vengono rigenerati dall'app: le modifiche fatte a mano nel Foglio vengono sovrascritte.
- L'accesso Google dura un'ora: poi serve toccare “Tocca per riconnettere”.
- Promemoria ad app chiusa non garantiti (dipendono dal browser); il file .ics è il metodo affidabile.
- Stima tasse indicativa: niente detrazioni, deduzioni, contributi INPS.
- App Google in modalità “test” (massimo 100 utenti invitati).
- Debito tecnico: le funzioni nuove sono in file che estendono/sostituiscono quelle precedenti (vedi PROJECT_ARCHITECTURE.md). Consigliato un riordino in moduli prima di nuove grandi funzioni.

## Ultima versione funzionante
v9 (5/11/2026). Punto di ripristino: v8 (pacchetto `soldirini-aggiornamento-8`).

## Verifiche fatte su v9
- Ricevuta Explora (file dell'utente): 7 dati riconosciuti in automatico, collegamento manuale, compilazione novembre + dicembre 2025, impaginazione controllata convertendo il Word in PDF; salvataggio su Drive simulato. Test di regressione v8 ripetuti: nessun errore.

## Verifiche fatte su v8
- Test automatici nel browser (Chromium) con Google simulato: aggiornamento da v1 senza perdita dati, sincronizzazione, Fogli, PDF, CU, cestino, PIN, promemoria .ics; tocco/doppio tocco/pressione lunga, sottopagine e tasto Indietro, a 390 px e 1280 px, nessun errore.
- Non verificato su telefono reale né con l'account Google reale (da provare dall'utente).

## Prossimi passaggi
1. Caricare la ricevuta in Explora e provarla sul telefono; correggere nel file il codice fiscale (03 → 93?).
2. Decidere le priorità tra busta paga/stipendio e analisi 730.
3. Valutare il riordino del codice in moduli.
