// 24c.15: turni da foto su tabelle stile Excel larghe (D-170) e "Nuova attività" con le attività già segnate (D-171).
// Immagini inventate dal generatore tools/turni-finti.py (forma di consegne/00-formato-turni-excel-larga.md); nessuna foto vera.
// Solo dati inventati (D-089).
const fs = require('fs'), path = require('path');
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');
const { serviTesseract, mancanti } = require('./helpers/tesseract');
const { lavoroATurni, leggiFoto, DATI } = require('./helpers/foto-turni');
const attesi = f => JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8'));

async function conLettore(browser, sigle) {
  const { ctx, page } = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-12-20T10:00:00+01:00' });
  await serviTesseract(ctx);
  await page.waitForFunction(() => window.FotoTurni && window.Stip15 && Archivio.avviata);
  await lavoroATurni(page, sigle);
  return page;
}
// confronta la proposta con i turni stampati dal generatore: nessun turno sbagliato, al massimo un "⚠ da controllare"
function confronta(nome, letto, atteso, giorni = 31) {
  const sbagliati = [], dubbi = [];
  for (let d = 1; d <= giorni; d++) {
    const a = atteso[d] || '', l = letto.giorni[d] || '';
    if (letto.dubbi.includes(d)) { dubbi.push(d); if (l) sbagliati.push(`${d}: ⚠ con una scelta già fatta`); continue; }
    if (a !== l) sbagliati.push(`${d}: atteso ${a || 'vuoto'}, letto ${l || 'vuoto'}`);
  }
  expect(sbagliati, `${nome}: turni sbagliati`).toEqual([]);
  expect(dubbi.length, `${nome}: giorni da controllare ${dubbi.join(',')}`).toBeLessThanOrEqual(1);
}

