package io.github.tankizzu.provanotifiche;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Riceve le notifiche del telefono (dopo che l'utente ha attivato "Accesso alle notifiche").
 * Guarda per prima cosa il pacchetto: se non è ING, la notifica viene ignorata subito,
 * senza leggerne titolo o testo, senza salvarla e senza scriverla nei registri.
 */
public class Ascoltatore extends NotificationListenerService {

    /**
     * Pacchetti ING accettati (da confermare sul telefono: la schermata dice quale è installato).
     * it.ing.banking = "ING Italia – Banca Online" (app attuale, 2025); it.ingdirect.app = vecchia app ING Direct.
     */
    static final Set<String> PACCHETTI_ING =
            Collections.unmodifiableSet(new HashSet<>(Arrays.asList("it.ing.banking", "it.ingdirect.app")));

    /** Vero mentre Android tiene collegato il servizio (solo in memoria). */
    static volatile boolean collegato;

    @Override
    public void onListenerDisconnected() {
        collegato = false;
    }

    @Override
    public void onListenerConnected() {
        collegato = true;
        // le notifiche ING già presenti quando si attiva l'accesso (l'impronta evita i doppioni)
        try {
            StatusBarNotification[] attive = getActiveNotifications();
            if (attive != null) for (StatusBarNotification sbn : attive) considera(sbn);
        } catch (RuntimeException e) {
            // il sistema può rifiutare la richiesta subito dopo la connessione: non importa, arriveranno le prossime
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        considera(sbn);
    }

    private void considera(StatusBarNotification sbn) {
        if (sbn == null || !PACCHETTI_ING.contains(sbn.getPackageName())) return; // non ING: niente di niente
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return; // riassunto di un gruppo: non è una notifica a sé
        Bundle x = n.extras;
        CharSequence titolo = x == null ? null : x.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence lungo = x == null ? null : x.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence breve = x == null ? null : x.getCharSequence(Notification.EXTRA_TEXT);
        LettoreNotifica.Spesa s = LettoreNotifica.leggi(titolo, lungo, breve);
        long quando = sbn.getPostTime();
        String impronta = Archivio.impronta(sbn.getPackageName(), sbn.getId(), sbn.getTag(), quando);
        Archivio.Riga r = s != null
                ? new Archivio.Riga(impronta, quando, s.centesimi, s.esercente, sbn.getPackageName())
                : new Archivio.Riga(impronta, quando, -1, null, sbn.getPackageName()); // non riconosciuta: nessun contenuto
        Archivio.aggiungi(this, r);
    }
}
