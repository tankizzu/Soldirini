# Prova notifiche (D-102)

Piccola app Android **di prova, separata da Soldirini**. Legge solo le notifiche di pagamento dell'app ING Italia e mostra le spese trovate: importo, esercente, data e ora.

- **Nessun permesso.** Niente `INTERNET`: l'app non può mandare dati da nessuna parte. L'accesso alle notifiche lo attiva l'utente in Impostazioni.
- **Solo ING:** pacchetti `it.ing.banking` (app attuale) e `it.ingdirect.app` (vecchia app). Le notifiche delle altre app vengono ignorate subito, senza leggerle.
- **Cosa salva:** importo, esercente, data e ora, pacchetto. Mai il testo della notifica. Un testo diverso dal formato noto, o un esercente oltre 80 caratteri o con un "a capo", diventa "Notifica non riconosciuta", senza contenuto.
- **Solo lettura:** il servizio non cancella, non rimanda e non risponde alle notifiche; nessuna condivisione verso altre app; nessun registro con i dati.
- **Dove:** solo sul telefono, in una cartella esclusa da backup e trasferimenti (`allowBackup=false` e `dataExtractionRules`). Disinstallando l'app si cancella tutto.

## Come si compila
Su GitHub, con il workflow `.github/workflows/android-notifiche.yml` ("App di prova notifiche"). Parte quando cambia questa cartella, oppure a mano da Actions → "App di prova notifiche" → "Run workflow". Passi:
1. prove del lettore (`app/src/test`, solo esempi inventati);
2. APK di debug;
3. controllo dell'APK (`controlla-apk.sh`): nessun permesso, nessun provider o receiver, solo due componenti esportati, `<queries>` con i soli pacchetti ING, `allowBackup` falso, regole dei dati; stampa l'impronta SHA-256 e il certificato di firma;
4. l'APK `prova-notifiche.apk` resta allegato alla run per 7 giorni;
5. solo per un caricamento su `main`, il job "pubblica" mette **lo stesso APK** (stessa impronta SHA-256, controllata) nella pre-release fissa **`prova-notifiche`** (titolo "App di prova notifiche"), sostituendo il file della volta prima (D-108). Nelle note: SHA-256, commit e run. Link diretto, sempre uguale:
   `https://github.com/tankizzu/Soldirini/releases/download/prova-notifiche/prova-notifiche.apk`
   È l'unico job con `contents: write`; usa solo il `GITHUB_TOKEN` della run, nessun altro segreto.

In locale, con Android SDK e JDK 17: `gradle :app:testDebugUnitTest :app:assembleDebug` dentro questa cartella (Gradle 9.6.1 o successivo).

Versioni: Android Gradle Plugin 9.5.0, Gradle 9.6.1, JDK 17, `compileSdk`/`targetSdk` 36, `minSdk` 26 (Android 8). Nessuna libreria: solo le classi di Android (JUnit 4.13.2 solo per le prove, non entra nell'APK).

**Firma:** l'APK di debug è firmato con una chiave creata dal runner a ogni compilazione; nel repository non c'è nessuna chiave. Per installare una compilazione nuova bisogna prima disinstallare la vecchia.

## File
| File | Ruolo |
|---|---|
| `app/src/main/java/…/LettoreNotifica.java` | legge titolo e testo, restituisce importo ed esercente (Java puro) |
| `app/src/main/java/…/Ascoltatore.java` | `NotificationListenerService`: scarta subito ciò che non è ING |
| `app/src/main/java/…/Archivio.java` | le righe in `spese.json` dentro `getNoBackupFilesDir()`, al massimo 500 |
| `app/src/main/java/…/MainActivity.java` | schermata unica |
| `app/src/main/res/` | testi, colori e raggi di Soldirini (chiaro e scuro), icona vettoriale, regole dei dati |
| `app/src/test/java/…/LettoreNotificaTest.java` | prove del lettore |
| `controlla-apk.sh` | controllo dell'APK nel workflow: permessi, componenti, `<queries>`, backup, impronta e firma |

## Guida per l'utente (03, tornata 27: G1-G5)
**Installare**
1. Sul telefono apri questo link (dal browser, per esempio Chrome):
   `https://github.com/tankizzu/Soldirini/releases/download/prova-notifiche/prova-notifiche.apk`
   Scarica direttamente il file `prova-notifiche.apk`. Non serve essere entrati su GitHub. Se il browser avvisa che il file può essere dannoso, tocca **Scarica comunque**.
   - Non usare più gli "Artifacts" della run dal telefono: arrivano chiusi in uno zip e non si installano.
   - Per essere sicuri che è il file giusto: la pagina `https://github.com/tankizzu/Soldirini/releases/tag/prova-notifiche` mostra nelle note l'impronta SHA-256 e il commit.
2. Apri il file dalla notifica del download, oppure dall'app File → Download.
3. Se il telefono dice che non può installare app da questa fonte: **Impostazioni** → **"Consenti da questa fonte"** → torna indietro → **Installa**.
4. **Subito dopo l'installazione** rispegni "Consenti da questa fonte" per l'app che hai usato (browser, File o WhatsApp). Lasciato acceso, quell'app potrebbe installare altre app senza chiedere.
5. Play Protect:
   - se dice che l'app non è conosciuta: **"Altri dettagli" → "Installa comunque"**. Non spegnere Play Protect;
   - se propone "Invia l'app per la scansione", puoi accettare: l'app non contiene dati personali;
   - se dice che l'app è **bloccata**, fermati e dillo al Coordinatore, senza cercare altri modi.

**Dare il permesso**
1. Apri **Prova notifiche** → **"Apri Accesso alle notifiche"** → prova ad attivare "Prova notifiche".
2. Se Android lo blocca ("Impostazione con restrizioni"), la voce per sbloccarlo compare **solo dopo questo primo tentativo**. Vai in Impostazioni → App → Prova notifiche → menu **⋮** in alto a destra → **"Consenti impostazioni con restrizioni"** → conferma con PIN o impronta.
3. Torna al punto 1 e attiva l'accesso: tocca **Consenti**.
4. Nell'app deve comparire "Accesso alle notifiche: **Attivo ✓**". Sotto, "App ING su questo telefono" mostra il nome del pacchetto: comunicalo al Coordinatore.

**Provare e riferire**
- Paga con la carta: la spesa compare nell'elenco.
- Riferisci solo **✓** (importo ed esercente giusti), **✗** (uno sbagliato), **vuoto** (non è comparso niente) e se è comparsa "Notifica non riconosciuta". **Niente screenshot con importi o esercenti** nelle chat (D-089).

**Quando la prova è finita**
1. **Cancella tutto** (le righe sono spese vere).
2. **Disinstalla**: tieni premuta l'icona → Disinstalla, oppure Impostazioni → App → Prova notifiche → Disinstalla.
- Per installare una versione nuova, prima disinstalla la vecchia: ogni compilazione ha una firma diversa.
