# CHANGELOG

## 0.9.0 – 2026-11-06
### Aggiunto
- **Regia da voce (prova, nome provvisorio)**: nuova sezione separata dalla Regia (menu ☰ → "Regia da voce (prova)"). **Il gimbal non si muove**: serve a verificare il riconoscimento.
  - Persone (fino a 8): nome + registrazione della voce (20 s, servono almeno 8 s di voce). Si salva solo l'impronta (512 numeri) in `voices.json`, mai l'audio.
  - Ascolto: indicatore voce/silenzio, barra di somiglianza per persona con la soglia, "Inquadratura: …" decisa con le regole dell'utente (silenzio → resta sull'ultima persona; sovrapposizione → resta su chi parlava prima; cambio dopo ~1 s di voce sicura).
  - "Sicurezza minima" regolabile (20–80%, predefinita 40%).
- Motore **sherpa-onnx v2.0.1** (Apache 2.0) con modelli CAM++ (impronta voce) e Silero VAD, tutto sul telefono senza Internet. Librerie e modelli scaricati dalla compilazione Gradle (`prepareVoice`) con controllo SHA-256; solo arm64-v8a. APK più grande di circa 55 MB.
- Permesso **microfono** (RECORD_AUDIO), chiesto al primo uso.

### File
- Nuovi: `voice/VoicePrint.kt`, `voice/VoiceStore.kt`, `voice/VoiceEngine.kt`, `ui/VoiceRegiaScreen.kt`, `ui/VoiceRegiaViewModel.kt`, `com/k2fsa/sherpa/onnx/{Speaker,SpeakerEmbeddingExtractorConfig,OnlineStream,Vad}.kt` (da sherpa-onnx v2.0.1, non modificati), `assets/licenses/sherpa-onnx-LICENSE.txt`, `test/.../voice/VoicePrintTest.kt`, `THIRD_PARTY_NOTICES.md`.
- Modificati: `app/build.gradle.kts`, `AndroidManifest.xml`, `ui/AppRoot.kt`.

### Verificato
- Test logica (impronte e regole di regia): 7 nuovi, totale 44 superati, 0 falliti.
- Scaricamento + controllo SHA-256 + estrazione provati con Gradle 8.11.1 fuori da Android.
- Modelli provati sul computer con sherpa-onnx 2.0.1 Python: si caricano, impronta da 512 valori anche con 0,3 s di audio (solo suoni di prova, non voci vere).
- NON verificato: parte Android (compilazione su GitHub) e riconoscimento con voci reali.

## 0.8.5 – 2026-11-06
### Modificato
- **Durata movimento a comparsa**: tolto lo slider fisso dalla Regia (e il suo blocco). Piccolo pulsante "Durata 2 s" sotto la casella "Salva posizione": un tocco apre una finestra con lo slider (Min … Max). Disponibile anche dal menu ☰ ("Durata movimento: …"), utile quando la scena è piena e la casella non c'è.
- Joystick: il blocco tenendo premuto resta.

### File
- `ui/RegiaScreen.kt`, `app/build.gradle.kts`

## 0.8.4 – 2026-11-06
### Aggiunto
- **Blocco di sicurezza tenendo premuto** per **Joystick** e **Durata movimento** (sulla scritta, non sul cursore): bloccati diventano piccoli con il lucchetto e lo spazio va ad "⟳ Avanti". Un tocco su un pulsante bloccato mostra solo l'indicazione; tenendo premuto si sblocca. Vibrazione a ogni blocco/sblocco. Il blocco resta per tutta la sessione (anche ruotando il telefono).
- In verticale la Durata bloccata passa nella riga in basso accanto a Joystick; la griglia guadagna spazio.

### Corretto
- Compilazione fallita su GitHub (`RegiaScreen.kt`: `maxHeight` letto dentro una `Column` annidata, fuori dallo scope di `BoxWithConstraints`): valore letto prima in una variabile.
- Workflow: `actions/setup-java@v4` → `@v5` (la v4 è segnalata come deprecata).

### File
- `ui/RegiaScreen.kt`, `app/build.gradle.kts`, `.github/workflows/build-apk.yml` (radice della repository)

## 0.8.3 – 2026-11-06
### Modificato
- **REC bloccato durante la registrazione**: un tocco avvia (con vibrazione); mentre si registra il pulsante si stringe (lucchetto + tempo) e "⟳ Avanti" si allarga. **Per fermare si tiene premuto 2 secondi**: il rosso si riempie dal basso, a fine corsa vibra e ferma; staccando prima non succede nulla. Un tocco veloce mostra "Tieni premuto".
- L'avvio resta con un tocco singolo (scelta: fermare per sbaglio è il rischio grave, avviare no).

### File
- `ui/RegiaScreen.kt`, `app/build.gradle.kts`

