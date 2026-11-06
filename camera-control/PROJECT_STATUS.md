# PROJECT_STATUS – Gimbali (progetto Camera Control)

Ultimo aggiornamento: 2026-11-05 · Versione: 0.9.0 (Regia da voce – prova di riconoscimento, gimbal fermo)

## Novità 0.7.0 (da provare)
- Verticale (demo approvata, REGIA tondo), tasti volume + lettore B nella tendina (pulsanti tondi richiesti: dipendono dal sistema).

## Novità 0.6.0–0.6.1 (da provare)
- Barra di stato; avviso stop inatteso; batteria gimbal. Slider durata: Min … Max.
- Calibrazione di riferimento delle inquadrature: fatta nella 0.6.0 e **rimossa nella 0.6.1** su richiesta (inutile senza un buon Live View).
- Temperatura fotocamera: non disponibile (α6000 non la comunica).

## Prossimi lavori approvati
0. **Bilanciamento / Calibrazione**: realizzato nella 0.8.0; **calibrazione sistema, avanzata e auto-tune verificate dall'utente il 2026-11-06**. Nella 0.8.1 bilanciamento a pagine con disegni. Abbinamento confermato dall'utente: 04:08 `05` = calibrazione sistema, 04:08 `00` = calibrazione avanzata, 04:0f `3f0101` = auto-tune.
1. Tasti volume + lettore B: realizzati nella 0.7.0, da provare. Niente telecomando Bluetooth, niente REC sui tasti.
2. **Regia da voce** (microfono del telefono, sherpa-onnx): fase 1 "prova di riconoscimento" realizzata nella 0.9.0 (sezione separata, gimbal fermo). Regole approvate: silenzio → resta sull'ultima persona; sovrapposizione → resta su chi parlava prima. Prossime fasi: 2) collegare persona → inquadratura e muovere il gimbal; 3) funzionamento a schermo spento. Versione PC con DJI Mic Mini: da valutare in seguito.
- Zoom dal telefono: scartato (lo zoom digitale non interessa; la rotella del gimbal resta lo strumento).

## Decisioni e richieste 2026-11-06
- Obiettivi: 16-50 PZ (Power Zoom) e un tele 50-200 (non Power Zoom). La rotella del gimbal gestisce lo zoom in ogni situazione.
- Approvati come prossimi lavori: **calibrazione di riferimento all'avvio** (opzione B), **barra di stato**, **tasti volume per richiamare le inquadrature anche a schermo spento**.
- Rimandato: sequenze automatiche (ora l'utente registra un podcast).
- Nuova idea da valutare: **inquadratura automatica in base a chi parla** (una inquadratura per voce).

## Ricerca zoom (2026-11-06)
- Via gimbal: la rotella del Ronin-SC comanda lo zoom della camera via cavo Multi (ottico con obiettivi Power Zoom, altrimenti zoom digitale da attivare nella camera; fonte: lista compatibilità DJI, modelli Sony simili). Il comando Bluetooth equivalente NON è noto: l'app DJI non ha un comando zoom, quindi non si può registrare.
- Via Wi-Fi (API Sony, actZoom): possibile solo se la α6000 lo elenca tra le funzioni disponibili e solo con Smart Remote attivo, cioè senza registrare video → utile solo in preparazione.
- In attesa: modello dell'obiettivo dell'utente; elenco funzioni disponibili della α6000 dal registro.

## Novità 0.5.1 (da provare)
- Nome app: **Gimbali** (id interno invariato).
- Icona (variante C con punto REC e punto rosso sotto, approvata dall'utente), schermo intero senza barre di sistema, "App ideata da Stefano Tanca" nelle impostazioni.
- L'utente proverà velocità e funzionalità della 0.5.0 nei prossimi giorni.

## Novità 0.5.0 (da provare sul dispositivo)
- Slider "Durata movimento" (Max … 10 s) al posto di Transizione; movimento a passi (Glide) perché il gimbal ignora la durata del comando 04:14.
- Finestra modifica senza Immediata/Cinematografica; Duplica ed Elimina a icona.

## Decisione in sospeso: calibrazione all'apertura
- A) Calibrazione del gimbal (Auto Tune/bilanciamento): oggi si fa nell'app DJI; per farla dalla nostra app servirebbe una nuova registrazione Bluetooth.
- B) Ricalibrazione del riferimento (consigliata): dopo aver rimontato il treppiede si inquadra un punto noto e l'app corregge tutte le inquadrature salvate.
- In attesa della scelta dell'utente.