test.describe('D-170 · turni da foto, tabella stile Excel larga', () => {
  test.describe.configure({ timeout: 600000 });
  test.beforeEach(() => { const m = mancanti(); test.skip(m.length > 0, 'pacchetti di Tesseract non scaricati (vedi test/LEGGIMI.md): ' + m.join(', ')); });

  test('immagine pulita: le 6 righe uguali al generatore (nomi di 2 e 3 parole, MP, celle grigie, colonna del ruolo)', async ({ browser }) => {
    const page = await conLettore(browser), A = attesi('turni-larga.json');
    for (const nome of Object.keys(A)) {
      const r = await leggiFoto(page, path.join(DATI, 'turni-larga.jpg'), nome);
      expect(r.errore, nome).toBeUndefined();
      expect(r.riga).toContain('Riga trovata: ');
      expect(r.riga).toContain('tutto il mese');
      confronta(nome, r, A[nome]);
    }
  });

  test('immagine sporca (numeri e nomi sottili, JPEG 60, sfocata): giorni trovati, la riga si sceglie dall\'immagine', async ({ browser }) => {
    const page = await conLettore(browser), A = attesi('turni-larga.json'), nomi = Object.keys(A);
    for (const [i, nome] of nomi.entries()) {
      const r = await leggiFoto(page, path.join(DATI, 'turni-larga-sporca.jpg'), nome, '2026-12', { riga: i });
      expect(r.errore, nome).toBeUndefined();
      expect(r.riga).toContain('Riga scelta');
      expect(r.riga).toContain('tutto il mese');
      confronta(nome, r, A[nome]);
    }
  });

  test('nome illeggibile: elenco delle righe con il pezzo d\'immagine, niente testo inventato da scegliere', async ({ browser }) => {
    const page = await conLettore(browser);
    await page.evaluate(() => FotoTurni.apriFoto(null, '2026-12'));
    await page.locator('#ftNome').fill('ROSSI ANNA');
    await page.setInputFiles('#ftFile', path.join(DATI, 'turni-larga-sporca.jpg'));
    await expect(page.locator('#ft3')).toBeVisible({ timeout: 300000 });
    await expect(page.locator('#ftErr')).toHaveText('Non trovo «ROSSI ANNA» nella tabella.');
    await expect(page.locator('#ftNomiTit')).toHaveText('Righe della tabella: tocca la tua');
    const righe = page.locator('.ftriga');
    expect(await righe.count()).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < await righe.count(); i++) {
      await expect(righe.nth(i).locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/);
      expect((await righe.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  });

  test('ultima colonna tagliata dal bordo: il 31 si legge ancora', async ({ browser }) => {
    const page = await conLettore(browser), A = attesi('turni-larga.json');
    for (const nome of ['VERDI CHIARA', 'GIALLI SARA', 'BRUNI MARIA TERESA']) {
      const r = await leggiFoto(page, path.join(DATI, 'turni-larga-tagliata.jpg'), nome);
      expect(r.riga).toContain('tutto il mese');
      confronta(nome, r, A[nome]);
      expect(r.giorni[31], nome).toBe(A[nome]['31']);
    }
  });

  test('tabella "classica" (scritte grandi, celle colorate, sigla bianca su fondo scuro): letta come prima, anzi meglio', async ({ browser }) => {
    const page = await conLettore(browser), A = attesi('turni-classica.json');
    for (const nome of Object.keys(A)) {
      const r = await leggiFoto(page, path.join(DATI, 'turni-classica.jpg'), nome);
      expect(r.errore, nome).toBeUndefined();
      expect(r.riga).toContain('dal 1 al 14');
      confronta(nome, r, A[nome], 14);
    }
  });

  test('caso L2 di 04: lavoro con il solo turno M → le celle "MP" sono da controllare, mai un "M" da solo', async ({ browser }) => {
    const page = await conLettore(browser, ['M', 'R', 'F', 'Pe', 'Ma']), A = attesi('turni-larga.json');
    const nome = 'ROSSI ANNA', r = await leggiFoto(page, path.join(DATI, 'turni-larga.jpg'), nome);
    for (let d = 1; d <= 31; d++) {
      const a = A[nome][d] || '';
      if (a === 'MP') { expect(r.dubbi, 'giorno ' + d).toContain(d); expect(r.giorni[d] || '', 'giorno ' + d).toBe(''); }
      if (a === 'M') expect(r.giorni[d], 'giorno ' + d).toBe('M');
      if (a === 'P' || a === '') expect(r.giorni[d] || '', 'giorno ' + d).toBe('');
    }
  });
});

test.describe('D-170 · lettura delle sigle (senza Tesseract)', () => {
  test('codiceTurno: "MP" con il solo M non si accorcia; un segno sottile del bordo sì', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await page.waitForFunction(() => window.FotoTurni);
    const r = await page.evaluate(() => {
      const soloM = [{ sigla: 'M', nome: 'Mattina' }], mp = [{ sigla: 'M', nome: 'Mattina' }, { sigla: 'P', nome: 'Pomeriggio' }];
      return [FotoTurni.codiceTurno('MP', soloM), FotoTurni.codiceTurno('MP', mp), FotoTurni.codiceTurno('MPI', mp), FotoTurni.codiceTurno('IM', soloM), FotoTurni.codiceTurno('MN', soloM)];
    });
    expect(r).toEqual([[], ['M', 'P'], ['M', 'P'], ['M'], []]);
  });
  test('leggiTabella: nome in due righe ("Maria") o somiglianza debole → si sceglie la riga; riga scelta per posizione', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await page.waitForFunction(() => window.FotoTurni);
    const r = await page.evaluate(() => {
      const P = [], parola = (t, x, y) => P.push({ t, x0: x, y0: y, x1: x + 10 * t.length, y1: y + 12 });
      for (let d = 1; d <= 10; d++) parola(String(d), 200 + d * 40, 10);
      let x = 0; ['BIANCHI', 'MARIA', 'LUISA'].forEach(w => { parola(w, x, 40); x += 10 * w.length + 8; });
      x = 0; ['BRUNI', 'MARIA', 'TERESA'].forEach(w => { parola(w, x, 70); x += 10 * w.length + 8; });
      parola('ABC', 196, 40); parola('ABC', 196, 70); parola('M', 240, 40); parola('P', 280, 70);
      const a = FotoTurni.leggiTabella(P, 'Maria', 31), b = FotoTurni.leggiTabella(P, 'Bruni Maria', 31), c = FotoTurni.leggiTabella(P, 'Maria', 31, 76), e = FotoTurni.leggiTabella(P, 'Gialli Sara', 31);
      return { a: [a.errore, a.righe.map(x => x.testo)], b: [b.errore, b.rigaTrovata], c: [c.errore, c.rigaTrovata], e: e.errore };
    });
    expect(r.a).toEqual(['nome', ['BIANCHI MARIA LUISA ABC', 'BRUNI MARIA TERESA ABC']]);
    expect(r.b).toEqual([undefined, 'BRUNI MARIA TERESA']);
    expect(r.c).toEqual([undefined, 'BRUNI MARIA TERESA']);
    expect(r.e).toBe('nome');
  });
  test('decidiCelle: celle uguali prendono la sigla letta più spesso; un gruppo che non è d\'accordo resta da controllare', async ({ browser }) => {
    const { page } = await nuovoDispositivo(browser, { drive: new DriveFinto() });
    await page.waitForFunction(() => window.FotoTurni);
    const r = await page.evaluate(() => {
      // forme finte 32×16: "A" = metà sinistra scura, "B" = metà destra scura
      const forma = (lato, ar) => ({ v: Float32Array.from({ length: 512 }, (_, i) => ((i % 32 < 16) === (lato === 'A') ? 0 : 1)), ar });
      const forme = { 1: forma('A', 1), 2: forma('A', 1), 3: forma('A', 1), 4: forma('B', 1), 5: forma('B', 1), 6: forma('A', 2) };
      const letture = { 1: ['M', 'M'], 2: [], 3: ['M'], 4: ['P'], 5: ['M'], 6: ['M'] };
      return FotoTurni.decidiCelle(letture, forme);
    });
    expect(r.letti).toEqual({ 1: ['M'], 2: ['M'], 3: ['M'] });   // la 2 non letta prende la M del suo gruppo
    expect(r.incerti).toEqual([4, 5, 6]);                       // 4-5: P e M in parità; 6: una lettera sola ma larga il doppio
  });
});