## 0.8.2 – 2026-11-06
### Modificato
- Regia: **"⟳ Avanti" spostato tra REC e Joystick**, tre pulsanti della stessa grandezza (in verticale in basso, in orizzontale nella colonna destra sopra la durata). Tolto dalla casella "Salva posizione". REC si adatta all'altezza (icona e scritta su una riga quando il pulsante è basso).
- Pagine di calibrazione (sistema, avanzata, auto-tune): **avviso in alto se il gimbal non è connesso**, con pulsante "Connetti gimbal"; appena connesso l'avviso sparisce e resta "● Gimbal connesso · batteria". Il bilanciamento standard (gimbal spento) non lo mostra.

### File
- `ui/RegiaScreen.kt`, `ui/GimbalSetupScreen.kt`, `app/build.gradle.kts`

## 0.8.1 – 2026-11-06
### Aggiunto
- **Pulsante "⟳ Avanti"** nella Regia: con almeno 2 inquadrature la casella "Salva posizione" si divide in due (sopra Salva posizione, sotto Avanti). Con la scena piena (10/10) "Avanti" compare accanto a Joystick. Un tocco = inquadratura successiva.
- **Bilanciamento standard a pagine con disegni**: 6 pagine (Prima di iniziare, Tilt verticale, Profondità tilt, Roll, Pan, Fatto), pulsanti Indietro/Avanti e scorrimento col dito; nell'ultima pagina "Vai all'Auto-tune →".
- **Freccia ← piccola in alto a sinistra** nelle pagine di calibrazione e nelle schermate di prova (tolto il pulsantone in basso).

### Modificato
- Tasti volume, lettore e "Avanti" ora **a giro continuo** ("effetto Pac-Man"): dopo l'ultima inquadratura si riparte dalla prima e viceversa.

### Verificato dall'utente (0.8.0)
- Calibrazione sistema, calibrazione avanzata e auto-tune funzionano dalla nostra app.

### File
- Nuovo: `ui/BalanceGuide.kt`.
- Modificati: `ui/RegiaScreen.kt`, `ui/RegiaViewModel.kt`, `ui/GimbalSetupScreen.kt`, `ui/AppRoot.kt`, `app/build.gradle.kts`.

## 0.8.0 – 2026-11-06
### Aggiunto
- **"Bilanciamento / Calibrazione"** nella schermata iniziale: un tocco apre il menu con 4 procedure, ognuna con la sua pagina guidata (prima di iniziare, passi, stato):
  1. **Bilanciamento standard**: guida passo passo (tilt verticale, profondità tilt, roll, pan) riassunta dal manuale DJI; nessun comando al gimbal.
  2. **Calibrazione sistema**: comando 04:08 `05`, stato "in corso → terminata" dal gimbal (~10 s).
  3. **Calibrazione avanzata**: comando 04:08 `00`, barra di avanzamento 0–100% (~30 s).
  4. **Auto-tune**: comando 04:0f `3f 01 01`, mostra la rigidità dei motori prima/dopo (~20–30 s).
  - Conferma prima di avviare; avviso se il gimbal non risponde o rifiuta il comando.
- Comandi ricavati dalla registrazione dell'app DJI del 2026-11-06; abbinamento procedura ↔ comando confermato dall'utente. **Mai provati dalla nostra app.**

### File
- Nuovi: `ui/GimbalSetupScreen.kt`, `test/.../ronin/CalibrationProtocolTest.kt`.
- Modificati: `ronin/RoninCommands.kt`, `ronin/RoninTelemetry.kt`, `ronin/RoninConnection.kt`, `ui/AppRoot.kt`, `docs/PROTOCOLLO_RONIN_SC.md`, `app/build.gradle.kts`.

## 0.7.1 – 2026-11-06
### Modificato
- **Lettore nella tendina con layout nostro** al posto del lettore standard di Android (pulsanti troppo piccoli e non spostabili): compatto con numero, nome e due pulsanti tondi da 44 dp; esteso con pulsanti tondi da 72 dp (⏮ grigio, ⏭ blu) e "Disattiva tasti volume". I tasti volume continuano a funzionare come prima (MediaSession con volume remoto).

### File
- Nuovi: `res/layout/notification_player_small.xml`, `res/layout/notification_player_big.xml`, `res/drawable/bg_round_next.xml`, `bg_round_prev.xml`, `bg_badge.xml`.
- Modificati: `remote/VolumeRemoteService.kt`, `app/build.gradle.kts`.

## 0.7.0 – 2026-11-06
### Aggiunto
- **Uso in verticale** (orientamento libero, rispetta il blocco rotazione del telefono):
  - schermata iniziale: schede una sotto l'altra e **pulsante REGIA tondo**; in orizzontale schede e REGIA tondo sulla stessa riga;
  - Regia: inquadrature 2 × 5 (zoom con due dita fino a 1 colonna), slider durata, REC grande + Joystick in basso; joystick come pannello che sale dal basso;
  - finestra inquadratura: titolo e miniatura sopra, campi sotto.
