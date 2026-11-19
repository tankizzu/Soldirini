package io.github.tankizzu.provanotifiche;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Legge titolo e testo di una notifica di pagamento ING e ne ricava importo ed esercente.
 * Java puro, senza classi di Android: si prova con JUnit sul computer (LettoreNotificaTest).
 *
 * Formato noto (coordinamento/IDEE_IN_SOSPESO.md, D-102):
 *   titolo: "Pagamento carta di debito"
 *   testo:  "Operazione autorizzata: {importo} euro, {ESERCENTE}. Non sei stato tu? Blocca subito la carta."
 * Un testo diverso non viene riconosciuto (null): chi chiama salva solo "notifica non riconosciuta", mai il contenuto.
 */
public final class LettoreNotifica {
    private LettoreNotifica() {}

    public static final String TITOLO = "Pagamento carta di debito";

    // Tra le parti va bene qualsiasi spazio, anche un "a capo"; dentro l'esercente no (A4 di 03).
    private static final Pattern TESTO = Pattern.compile(
            "^Operazione autorizzata:\\s+([0-9][0-9.,]*)\\s+euro,\\s+([^\\n]+?)\\.\\s+Non sei stato tu\\?\\s+Blocca subito la carta\\.?$");

    // Importi accettati. Con due cifre finali dopo il separatore, quel separatore è quello dei decimali;
    // l'altro, se c'è, separa le migliaia a gruppi di tre. Tutto il resto è ambiguo e non viene letto.
    private static final Pattern PUNTO_DECIMALE = Pattern.compile("^(\\d{1,3}(?:,\\d{3})+|\\d+)\\.(\\d{2})$");   // 5.50, 1234.50, 1,234.50
    private static final Pattern VIRGOLA_DECIMALE = Pattern.compile("^(\\d{1,3}(?:\\.\\d{3})+|\\d+),(\\d{2})$"); // 5,50, 1.234,00
    private static final Pattern INTERO = Pattern.compile("^\\d+$");                                              // 5 → 5,00 €

    /** Massimo accettato: 999.999,99 €. Oltre è quasi certamente una lettura sbagliata. */
    static final long MASSIMO_CENTESIMI = 99_999_999L;
    /** Esercente più lungo di così: il formato non è quello noto e la riga è "non riconosciuta" (A4 di 03). */
    static final int MASSIMO_ESERCENTE = 80;

    /** Spesa riconosciuta. */
    public static final class Spesa {
        public final long centesimi;
        public final String esercente;

        Spesa(long centesimi, String esercente) {
            this.centesimi = centesimi;
            this.esercente = esercente;
        }
    }

    /**
     * @param titolo titolo della notifica (può essere null)
     * @param testi  i testi della notifica, nell'ordine in cui provarli (testo lungo, poi testo breve); i null si saltano
     * @return la spesa, oppure null se il formato non è quello noto
     */
    public static Spesa leggi(CharSequence titolo, CharSequence... testi) {
        if (!TITOLO.equals(pulisci(titolo).replace('\n', ' '))) return null;
        if (testi == null) return null;
        for (CharSequence t : testi) {
            Spesa s = leggiTesto(pulisci(t));
            if (s != null) return s;
        }
        return null;
    }

    private static Spesa leggiTesto(String testo) {
        if (testo.isEmpty()) return null;
        Matcher m = TESTO.matcher(testo);
        if (!m.matches()) return null;
        long cent = centesimi(m.group(1));
        if (cent <= 0) return null;
        String esercente = m.group(2).trim();
        if (esercente.isEmpty() || esercente.length() > MASSIMO_ESERCENTE) return null; // niente tagli: se è troppo lungo non si salva
        return new Spesa(cent, esercente);
    }

    /** Importo in centesimi; -1 se il testo non è un importo sicuro. */
    static long centesimi(String s) {
        if (s == null) return -1;
        String interi, decimali;
        Matcher m;
        if ((m = PUNTO_DECIMALE.matcher(s)).matches()) {
            interi = m.group(1).replace(",", "");
            decimali = m.group(2);
        } else if ((m = VIRGOLA_DECIMALE.matcher(s)).matches()) {
            interi = m.group(1).replace(".", "");
            decimali = m.group(2);
        } else if (INTERO.matcher(s).matches()) {
            interi = s;
            decimali = "00";
        } else {
            return -1;
        }
        if (interi.length() > 7) return -1; // evita numeri enormi prima di convertirli
        long cent = Long.parseLong(interi) * 100 + Long.parseLong(decimali);
        return cent > MASSIMO_CENTESIMI ? -1 : cent;
    }

    /** Gli spazi (anche quelli non separabili) diventano uno spazio solo; un gruppo di spazi con un "a capo" diventa un "a capo". null diventa "". */
    static String pulisci(CharSequence s) {
        if (s == null) return "";
        String t = s.toString().replace("\r", "\n").replaceAll("[\\s\\u00A0\\u2007\\u202F&&[^\\n]]+", " ");
        return t.replaceAll(" ?\\n[\\s\\u00A0\\u2007\\u202F]*", "\n").trim();
    }

    /** "1.234,50 €" */
    public static String formattaImporto(long centesimi) {
        NumberFormat f = NumberFormat.getNumberInstance(Locale.ITALY);
        f.setMinimumFractionDigits(2);
        f.setMaximumFractionDigits(2);
        f.setGroupingUsed(true);
        return f.format(BigDecimal.valueOf(centesimi, 2)) + " €";
    }
}
