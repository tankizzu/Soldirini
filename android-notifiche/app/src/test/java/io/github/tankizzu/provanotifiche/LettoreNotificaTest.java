package io.github.tankizzu.provanotifiche;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

/** Prove del lettore. Solo esempi inventati: importi ed esercenti finti, mai notifiche vere. */
public class LettoreNotificaTest {
    private static final String T = LettoreNotifica.TITOLO;

    private static String testo(String importo, String esercente) {
        return "Operazione autorizzata: " + importo + " euro, " + esercente + ". Non sei stato tu? Blocca subito la carta.";
    }

    private static void spesa(String importo, long centesimi, String esercente) {
        LettoreNotifica.Spesa s = LettoreNotifica.leggi(T, testo(importo, esercente));
        assertNotNull(importo, s);
        assertEquals(importo, centesimi, s.centesimi);
        assertEquals(esercente, s.esercente);
    }

    @Test
    public void formatoNoto() {
        spesa("5.50", 550, "BAR ESEMPIO");
        spesa("12.00", 1200, "SUPERMERCATO FINTO");
        spesa("0.99", 99, "EDICOLA PROVA");
    }

    @Test
    public void migliaia() {
        spesa("1234.50", 123450, "NEGOZIO ESEMPIO");
        spesa("1,234.50", 123450, "NEGOZIO ESEMPIO");
        spesa("1.234,00", 123400, "NEGOZIO ESEMPIO");
        spesa("12.345,67", 1234567, "NEGOZIO ESEMPIO");
        spesa("5,50", 550, "BAR ESEMPIO");
        spesa("1,23", 123, "BAR ESEMPIO");
        spesa("5", 500, "BAR ESEMPIO");
    }

    @Test
    public void esercenteConPuntiVirgoleEOTroncato() {
        spesa("7.20", 720, "PIZZERIA ESEMPIO S.R.L");
        spesa("3.10", 310, "BAR ESEMPIO, CENTRO");
        spesa("9.90", 990, "FARMACIA DELL'ESEMPI"); // troncato dalla banca: si tiene com'è
    }

    @Test
    public void spaziStrani() {
        LettoreNotifica.Spesa s = LettoreNotifica.leggi("  Pagamento carta di debito ",
                "Operazione autorizzata: 5.50 euro,  BAR ESEMPIO.\nNon sei stato tu? Blocca subito la carta.");
        assertNotNull(s);
        assertEquals(550, s.centesimi);
        assertEquals("BAR ESEMPIO", s.esercente);
    }

    @Test
    public void testoLungoPrimaDelBreve() {
        // il testo breve può essere tagliato ("…"): vale il primo testo che si legge per intero
        LettoreNotifica.Spesa s = LettoreNotifica.leggi(T, testo("5.50", "BAR ESEMPIO"), "Operazione autorizzata: 5.50 euro, BAR ES…");
        assertNotNull(s);
        s = LettoreNotifica.leggi(T, null, testo("5.50", "BAR ESEMPIO"));
        assertNotNull(s);
        assertNull(LettoreNotifica.leggi(T, "Operazione autorizzata: 5.50 euro, BAR ES…"));
        assertNull(LettoreNotifica.leggi(T, (CharSequence) null));
        assertNull(LettoreNotifica.leggi(T));
    }

    @Test
    public void titoloDiverso() {
        assertNull(LettoreNotifica.leggi("Bonifico ricevuto", testo("5.50", "BAR ESEMPIO")));
        assertNull(LettoreNotifica.leggi(null, testo("5.50", "BAR ESEMPIO")));
        assertNull(LettoreNotifica.leggi("pagamento carta di debito", testo("5.50", "BAR ESEMPIO")));
    }

    @Test
    public void testoDiverso() {
        assertNull(LettoreNotifica.leggi(T, "Hai un nuovo messaggio"));
        assertNull(LettoreNotifica.leggi(T, "Operazione autorizzata: 5.50 euro, BAR ESEMPIO."));
        assertNull(LettoreNotifica.leggi(T, "Operazione autorizzata: 5.50 EUR, BAR ESEMPIO. Non sei stato tu? Blocca subito la carta."));
        assertNull(LettoreNotifica.leggi(T, "Operazione autorizzata: 5.50 euro, . Non sei stato tu? Blocca subito la carta."));
        assertNull(LettoreNotifica.leggi(T, "Prefisso Operazione autorizzata: 5.50 euro, BAR ESEMPIO. Non sei stato tu? Blocca subito la carta."));
        assertNull(LettoreNotifica.leggi(T, ""));
    }

    @Test
    public void importiAmbiguiOSbagliati() {
        for (String s : new String[] {"1.234", "5.5", "5.505", "1.23.45", "12,34.56,78", ".50", "0.00", "0", "99999999.99", "1,2345.00"}) {
            assertNull(s, LettoreNotifica.leggi(T, testo(s, "BAR ESEMPIO")));
        }
        assertEquals(-1, LettoreNotifica.centesimi(null));
        assertEquals(99_999_999L, LettoreNotifica.centesimi("999999.99"));
        assertEquals(-1, LettoreNotifica.centesimi("1000000.00"));
    }

    // A4 di 03: un esercente oltre 80 caratteri o con un "a capo" vuol dire che il formato è cambiato → "non riconosciuta"
    @Test
    public void esercenteLunghissimo() {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 30; i++) b.append("ESEMPIO ");
        assertNull(LettoreNotifica.leggi(T, testo("1.00", b.toString().trim())));
        String ottanta = "BAR ESEMPIO " + "X".repeat(LettoreNotifica.MASSIMO_ESERCENTE - 12);
        assertEquals(80, ottanta.length());
        LettoreNotifica.Spesa s = LettoreNotifica.leggi(T, testo("1.00", ottanta));
        assertNotNull(s);
        assertEquals(ottanta, s.esercente);
        assertNull(LettoreNotifica.leggi(T, testo("1.00", ottanta + "X")));
    }

    @Test
    public void esercenteConACapo() {
        assertNull(LettoreNotifica.leggi(T, testo("5.50", "BAR ESEMPIO\nVia Finta 1")));
        assertNull(LettoreNotifica.leggi(T, testo("5.50", "BAR ESEMPIO\r\nALTRO TESTO")));
        // l'"a capo" tra le parti del testo, fuori dall'esercente, va bene
        LettoreNotifica.Spesa s = LettoreNotifica.leggi(T, "Operazione autorizzata: 5.50 euro,\nBAR ESEMPIO.\nNon sei stato tu? Blocca subito la carta.");
        assertNotNull(s);
        assertEquals("BAR ESEMPIO", s.esercente);
    }

    @Test
    public void formattaImporto() {
        assertEquals("5,50 €", LettoreNotifica.formattaImporto(550));
        assertEquals("1.234,00 €", LettoreNotifica.formattaImporto(123400));
        assertEquals("0,07 €", LettoreNotifica.formattaImporto(7));
    }
}