// ================= D-171 · "Nuova attività": prima ciò che c'è già nel giorno =================
async function telefono(browser) {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora: '2026-11-20T10:00:00+01:00', telefono: true });
  await d.page.waitForFunction(() => window.Stip15 && window.EntrateExtra && window.Att16 && Archivio.avviata);
  await d.page.evaluate(() => { DB.meta.skipWelcome = true; changed(); render(); });
  return d;
}
// lavoro a turni "Reparto Esempio" con un turno M il 09/11 e una spesa "Colazione" 4,50 € (dati inventati)
const giornoBase = page => page.evaluate(() => {
  const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto Esempio'; l.dal = '2026-01-01'; D().lavori = { [l.id]: l };
  const m = l.tipi.find(t => t.sigla === 'M'), tid = 't1';
  D().turni = { [tid]: { id: tid, lid: l.id, data: '2026-11-09', tipo: m.id, da: '', a: '', pausa: '', ore: '', nota: '', updatedAt: 1 } };
  D().spesePers = { s1: { id: 's1', data: '2026-11-09', cat: 'bar', importo: 4.5, nota: 'Colazione', created: 1, updatedAt: 1 } };
  changed(); render(); return l.id;
});
const righe = page => page.locator('#evGia .rg');

test.describe('D-171 · Nuova attività con le attività già segnate', () => {
  test('giorno con un turno e una spesa: elenco con tutti e due, "Modifica" apre la voce giusta', async ({ browser }) => {
    const { page } = await telefono(browser); await giornoBase(page);
    await page.evaluate(() => openEv(['2026-11-09']));
    await expect(page.locator('#evGia')).toBeVisible();
    await expect(page.locator('#evGiaT')).toHaveText('Già segnato in questo giorno');
    await expect(page.locator('#evGia .hd span')).toHaveText('2 voci');
    await expect(page.locator('#evAggiungi')).toBeVisible();
    await expect(righe(page)).toHaveCount(2);
    // ordine di 02: turni e assenze, poi le spese
    await expect(righe(page).nth(0).locator('b')).toHaveText('Mattina');
    await expect(righe(page).nth(0).locator('small')).toHaveText('06:00–14:00 · 8 ore');
    await expect(righe(page).nth(1).locator('b')).toHaveText('Colazione');
    await expect(righe(page).nth(1).locator('small')).toHaveText('−4,50 € · Bar e ristoranti');
    await expect(righe(page).nth(0).getByRole('button')).toHaveAttribute('aria-label', 'Modifica il turno Mattina del 9 novembre');
    await expect(righe(page).nth(1).getByRole('button')).toHaveAttribute('aria-label', 'Modifica la spesa Colazione di 4,50 €');
    // solo "Modifica" si tocca, alto almeno 44 px
    for (const b of await page.locator('#evGia button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    // Modifica del turno → finestra "Modifica turno" sopra, con il turno giusto
    await righe(page).nth(0).getByRole('button', { name: /Modifica il turno/ }).click();
    await expect(page.locator('#tuModal')).toBeVisible();
    await expect(page.locator('#tuTitle')).toHaveText('Modifica turno');
    await expect(page.locator('#evModal')).toBeVisible();
    await page.locator('#tuClose').click();
    // Modifica della spesa → finestra della spesa con i suoi valori; salvando l'elenco si aggiorna
    await righe(page).nth(1).getByRole('button').click();
    await expect(page.locator('#spModal')).toBeVisible();
    await expect(page.locator('#spmImp')).toHaveValue('4,5');
    await expect(page.locator('#spmNota')).toHaveValue('Colazione');
    await expect(page.locator('#spmCats [aria-pressed="true"]')).toContainText('Bar e ristoranti');
    await page.locator('#spmImp').fill('5,20'); await page.locator('#spmOk').click();
    await expect(page.locator('#spModal')).toBeHidden();
    await expect(righe(page).nth(1).locator('small')).toHaveText('−5,20 € · Bar e ristoranti');
    expect(await page.evaluate(() => D().spesePers.s1.importo)).toBe(5.2);
    // la spesa si elimina dalla sua finestra (stesso segno del giorno aperto): l'elenco scende a 1 voce
    await righe(page).nth(1).getByRole('button').click();
    await page.locator('#spmDel').click();
    await expect(page.locator('#dlgMsg')).toHaveText('Eliminare la spesa di 5,20 €?');
    await page.locator('#dlgBtns').getByRole('button', { name: 'Elimina' }).click();
    await expect(page.locator('#evGia .hd span')).toHaveText('1 voce');
    expect(await page.evaluate(() => D().spesePers.s1.deleted)).toBe(true);
  });

  test('giorno vuoto: niente elenco e niente "Aggiungi"; l\'orario abituale non conta', async ({ browser }) => {
    const { page } = await telefono(browser);
    await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ufficio'; l.dal = '2026-01-01';
      l.settimana = { 1: { da: '09:00', a: '17:00' } }; D().lavori = { [l.id]: l }; changed(); render(); openEv(['2026-11-09']); });
    await expect(page.locator('#evModal')).toBeVisible();
    await expect(page.locator('#evGia')).toBeHidden();
    await expect(page.locator('#evAggiungi')).toBeHidden();
  });

  test('"Lavoro dipendente" si apre e si chiude come le altre ed è chiusa a ogni apertura (D-010)', async ({ browser }) => {
    const { page } = await telefono(browser); await giornoBase(page);
    await page.evaluate(() => openEv(['2026-11-09']));
    await expect(page.locator('#secLav')).not.toHaveAttribute('open', '');
    await page.locator('#secLav > summary').click();
    await expect(page.locator('#secLav')).toHaveAttribute('open', '');
    await expect(page.locator('#evLav [data-lt]').first()).toBeVisible();
    await page.locator('#secLav > summary').click();
    await expect(page.locator('#secLav')).not.toHaveAttribute('open', '');
    await page.locator('#secLav > summary').click();
    await page.locator('#evClose').click();
    await page.evaluate(() => openEv(['2026-11-09']));
    await expect(page.locator('#secLav')).not.toHaveAttribute('open', '');
  });

  test('molte voci: le prime 4 e "Mostra le altre N"; più giorni scelti o "Modifica attività": niente elenco', async ({ browser }) => {
    const { page } = await telefono(browser); await giornoBase(page);
    await page.evaluate(() => { for (let i = 2; i <= 6; i++) D().spesePers['s' + i] = { id: 's' + i, data: '2026-11-09', cat: 'spesa', importo: i, nota: 'Spesa ' + i, created: i, updatedAt: 1 };
      changed(); render(); openEv(['2026-11-09']); });
    await expect(page.locator('#evGia .hd span')).toHaveText('7 voci');
    await expect(righe(page)).toHaveCount(4);
    const piu = page.locator('#evGiaPiu');
    await expect(piu).toHaveText('Mostra le altre 3'); await expect(piu).toHaveAttribute('aria-expanded', 'false');
    await piu.click();
    await expect(righe(page)).toHaveCount(7);
    await expect(piu).toHaveText('Mostra meno'); await expect(piu).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#evClose').click();
    await page.evaluate(() => openEv(['2026-11-09']));
    await expect(righe(page)).toHaveCount(4);
    await page.locator('#evClose').click();
    await page.evaluate(() => openEv(['2026-11-09', '2026-11-10']));
    await expect(page.locator('#evGia')).toBeHidden();
  });

  test('attività di un progetto: con del testo scritto prima la domanda; entrata extra: la sua finestra sopra', async ({ browser }) => {
    const { page } = await telefono(browser); await giornoBase(page);
    await page.evaluate(() => { const p = nuovoProgetto(); p.nome = 'Squadra Esempio'; p.ore.attivo = true; D().progetti = { [p.id]: p };
      D().eventi = { e1: { id: 'e1', pid: p.id, data: '2026-11-09', tipo: 'allenamento', stato: 'previsto', titolo: '', ore: true, fasce: [{ da: '17:00', a: '19:00' }], rimborso: false, spese: [], created: 1, updatedAt: 1 } };
      D().entrateExtra = { x1: { id: 'x1', data: '2026-11-09', importo: 80, tipo: 'vendita', nota: 'bici usata', created: 1, updatedAt: 1 } };
      changed(); render(); openEv(['2026-11-09']); });
    await expect(page.locator('#evGia .hd span')).toHaveText('4 voci');
    // ordine: turno, attività del progetto, entrata extra, spesa
    await expect(righe(page).locator('b')).toHaveText(['Mattina', 'Squadra Esempio · AllenamentoPrevista', 'Vendita', 'Colazione']);
    await expect(righe(page).nth(1).locator('small')).toHaveText('17:00–19:00 · 2 ore');
    await expect(righe(page).nth(2).locator('small')).toHaveText('+80,00 € · bici usata');
    await expect(righe(page).nth(2).getByRole('button')).toHaveAttribute('aria-label', 'Modifica l’entrata extra di 80,00 € del 09/11/2026');
    // entrata extra: la sua finestra sopra "Nuova attività"
    await righe(page).nth(2).getByRole('button').click();
    await expect(page.locator('#xeModal')).toBeVisible(); await expect(page.locator('#xeTit')).toHaveText('Entrata extra');
    await page.locator('#xeClose').click();
    // del testo nelle spese → domanda; "Resta qui" non tocca niente
    await page.locator('#secSpese > summary').click(); await page.locator('#spPImp').fill('3');
    await righe(page).nth(1).getByRole('button').click();
    await expect(page.locator('#dlgMsg')).toContainText('Aprire l’attività?');
    await expect(page.locator('#dlgMsg')).toContainText('In questa finestra hai scritto qualcosa (Spese giornaliere). Se apri l’attività, quello che hai scritto non viene salvato.');
    await page.getByRole('button', { name: 'Resta qui' }).click();
    await expect(page.locator('#evTitle')).toHaveText('Nuova attività');
    await expect(page.locator('#spPImp')).toHaveValue('3');
    await righe(page).nth(1).getByRole('button').click();
    await page.getByRole('button', { name: 'Apri senza salvare' }).click();
    await expect(page.locator('#evTitle')).toHaveText('Modifica attività');
    await expect(page.locator('#evGia')).toBeHidden();
    expect(await page.evaluate(() => Object.keys(D().spesePers).length)).toBe(1);
  });
});