- **Tasti volume e lettore nella tendina** (proposta B): Vol + = inquadratura successiva, Vol − = precedente, anche a schermo spento, solo mentre la Regia è aperta. Lettore con numero dell'inquadratura, nome, "Prossima: …", ● REC, pulsanti ⏮ ⏭ e "Disattiva tasti volume". Interruttore anche nel menu ☰ della Regia. Si ferma alla prima/ultima inquadratura (nessun giro).
- Servizio in primo piano (mediaPlayback) che tiene viva l'app e il Bluetooth a schermo spento.

### File
- Nuovi: `remote/ShotRemote.kt`, `remote/VolumeRemoteService.kt`, `res/drawable/ic_stat_gimbali.xml`, `ic_skip_next.xml`, `ic_skip_previous.xml`, `ic_close.xml`.
- Modificati: `AndroidManifest.xml` (orientamento, permessi FOREGROUND_SERVICE e FOREGROUND_SERVICE_MEDIA_PLAYBACK, servizio), `MainActivity.kt`, `ui/AppRoot.kt`, `ui/RegiaScreen.kt`, `ui/RegiaDialogs.kt`, `ui/RegiaViewModel.kt`, `app/build.gradle.kts`.
- Eliminati: `regia/Calibration.kt`, `ui/CalibrationScreen.kt`, `test/.../regia/CalibrationTest.kt`.

### Da verificare sul telefono
- Tasti volume a schermo spento su Nothing OS (alcuni telefoni li inviano solo con audio in riproduzione).
- Aspetto del lettore: forma e colori dei pulsanti li decide Android/Nothing OS.
- Schermate Gimbal (prova) e Fotocamera non adattate al verticale.

## 0.6.1 – 2026-11-06
### Rimosso
- **Calibrazione di riferimento delle inquadrature** (aggiunta nella 0.6.0): giudicata inutile dall'utente. Tolti schermata, correzione e campo `reference` (eventuali riferimenti già salvati vengono ignorati). `regia/Calibration.kt`, `ui/CalibrationScreen.kt` e `CalibrationTest.kt` restano vuoti: si possono eliminare da GitHub.

### Modificato
- Slider "Durata movimento": "Max" → **"Min"** (tempo minimo, gimbal alla massima velocità); "10 s" → **"Max"**.

### File
- `regia/ShotLibrary.kt`, `regia/LibraryCodec.kt`, `regia/RegiaRepository.kt`, `ui/RegiaViewModel.kt`, `ui/RegiaScreen.kt`, `ui/StatusBar.kt`, `test/.../regia/LibraryCodecTest.kt`, `app/build.gradle.kts` (+ i 3 file svuotati).

## 0.6.0 – 2026-11-06
### Aggiunto
- **Calibrazione per scena** all'ingresso in Regia (una volta per scena a ogni apertura dell'app; anche dal menu "Calibrazione…"):
  - prima volta: si punta un punto fisso e lo si salva come **riferimento** (posizione + miniatura dal Live View);
  - volte successive: si ripunta lo stesso punto (la miniatura appare in trasparenza sul Live View, con mirino al centro) e "Allineato" corregge tutte le inquadrature della differenza;
  - "Salta" / "Più tardi" se il treppiede non è stato toccato; "Nuovo riferimento" per cambiarlo.
  - Le inquadrature salvate o aggiornate mentre una correzione è attiva vengono memorizzate nel sistema del riferimento.
- **Barra di stato** in Regia: REC lampeggiante con tempo di registrazione, batteria del gimbal, stato calibrazione, batteria del telefono, ora.
- **Avviso rosso** se la registrazione si ferma senza aver premuto STOP o se il gimbal si scollega mentre si registra (resta finché non lo si tocca).
- **Batteria del gimbal**: nuovo comando 0d:01 e lettura 0d:02 (decodificati dalla registrazione DJI del 2026-11-04).

### Dati
- `regia.json`: ogni scena può avere `reference` {pan, tilt, thumbVersion}; miniatura in `thumbs/ref-<idScena>.jpg`; inclusa nell'esportazione. I file precedenti si leggono senza modifiche; le versioni precedenti dell'app ignorano il campo nuovo.

### Non fattibile
- Temperatura della fotocamera: la α6000 non la comunica né via Wi-Fi né tramite il cavo del gimbal.

