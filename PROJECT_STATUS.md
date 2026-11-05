# Soldirini – Stato del progetto

_Aggiornato: 5 novembre 2026 · versione 14 (cache `soldirini-14`)_

## Stato attuale
Pronta da condividere: chi entra con il proprio account Google trova l'app vuota (nessun progetto, profilo vuoto, nessun modello precompilato) e i documenti si compilano solo con i suoi dati.

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
- Documento di riferimento per progetto: Word, Documento Google, PDF (v14) oppure Excel/Foglio Google (va nei modelli Excel). Un solo pulsante dal telefono o da Drive, il tipo è riconosciuto dal contenuto.
- Documento Word (.docx): riconoscimento automatico di mese, anno, importi e data; collegamento manuale selezionando il testo; compilazione per uno o più mesi; scarica, invia, salva su Drive (+ PDF tramite conversione Google).
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
- Il selettore di Google Drive (Google Picker) è pensato per il computer: su telefono è scomodo; si consiglia il selettore del telefono.
- Il file Word di riferimento va caricato da ogni utente nel suo progetto (non è incluso nell'app per privacy).
- Documento Word: il PDF passa dalla conversione di Google Docs, verificata solo con Drive simulato; il testo fisso del modello (es. “nel mese di”) resta com'è anche con più mesi.
- Documento PDF: il nuovo valore viene scritto sopra il vecchio, coperto da un riquadro bianco. A vista è pulito, ma il vecchio testo resta nascosto dentro il file (si può ancora copiare). I PDF scansionati (foto) non hanno testo: si collegano solo toccando il punto dove scrivere. Limite 3 MB.
- Documento Word: il file è salvato dentro i dati sincronizzati (~0,4 MB per un documento con font incorporati): con molti modelli conviene spostarli su Drive.
- Lettura delle CU: provata solo su PDF di esempio creati per il test, non su CU reali; i valori vanno sempre controllati.
- Calcolo km (Nominatim/OSRM) e font Pally (Fontshare): non verificati dal vivo dall'ambiente di sviluppo.
- I Fogli Google vengono rigenerati dall'app: le modifiche fatte a mano nel Foglio vengono sovrascritte.
- L'accesso Google dura un'ora: poi serve toccare “Tocca per riconnettere”.
- Promemoria ad app chiusa non garantiti (dipendono dal browser); il file .ics è il metodo affidabile.
- Stima tasse indicativa: niente detrazioni, deduzioni, contributi INPS.
- App Google in modalità “test” (massimo 100 utenti invitati): ogni amico va aggiunto come utente di test.
- Sul sito restano i vecchi file non più usati se non vengono cancellati da GitHub (`tpl/esempio-polisportiva.xlsx`, i `.md` caricati con la v8/v9). `logo-bulldogs.jpg` resta perché lo usa il progetto Bulldogs del proprietario.
- Debito tecnico: le funzioni nuove sono in file che estendono/sostituiscono quelle precedenti (vedi PROJECT_ARCHITECTURE.md). Consigliato un riordino in moduli prima di nuove grandi funzioni.

## Ultima versione funzionante
v14 (5/11/2026). Punto di ripristino: v13 (pacchetto `soldirini-aggiornamento-13`).

## Verifiche fatte su v14
- PDF della ricevuta Explora (ottenuto dal Word dell'utente): 6 dati riconosciuti (mese e anno, importi A/B/C, netto, data), collegamento a tocco della singola parola, compilazione ottobre + novembre 2026 con importi uguali al calcolo dell'app, impaginazione controllata a vista (nessuna sovrapposizione).
- Excel e Foglio Google dallo stesso pulsante vanno nel modello Excel; il selettore Drive permette di scegliere Word, Documenti Google, PDF, Excel e Fogli Google (Drive e Picker simulati: da provare con l'account reale).
- Regressioni (v1→v13, interfaccia, Word, utente nuovo, Drive): nessun errore.

## Verifiche fatte su v13
- Su telefono “Scegli da Google Drive” propone il selettore del telefono (verificato che apra la scelta file e carichi il documento). Selettore Google: vista elenco, tutti i file visibili e solo Word/Excel selezionabili, dimensione adattata allo schermo (Picker simulato: l’aspetto reale su telefono non è verificabile da qui).

## Verifiche fatte su v12
- Caricamento del Word e dell'Excel: file senza estensione, .doc vecchio e PDF (messaggi chiari), Documento Google e Foglio Google scelti da Drive (convertiti), .docx da Drive, scelta annullata. Google Picker e Drive simulati: da verificare con l'account reale.
- Regressioni v1→v12: nessun errore.

## Verifiche fatte su v11
- Riprodotto il problema segnalato: cambiando mese in Documenti la ricevuta Word restava sui mesi scelti prima (es. si scaricava ottobre+novembre stando su dicembre). Corretto e verificato: ottobre, ottobre+novembre e dicembre 2025 danno ciascuno il documento giusto (importi confrontati con il calcolo dell'app).
- Documento caricato e finestra chiusa senza “Salva”: ora resta nel progetto anche dopo la riapertura dell'app.
- Aggiornamento con service worker attivo e cache come GitHub Pages: nuova versione caricata alla prima riapertura.
- Regressioni (v1→v11, interfaccia v8, Word v9, utente nuovo v10): nessun errore.

## Verifiche fatte su v10
- “Nuovo utente”: app vuota all'avvio, progetto creato da zero, ricevuta/nota (Excel e PDF) compilate solo con i dati inseriti; nei file generati nessun dato del proprietario (controllo testuale). Regressioni v8/v9 ripetute: nessun errore.

## Verifiche fatte su v9
- Ricevuta Explora (file dell'utente): 7 dati riconosciuti in automatico, collegamento manuale, compilazione novembre + dicembre 2025, impaginazione controllata convertendo il Word in PDF; salvataggio su Drive simulato. Test di regressione v8 ripetuti: nessun errore.

## Verifiche fatte su v8
- Test automatici nel browser (Chromium) con Google simulato: aggiornamento da v1 senza perdita dati, sincronizzazione, Fogli, PDF, CU, cestino, PIN, promemoria .ics; tocco/doppio tocco/pressione lunga, sottopagine e tasto Indietro, a 390 px e 1280 px, nessun errore.
- Non verificato su telefono reale né con l'account Google reale (da provare dall'utente).

## Prossimi passaggi
1. Caricare la ricevuta in Explora e provarla sul telefono; correggere nel file il codice fiscale (03 → 93?).
2. Decidere le priorità tra busta paga/stipendio e analisi 730.
3. Valutare il riordino del codice in moduli.