## Riscontri dell'utente sulla 0.4.0
- Lo slider Transizione non cambia la velocità: il gimbal sembra ignorare la durata del comando 04:14 (vedi CHANGELOG 0.4.1). In verifica con il test di velocità.
- Mancava un pulsante chiaro per centrare nel joystick → aggiunto.
- Zoom: non presente nell'app DJI; la rotella del gimbal comanda la camera via cavo → non fattibile via Bluetooth per ora.
- Aggiornamento in-app: l'utente segnala che non scarica; in attesa di screenshot del messaggio / stato compilazione.

## Riscontri dell'utente sulla 0.3.2
- REC dalla Regia funziona (il problema era dell'utente).
- Immediata ancora lenta → slider "Transizione" in Regia e Immediata a 0,1 s (0.4.0).
- Richiesti: schermata iniziale con connessioni + Regia, menu ☰ al posto delle schede, joystick con X e chiusura toccando fuori (0.4.0).
- Richiesto slider zoom nel joystick: da chiarire (zoom obiettivo = serve nuovo comando Bluetooth).

## Riscontri dell'utente sulla 0.3.0/0.3.1
- La Regia funziona nel complesso. Problemi segnalati e gestiti nella 0.3.2: REC non funzionante dalla Regia (causa da confermare), Immediata troppo lenta (richiesto < 0,5 s), finestra di modifica troppo grande, riordino col trascinamento, zoom con due dita, joystick più grande.

## Stato attuale
Fase 2 (prototipi di connessione). Gimbal: prototipo **funzionante sul dispositivo reale**. Fotocamera: la 0.2.0/0.2.1 si collega alla α6000 ("funziona", conferma dell'utente). **REC/STOP via Wi-Fi NON funzionano con la α6000** (confermato dall'utente, come previsto dall'analisi iniziale).

## Verificato sul dispositivo reale (fotocamera, 0.2.3)
- Connessione Wi-Fi alla α6000 con pannello Wi-Fi, startRecMode, Live View (~5,5 fotogrammi/s), getEvent.
- **Con Smart Remote Control attivo la α6000 non registra video**: REC dal gimbal rifiutato dalla camera ("non disponibile in questo modo di ripresa"); `setShootMode` assente dalle funzioni disponibili.
- **Senza Smart Remote Control, REC/STOP dal gimbal via cavo funzionano** (conferma dell'utente).

## Decisioni prese
- **Strada A per la regia** (approvata): Live View Wi-Fi solo in preparazione (posizionare e salvare inquadrature con miniatura); durante la ripresa Smart Remote spento, REC dal gimbal e regia con i pulsanti. Scheda HDMI-USB valutata in futuro (l'utente la acquisterà).
- Layout Regia "durante la ripresa" approvato: inquadrature 2×5 al centro, REC/STOP grande, joystick in pannello richiudibile (artboard `RegiaRipresa.dc.html`).
- Salvataggio inquadrature su file JSON locale con esporta/importa (piano approvato con la grafica).
- Firma fissa con chiave creata dall'utente (0.2.4).
- Aggiornamenti: avviso dentro l'app (non Obtainium), repository privata con codice di accesso di sola lettura (scelta dell'utente).
- L'utente preferisce fare personalmente i passaggi su GitHub con guida passo passo.
- Niente pulsanti Foto / Modo foto / Modo video: la modalità si cambia dalla fotocamera (decisione dell'utente). Modifica rispetto al Prompt zero, che prevedeva FOTO.
- REC/STOP solo tramite gimbal e cavo (Wi-Fi non supportato dalla α6000).
- Connessione Wi-Fi alla camera tramite il pannello Wi-Fi di Android (0.2.3). Il collegamento dall'app con WifiNetworkSpecifier (0.2.2) è stato provato e **non funziona sul CMF Phone**: scartato su richiesta dell'utente. Limite accettato: il pannello può aprirsi in verticale.

## Verificato sul dispositivo reale (CMF Phone + Ronin-SC)
- Compilazione su GitHub e installazione dell'APK.
- Connessione Bluetooth al Ronin-SC.
- Ricentra, vai a posizione assoluta, joystick 4 direzioni.
- Lettura angoli pan/tilt/roll (0.1.3, con richiesta di telemetria ogni secondo).
- Passi relativi Pan ±30° / Tilt ±15° ripetibili da qualsiasi posizione (0.1.3).
- Stato registrazione camera letto dal gimbal.
Conferma dell'utente: "funziona tutto" (0.1.3).

## Verificato solo con test automatici
- Protocollo gimbal: 12 test sui pacchetti reali registrati.
- Batteria gimbal (0d:02 reali): 3 test. Calibrazioni (comandi e messaggi reali): 4 test. Regia da voce (impronte e regole): 7 test.
- Percorso del movimento a durata controllata (Glide): 4 test (passi, arrivo esatto, giro più corto oltre ±180°).
- Ultima esecuzione locale dei test puri: 44 superati, 0 falliti (LibraryCodecTest solo su GitHub).
- Protocollo Sony (SSDP, descrizione dispositivo, Live View): 4 test su dati costruiti secondo la documentazione.

## Da verificare
- Fotocamera α6000: elenco funzioni disponibili (da "Copia registro"), stabilità del Live View, getEvent.
- **Live View acceso mentre si registra col REC del gimbal** (decisivo per la regia).
- Connessione col pannello Wi-Fi ripristinata (0.2.3).
- REC/STOP tramite cavo sul gimbal.
- Velocità joystick oltre il 100%.
- Uso contemporaneo di Bluetooth (gimbal) e Wi-Fi (camera).

## Da realizzare
- Live View durante la ripresa con scheda HDMI-USB (quando l'utente l'avrà).

## In sviluppo
- Regia 0.3.0 scritta: scene, 1–10 inquadrature, salvataggio, gestione, richiamo, REC, esporta/importa. Da provare sul dispositivo.
- Libreria inquadrature (salva, modifica, elimina, riordina, duplica) e scene.
- Schermata Regia definitiva secondo la demo grafica.

## Problemi conosciuti
- Fino alla 0.2.3 l'APK aveva una chiave diversa a ogni compilazione; dalla 0.2.4 la chiave è fissa (da verificare: installazione sopra la versione precedente).
- Vibrazione del gimbal segnalata: probabile bilanciamento/taratura (da verificare con l'app DJI).

## Struttura della repository
- Progetto Android nella sottocartella `camera-control/`; workflow in `.github/workflows/build-apk.yml` alla radice, con `working-directory: camera-control`.

## Decisioni in sospeso
- Repository privata (con token) o pubblica, per gli aggiornamenti con Obtainium.
- Live View durante la registrazione (Wi-Fi o scheda HDMI): dipende dall'esito della 0.2.0.

## Da verificare sul dispositivo (0.3.0 / 0.3.1)
- 0.3.0 non si è installata sopra la 0.2.4 installata: probabilmente l'utente aveva l'APK della compilazione senza chiave (stesso nome). Indicato: disinstallare un'ultima volta e installare la 0.3.0.
- Installazione della 0.3.1 SOPRA la 0.3.0 (prova definitiva della firma fissa).
- Aggiornamenti in-app: token, controllo, pulsante giallo, notifica, download, installazione.
- Salvataggio, richiamo, modifica, eliminazione, sposta, duplica, scene; dati presenti dopo chiusura e riapertura.
- Esporta e reimporta la copia di sicurezza.
- Miniatura dal Live View.

## Prossimi passi
0. Provare la 0.5.0: durata 'Max', 2 s e 10 s tra due inquadrature lontane; dire se il movimento è fluido e se il tempo torna.
1. Provare la scheda Fotocamera con la α6000 e inviare lo screenshot del registro.
2. In base all'esito, definire come ottenere REC e Live View insieme.