### File
- Nuovi: `regia/Calibration.kt`, `ui/CalibrationScreen.kt`, `ui/StatusBar.kt`, `test/.../regia/CalibrationTest.kt`, `test/.../ronin/BatteryTest.kt`.
- Modificati: `regia/ShotLibrary.kt`, `regia/LibraryCodec.kt`, `regia/RegiaRepository.kt`, `ronin/RoninCommands.kt`, `ronin/RoninTelemetry.kt`, `ronin/RoninConnection.kt`, `ui/RegiaViewModel.kt`, `ui/RegiaScreen.kt`, `test/.../regia/LibraryCodecTest.kt`, `docs/PROTOCOLLO_RONIN_SC.md`, `app/build.gradle.kts`.

## 0.5.2 – 2026-11-06
### Modificato
- Joystick: **tilt (su/giù) a metà velocità** rispetto al pan, che resta il riferimento (riscontro: pan al 100% perfetto, tilt troppo veloce). Costante `RoninCommands.TILT_STICK_SCALE = 0.5`, da affinare dopo la prova. Vale sia nella Regia sia nella schermata Gimbal (prova).

### File
- `ronin/RoninCommands.kt`, `ronin/RoninConnection.kt`, `app/build.gradle.kts`

## 0.5.1 – 2026-11-05
### Aggiunto
- **Icona dell'app**: silhouette del gimbal bianca su fondo scuro, punto REC rosso sulla camera e punto rosso sotto l'impugnatura (forma di punto di domanda). Icona adattiva (si adatta alla forma scelta dal telefono).
- **Schermo intero**: nascoste barra delle notifiche/orologio e barra di navigazione; scorrendo dal bordo riappaiono per un attimo. Il contenuto evita solo il foro della fotocamera frontale.
- Impostazioni aggiornamenti: "© <anno> App ideata da Stefano Tanca".
- **Nuovo nome: Gimbali** (sotto l'icona, nella schermata iniziale, nella notifica). L'identificativo interno `it.cameracontrol.app` e la repository restano uguali, così gli aggiornamenti si installano sopra senza disinstallare.

### File
- Nuovi: `res/drawable/ic_launcher_foreground.xml`, `res/mipmap-anydpi-v26/ic_launcher.xml`, `res/mipmap-anydpi-v26/ic_launcher_round.xml`, `res/values/ic_launcher_background.xml`.
- Modificati: `AndroidManifest.xml`, `MainActivity.kt`, `ui/UpdateUi.kt`, `ui/AppRoot.kt`, `update/UpdateWorker.kt`, `regia/LibraryCodec.kt`, `app/build.gradle.kts`.

### Da verificare
- Che le barre di sistema restino nascoste aprendo le finestre (modifica inquadratura, impostazioni) e dopo il pannello Wi-Fi.

## 0.5.0 – 2026-11-05
### Aggiunto
- **Slider "Durata movimento"** nella Regia (al posto di "Transizione"): Max, 0,5, 1, 1,5, 2, 3, 4, 5, 6, 8, 10 s, uguale per tutte le inquadrature e ricordato alla riapertura dell'app.
- **Movimento a durata controllata dall'app** (`ronin/Glide.kt`): il gimbal ignora la durata del comando "vai a posizione", quindi l'app invia 10 piccoli passi al secondo lungo una curva morbida (partenza e arrivo dolci) per impiegare il tempo scelto. "Max" = un solo comando, il gimbal va alla sua velocità massima (~45–50°/s).

### Modificato
- Finestra **Modifica inquadratura**: tolte Immediata/Cinematografica e la durata; Duplica = quadrato bianco con icona, Elimina = quadrato rosso con secchio, in alto accanto a Salva.
- Sotto il nome di ogni inquadratura ora compaiono PAN e TILT salvati.
- File `regia.json`: non scrive più `mode` e `durationSec` (i file vecchi si leggono lo stesso, i due campi vengono ignorati). Nessuna perdita di inquadrature.

### Rimosso
- Modalità di richiamo per inquadratura (`RecallMode`) e slider Transizione: non avevano effetto sul Ronin-SC.

### Problemi conosciuti
- Movimento a durata controllata **non ancora provato sul gimbal**: da verificare fluidità (possibili piccoli scatti) e precisione del tempo.

### File
- Nuovi: `ronin/Glide.kt`, `test/.../ronin/GlideTest.kt`.
- Modificati: `ronin/RoninConnection.kt`, `regia/ShotLibrary.kt`, `regia/LibraryCodec.kt`, `regia/RegiaRepository.kt`, `ui/RegiaViewModel.kt`, `ui/RegiaScreen.kt`, `ui/RegiaDialogs.kt`, `test/.../regia/ShotLibraryTest.kt`, `test/.../regia/LibraryCodecTest.kt`, `app/build.gradle.kts`.

## 0.4.1 – 2026-11-05
### Aggiunto
- **Test di velocità** nella schermata Gimbal (prova): pan ±90° chiedendo 0,5 s o 5 s; durante il test la posizione è letta 5 volte al secondo e il registro scrive il tempo reale impiegato.
- Pulsante **"Centra 0° · 0°"** nel pannello joystick della Regia (il pulsante al centro del joystick non era riconoscibile).

### Problemi conosciuti (nuovi)
- **Il Ronin-SC sembra ignorare la durata del comando "vai a posizione"**: segnalato dall'utente (lo slider Transizione non cambia nulla) e confermato rileggendo la registrazione DJI: con 2 s richiesti il gimbal si muoveva sempre a ~45–50°/s (180° in ~3,6 s). Di conseguenza anche Immediata/Cinematografica non hanno effetto. Da verificare con il test di velocità; se confermato, slider e modalità vanno tolti o ripensati.
- Zoom: l'app DJI non ha un comando di zoom; la rotella del gimbal agisce sulla camera via cavo. Non realizzabile via Bluetooth per ora.

### File
- `ronin/RoninConnection.kt` (`speedTest`, telemetria veloce temporanea), `ui/GimbalTestScreen.kt`, `ui/RegiaScreen.kt`, `app/build.gradle.kts`

## 0.4.0 – 2026-11-05
### Aggiunto
- **Schermata iniziale** a tutto schermo: "Connetti gimbal", "Connetti fotocamera" (facoltativa, per Live View e miniature) e il grande pulsante **REGIA**.
- **Menu ☰** accanto all'ingranaggio (in tutte le schermate): Schermata iniziale, Regia, Gimbal (prova), Fotocamera e Live View; nella Regia anche Esporta/Importa. Il tasto Indietro del telefono riporta alla schermata iniziale.
- **Slider "Transizione"** nella Regia, sotto il REC: Auto (impostazione di ogni inquadratura) oppure 0,1–10 s uguale per tutte.

### Modificato
- Tolte le schede in alto (Regia / Gimbal / Fotocamera): più spazio per le inquadrature.
- "Immediata" alla massima velocità del gimbal (0,1 s, prima 0,3 s).
- Joystick: tolto "Chiudi"; piccola X in alto a destra e chiusura toccando fuori dal pannello; il pannello parte dall'alto.
- "Connetti fotocamera" condiviso tra schermata iniziale e schermata Fotocamera (`rememberCameraConnector`).

### File
- Nuovo: `ui/AppRoot.kt`. Eliminato: `ui/AppTabs.kt`.
- Modificati: `ui/RegiaScreen.kt`, `ui/RegiaViewModel.kt`, `ui/CameraTestScreen.kt`, `regia/ShotLibrary.kt`, `MainActivity.kt`, `test/.../regia/ShotLibraryTest.kt`, `app/build.gradle.kts`

### Problemi ancora presenti
- Slider dello zoom (disegnato dall'utente nel pannello joystick) non realizzato: per lo zoom dell'obiettivo serve il comando Bluetooth, non presente nella registrazione. In attesa di chiarimento e, se serve, di una nuova registrazione.

## 0.3.2 – 2026-11-05
Richieste dell'utente dopo la prova della 0.3.0/0.3.1.

### Modificato
- **Immediata più veloce**: richiamo in 0,3 s (prima 0,6 s). Per spostamenti ampi il gimbal può impiegare di più: oltre la sua velocità massima non va.
- **Finestra inquadratura compatta** per il telefono in orizzontale: Annulla/Salva in alto, miniatura a sinistra, impostazioni a destra scorrevoli. **Tolti i tasti Sposta.**
- **Riordino trascinando**: pressione lunga su un'inquadratura, la si trascina sulla nuova posizione (la casella di arrivo si illumina in giallo). Modifica solo da "⋯".
- **Zoom con due dita** sulla griglia: allargando le caselle diventano più grandi (5 → 4 → 3 → 2 colonne, la griglia scorre), stringendo tornano più piccole.
- **Joystick a metà schermo**, sopra anche al REC, con cerchio grande, velocità, passi, "Salva posizione" e "Chiudi ✕".
- **REC**: avviso se Smart Remote è attivo (la α6000 non registra) e se dopo 2,5 s il gimbal non conferma la registrazione.

### File
- `regia/ShotLibrary.kt` (`moveShotTo` al posto di `moveShot`; `IMMEDIATE_SECONDS` 0,3)
- `ui/RegiaScreen.kt`, `ui/RegiaDialogs.kt`, `ui/RegiaViewModel.kt` (`reorder`, `showMessage`), `ui/GimbalControls.kt` (joystick ridimensionabile)
- `test/.../regia/ShotLibraryTest.kt`, `app/build.gradle.kts`

### Problemi ancora presenti
- Causa del REC non funzionante nella Regia da confermare con l'utente (ipotesi principale: Smart Remote attivo).

## 0.3.1 – 2026-11-05
### Aggiunto
- **Aggiornamenti dentro l'app**: a ogni compilazione sul ramo principale il workflow pubblica la Release `v<versionCode>` con `camera-control.apk`. L'app controlla all'apertura e ogni 6 ore in sottofondo (WorkManager, solo con Internet); se c'è una versione nuova mostra un pulsante giallo "Aggiorna" in alto e una notifica (pallino sull'icona). Il tocco scarica l'APK e apre l'installazione di Android.
- Impostazioni (ingranaggio in alto a destra): versione installata, codice di accesso GitHub (sola lettura, salvato solo sul telefono), "Controlla ora", "Rimuovi codice".
- 3 test sulle regole delle versioni.

### File
- Nuovi: `update/UpdateTag.kt`, `update/UpdateRepository.kt`, `update/UpdateWorker.kt`, `ui/UpdateViewModel.kt`, `ui/UpdateUi.kt`, `res/xml/update_paths.xml`, `test/.../update/UpdateTagTest.kt`
- Modificati: `ui/AppTabs.kt`, `MainActivity.kt`, `AndroidManifest.xml` (REQUEST_INSTALL_PACKAGES, POST_NOTIFICATIONS, FileProvider), `app/build.gradle.kts` (core-ktx 1.13.1, work-runtime-ktx 2.9.1), `.github/workflows/build-apk.yml` (permesso contents: write, passo di pubblicazione)

### Dati
- Nuovo: SharedPreferences privato "updates" (codice di accesso, ultima versione notificata).

### Problemi ancora presenti
- Mai provata sul dispositivo. Android chiede sempre la conferma "Installa" (non aggirabile per app fuori dal Play Store).

## 0.3.0 – 2026-11-05
### Aggiunto
- **Scheda Regia** (prima scheda), secondo la grafica approvata "Regia – durante la ripresa":
  - inquadrature 2×5 della scena attiva; tocco = il gimbal raggiunge la posizione; "IN ONDA" / "IN MOVIMENTO";
  - "⋯" o pressione lunga = modifica: nome, richiamo Immediato/Cinematografico, durata 1–10 s, usa posizione attuale, nuova miniatura dal Live View, sposta ◀ ▶, duplica, elimina (con conferma);
  - riquadro "Salva posizione" e pulsante nel pannello joystick: nuova inquadratura con angoli attuali e miniatura dal Live View (se acceso);
  - scene: scelta, nuova, rinomina, elimina (con conferma, ne resta sempre una);
  - REC/STOP grande via gimbal con cronometro; pannello joystick richiudibile con velocità e passi Pan ±30° / Tilt ±15°;
  - Esporta / Importa copia di sicurezza (un unico file JSON con miniature).
- Salvataggio locale atomico (`regia.json` + `thumbs/`); un file illeggibile viene messo da parte, non cancellato.
- Live View: un riavvio automatico se la camera interrompe il flusso.
- Test: 7 sulle regole della libreria (eseguiti in locale) + 2 sul formato del file (solo su GitHub, richiedono org.json).

### Modificato
- Joystick e `formatOne` spostati in `ui/GimbalControls.kt`, condivisi tra Regia e scheda Gimbal (nessun cambiamento di comportamento).

### File
- Nuovi: `regia/ShotLibrary.kt`, `regia/LibraryCodec.kt`, `regia/RegiaRepository.kt`, `ui/RegiaViewModel.kt`, `ui/RegiaScreen.kt`, `ui/RegiaDialogs.kt`, `ui/GimbalControls.kt`, `test/.../regia/ShotLibraryTest.kt`, `test/.../regia/LibraryCodecTest.kt`
- Modificati: `ui/GimbalTestScreen.kt`, `ui/AppTabs.kt`, `camera/SonyCamera.kt`, `app/build.gradle.kts`

### Dati
- Nuovo: `files/regia.json` (formato `camera-control-regia` versione 1) e `files/thumbs/<id>.jpg`.

### Problemi ancora presenti
- Mai provata sul dispositivo. Gli angoli sono relativi all'impugnatura: spostando il gimbal le inquadrature si spostano.

## 0.2.4-test – 2026-11-05
### Aggiunto
- **Firma fissa dell'APK**: la chiave (creata dall'utente con il workflow una-tantum `crea-chiave.yml`, poi eliminato) è nei Secrets di GitHub `KEYSTORE_BASE64` e `KEYSTORE_PASSWORD`. Da questa versione gli aggiornamenti si installano sopra la versione precedente, senza disinstallare e senza perdere dati.

### File
- `app/build.gradle.kts` (signingConfig "fixed" letta da variabili d'ambiente; senza variabili resta la firma di debug)
- `.github/workflows/build-apk.yml` alla radice della repository (decodifica della chiave prima della compilazione)

### Problemi ancora presenti
- L'installazione della 0.2.4 richiede un'ultima disinstallazione (cambia la chiave).

## 0.2.3-test – 2026-11-05
### Bug corretti
- Connessione alla fotocamera: la 0.2.2 (WifiNetworkSpecifier, collegamento dall'app) falliva sempre sul CMF Phone (registro: "Rete non collegata" dopo 6–14 s, 3 tentativi). Ripristinato il metodo della 0.2.1, verificato funzionante: "Connetti" apre il pannello Wi-Fi di Android, alla chiusura l'app cerca la fotocamera.

### Mantenuto dalla 0.2.2
- "Copia registro" in entrambe le schede; rimozione di REC/STOP Wi-Fi e "Funzioni".

### Rimosso
- Finestra nome/password, pulsante "Rete Wi-Fi", `camera/CameraWifiStore.kt`, permessi `CHANGE_WIFI_STATE` e `NEARBY_WIFI_DEVICES`.

### File
- Modificati: `camera/SonyCamera.kt`, `ui/CameraTestScreen.kt`, `ui/CameraTestViewModel.kt`, `MainActivity.kt`, `AndroidManifest.xml`, `app/build.gradle.kts`
- Eliminato: `camera/CameraWifiStore.kt`

### Dati
- Non si salva più nome/password del Wi-Fi. Eventuali valori salvati dalla 0.2.2 restano inutilizzati e spariscono disinstallando l'app.

### Problemi ancora presenti
- Il pannello Wi-Fi di Android può aprirsi in verticale (limite di Android, non modificabile dall'app).

## 0.2.2-test – 2026-11-05
### Modificato
- Connessione alla fotocamera senza pannello Wi-Fi di sistema (che si apriva con la rotazione sbagliata): la prima volta si inseriscono nell'app nome e password della rete della α6000; poi "Connetti" chiede solo una conferma ad Android. La rete è usata solo dall'app: il resto del telefono resta sui dati mobili.
- Nuovo pulsante "Rete Wi-Fi" per modificare nome e password salvati.
- Pulsante **"Copia registro"** in entrambe le schede (copia il testo negli appunti, dal più vecchio al più recente).
- Permesso "Dispositivi nelle vicinanze" esteso al Wi-Fi diretto (Android 13+).

### Rimosso (richiesta dell'utente)
- REC/STOP via Wi-Fi: non funzionano con la α6000 (confermato dall'utente); il REC si comanda dal gimbal col cavo.
- Pulsante "Funzioni" (diagnostico): l'elenco viene comunque scritto nel registro alla connessione.

### File
- Nuovi: `camera/CameraWifiStore.kt`, `ui/LogPanel.kt`
- Modificati: `camera/SonyCamera.kt`, `ui/CameraTestScreen.kt`, `ui/CameraTestViewModel.kt`, `ui/GimbalTestScreen.kt`, `MainActivity.kt`, `AndroidManifest.xml`, `app/build.gradle.kts`

### Dati
- Nuovo salvataggio locale: nome e password della rete della fotocamera (SharedPreferences privato dell'app, "camera_wifi").

### Problemi ancora presenti
- Da verificare: comparsa e orientamento della richiesta di conferma Wi-Fi; Live View durante il REC dal gimbal.

## 0.2.1-test – 2026-11-05
### Modificato
- "Connetti" (scheda Fotocamera) apre il pannello Wi-Fi di sistema con l'elenco delle reti; alla chiusura l'app cerca la fotocamera da sola. Se il pannello non esiste apre le impostazioni Wi-Fi.
- Attesa della rete Wi-Fi portata da 10 a 15 secondi.

### Rimosso (richiesta dell'utente)
- Pulsanti "Modo foto", "Modo video", "Foto" e relative funzioni: sulla α6000 il passaggio foto/video si fa dalla fotocamera.

### File
- `camera/SonyCamera.kt`, `ui/CameraTestScreen.kt`, `app/build.gradle.kts`

### Problemi ancora presenti
- Da raccogliere l'elenco "Funzioni disponibili" della α6000 e l'esito di REC/STOP via Wi-Fi.

## 0.2.0-test – 2026-11-05
### Aggiunto
- Scheda **Fotocamera** (prova Sony α6000 via Wi-Fi): ricerca automatica (SSDP) con indirizzo di riserva 192.168.122.1:8080, elenco delle funzioni disponibili, attivazione startRecMode, Live View con griglia dei terzi (solo a schermo), foto, modo foto/video, REC/STOP via Wi-Fi, lettura stato con getEvent (stato, modalità, diaframma, tempo, ISO, esposizione, bilanciamento, batteria se disponibili), registro eventi.
- Schede in alto per passare tra Gimbal e Fotocamera; le due connessioni restano attive.
- 4 test sulle parti pure del protocollo Sony.

### Modificato
- `GimbalTestScreen`: margini di sistema spostati nel contenitore delle schede.
- Manifest: permessi di rete locale; traffico http non cifrato consentito (la Sony non supporta https).

### File
- Nuovi: `camera/SonyProtocol.kt`, `camera/LiveviewParser.kt`, `camera/SonyCamera.kt`, `ui/CameraTestViewModel.kt`, `ui/CameraTestScreen.kt`, `ui/AppTabs.kt`, `test/.../camera/SonyProtocolTest.kt`
- Modificati: `MainActivity.kt`, `ui/GimbalTestScreen.kt`, `AndroidManifest.xml`, `app/build.gradle.kts`

### Problemi ancora presenti
- Mai provata con la α6000 reale. Da scoprire quali funzioni la camera espone (registro "Funzioni disponibili").

## 0.1.3-test – 2026-11-05
### Bug corretti
- **Pan, tilt e roll non venivano mai letti** (sullo schermo restava "—"), quindi i passi Pan ±30° / Tilt ±15° non partivano ("Posizione attuale non ancora letta"). Causa: il gimbal invia gli angoli solo se riceve ogni secondo una richiesta di telemetria (04:12 verso 0xE5), che l'app DJI invia e la nostra no. Ora l'app invia ogni secondo la stessa richiesta e lo stesso segnale di presenza (00:0e) dell'app DJI.

### File
- `app/src/main/java/it/cameracontrol/app/ronin/RoninCommands.kt` (`telemetryRequest`, `heartbeat`)
- `app/src/main/java/it/cameracontrol/app/ronin/RoninConnection.kt` (invio automatico ogni secondo)
- `app/src/test/java/it/cameracontrol/app/ronin/DumlTest.kt` (nuovo test)
- `app/build.gradle.kts` (versione)
- `docs/PROTOCOLLO_RONIN_SC.md`

### Problemi ancora presenti
- Vibrazione del gimbal segnalata dall'utente: probabile bilanciamento/taratura motori, da verificare con l'app DJI.

## 0.1.2-test – 2026-11-05
### Modificato
- I pulsanti Pan ±30° e Tilt ±15° ora sono **passi dalla posizione attuale** (prima erano posizioni assolute, e l'asse non toccato tornava a 0°). Richiesta dell'utente: combinare joystick e pulsanti.
- Più passi di fila si sommano: l'app usa l'ultima destinazione inviata finché il movimento non è finito (durata + 1,5 s), perché il gimbal comunica la posizione circa 1 volta al secondo.
- Il joystick azzera questa memoria: dopo averlo usato, la base torna a essere la posizione letta.
- Il pulsante "Pan 0° · Tilt 0°" diventa "Vai a 0° · 0°" (resta assoluto).

### File
- `app/src/main/java/it/cameracontrol/app/ronin/RoninCommands.kt` (nuova funzione `relativeTarget`)
- `app/src/main/java/it/cameracontrol/app/ronin/RoninConnection.kt` (nuova funzione `moveBy`)
- `app/src/main/java/it/cameracontrol/app/ui/GimbalTestScreen.kt`
- `app/src/test/java/it/cameracontrol/app/ronin/DumlTest.kt` (2 nuovi test)
- `app/build.gradle.kts` (versione)

### Problemi ancora presenti
- Passando da +180° a −180° il gimbal potrebbe fare il giro lungo: da verificare.

## 0.1.1-test – 2026-11-05
### Modificato
- Joystick: velocità massima estesa in modo sperimentale fino al 165% dell'app DJI (escursione ±660 invece di ±398). Oltre il 100% l'etichetta diventa arancione.
- Workflow di compilazione spostato nella cartella principale della repository, con progetto nella sottocartella `camera-control/`.

### File
- `app/src/main/java/it/cameracontrol/app/ronin/RoninCommands.kt`
- `app/src/main/java/it/cameracontrol/app/ui/GimbalTestScreen.kt`
- `app/src/test/java/it/cameracontrol/app/ronin/DumlTest.kt` (nuovo test sul limite)
- `app/build.gradle.kts` (versione)

### Problemi ancora presenti
- Da verificare se il gimbal accetta valori oltre ±398.

## 0.1.0-test – 2026-11-05
Prima versione: app di test del gimbal Ronin-SC.

### Aggiunto
- Connessione Bluetooth al Ronin-SC (ricerca, connessione, disconnessione).
- Comandi: ricentra, vai a posizione (pan/tilt, durata regolabile), joystick a 4 direzioni con velocità, REC/STOP tramite cavo.
- Lettura in tempo reale di pan, tilt, roll e stato di registrazione.
- Registro eventi a schermo.
- Compilazione automatica dell'APK su GitHub.
- Test automatici del protocollo sui pacchetti reali.

### File
Tutti nuovi.

### Problemi ancora presenti
- Non ancora provata sul gimbal reale.
