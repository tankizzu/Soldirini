// 24c.9 (D-146): feste più visibili sul calendario. Casella della festa in rosso (bordo, numero, fondo tenue), segno 🎉 più
// grande, "Festa nazionale" / "Dalle “Feste locali” del lavoro …" nel giorno aperto, "Pasquetta (Lunedì dell’Angelo)",
// frase grigia sotto la scelta. Solo vista. Contrasti misurati nella pagina. Solo dati inventati.
const { test, expect } = require('./helpers/prova');
const { DriveFinto, nuovoDispositivo } = require('./helpers/app');

async function telefono(browser, ora = '2026-12-25T10:00:00+01:00') {
  const d = await nuovoDispositivo(browser, { drive: new DriveFinto(), ora });
  await d.page.waitForFunction(() => window.Entrate && window.Stip15 && window.Archivio && Archivio.avviata);
  return d;
}
const mese = (page, ym, sel) => page.evaluate(([ym, sel]) => { DB.meta.skipWelcome = true; tab = 'cal'; cur = ym; if (sel) selDay = sel; render(); }, [ym, sel]);
const rosse = page => page.locator('#grid [data-day].festa').evaluateAll(b => b.map(x => x.dataset.day));
// contrasto WCAG tra due colori come li dà il navigatore (rgb(...) oppure color(srgb ...))
const CONTRASTO = `(() => {
  const rgb = c => { let m = /rgba?\\(([^)]+)\\)/.exec(c); if (m) return m[1].split(/[ ,\\/]+/).filter(Boolean).slice(0, 3).map(Number);
    m = /color\\(srgb ([^)]+)\\)/.exec(c); return m[1].split(/[ \\/]+/).slice(0, 3).map(x => Math.round(+x * 255)); };
  const L = c => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  return (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
})()`;

test.describe('24c.9 · D-146: feste più visibili', () => {
  for (const tema of ['light', 'dark']) {
    test(`tema ${tema === 'light' ? 'chiaro' : 'scuro'}: dicembre 2026 con 8, 25, 26 in rosso e il segno grande; contrasti; scelta spenta → niente rosso`, async ({ browser }) => {
      const { page, errori } = await telefono(browser);
      await page.evaluate(t => { impost().tema = t; applyTema(); }, tema);
      await mese(page, '2026-12', '2026-12-08');
      expect(await rosse(page)).toEqual(['2026-12-08', '2026-12-25', '2026-12-26']);
      const m = await page.evaluate(CONTRASTO => { const c = eval(CONTRASTO);
        const bg = getComputedStyle(document.getElementById('grid')).backgroundColor !== 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.getElementById('grid')).backgroundColor : getComputedStyle(document.body).backgroundColor;
        return ['2026-12-08', '2026-12-25', '2026-12-26', '2026-12-09'].map(d => { const b = document.querySelector(`[data-day="${d}"]`), s = getComputedStyle(b), n = getComputedStyle(b.querySelector('.n'));
          const f = b.querySelector('.fst');
          return { d, numero: c(n.color, n.backgroundColor !== 'rgba(0, 0, 0, 0)' ? n.backgroundColor : s.backgroundColor), bordoFuori: c(s.borderTopColor, bg), bordoDentro: c(s.borderTopColor, s.backgroundColor),
            segno: f ? parseFloat(getComputedStyle(f).fontSize) : 0, festa: b.classList.contains('festa') }; }); }, CONTRASTO);
      for (const x of m.slice(0, 3)) {
        expect(x.numero, `numero del ${x.d}`).toBeGreaterThanOrEqual(4.5);
        expect(x.bordoFuori, `bordo del ${x.d}`).toBeGreaterThanOrEqual(3);
        expect(x.segno).toBeGreaterThanOrEqual(16);
      }
      expect(m[3]).toMatchObject({ festa: false, segno: 0 }); // giorno normale
      // il 25 è oggi: cerchio rosso, numero col colore della casella; l'8 è il giorno scelto: contorno visibile
      expect(await page.evaluate(() => { const n = getComputedStyle(document.querySelector('[data-day="2026-12-25"] .n')); const s = getComputedStyle(document.querySelector('[data-day="2026-12-08"]'));
        return { cerchio: n.borderRadius !== '0px' && n.backgroundColor !== 'rgba(0, 0, 0, 0)', oggi: document.querySelector('[data-day="2026-12-25"]').classList.contains('today'), sel: document.querySelector('[data-day="2026-12-08"]').classList.contains('sel'), contorno: parseFloat(s.outlineWidth) >= 2 }; }))
        .toEqual({ cerchio: true, oggi: true, sel: true, contorno: true });
      // scelta spenta: niente rosso e niente segno
      await page.evaluate(() => { impost().festeCal = false; changed(); render(); });
      expect(await rosse(page)).toEqual([]); expect(await page.locator('#grid .fst').count()).toBe(0);
      expect(errori).toEqual([]);
    });
  }

  test('festa + turno, festa + ferie, festa + oggi, festa + giorno scelto a 390 px: niente tagliato, segno e riquadri senza sovrapporsi', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    const lid = await page.evaluate(() => { const l = Stip15.nuovoLavoro('turni'); l.nome = 'Reparto'; l.dal = '2026-01-01'; D().lavori[l.id] = l;
      const t = l.tipi.find(x => x.cat === 'lavoro'), f = l.tipi.find(x => x.cat === 'ferie');
      D().turni = { a: { id: 'a', lid: l.id, data: '2026-12-25', tipo: t.id, updatedAt: 1 }, b: { id: 'b', lid: l.id, data: '2026-12-08', tipo: f.id, updatedAt: 1 },
        c: { id: 'c', lid: l.id, data: '2026-12-26', tipo: t.id, updatedAt: 1 }, d: { id: 'd', lid: l.id, data: '2026-12-26', tipo: f.id, updatedAt: 1 } }; changed(); return l.id; });
    await mese(page, '2026-12', '2026-12-26');
    expect(await page.evaluate(() => innerWidth)).toBe(390);
    for (const d of ['2026-12-25', '2026-12-08', '2026-12-26']) {
      const r = await page.locator(`[data-day="${d}"]`).evaluate(c => { const box = e => e.getBoundingClientRect(), f = box(c.querySelector('.fst')), b = box(c);
        const rn = document.createRange(); rn.selectNodeContents(c.querySelector('.n'));
        const n = c.classList.contains('today') ? box(c.querySelector('.n')) : rn.getBoundingClientRect(); // oggi: tutto il cerchio
        const tocca = (a, x) => a.left < x.right && a.right > x.left && a.top < x.bottom && a.bottom > x.top;
        const ev = [...c.querySelectorAll('.ev.tu')].map(box);
        return { dentro: f.right <= b.right + 0.5 && f.top >= b.top - 0.5 && f.left >= b.left, numero: !tocca(f, n), riquadri: ev.length > 0 && ev.every(e => !tocca(f, e)),
          sigle: [...c.querySelectorAll('.tus')].every(s => s.scrollWidth <= s.clientWidth + 1) }; });
      expect(r, d).toEqual({ dentro: true, numero: true, riquadri: true, sigle: true });
    }
    // calcoli uguali con la scelta accesa o spenta (solo vista)
    const conti = () => page.evaluate(lid => JSON.stringify([window.StipCalc.calcolaMese(D().lavori[lid], Object.values(D().turni), '2026-12'), contiMese('2026-12')]), lid);
    const acceso = await conti(); await page.evaluate(() => { impost().festeCal = false; changed(); render(); }); expect(await conti()).toBe(acceso);
    expect(errori).toEqual([]);
  });

  test('giorno aperto: "Festa nazionale", "Dalle “Feste locali” del lavoro …", Pasquetta; frase grigia sotto la scelta', async ({ browser }) => {
    const { page, errori } = await telefono(browser);
    await page.evaluate(() => { const l = Stip15.nuovoLavoro('fisso'); l.nome = 'Ditta di prova'; l.dal = '2026-01-01'; l.locali = '29/06'; D().lavori[l.id] = l; changed(); });
    await page.evaluate(() => apriGiorno('2026-12-25'));
    await expect(page.locator('#dayFesta .fnome')).toHaveText('🎉 Natale'); await expect(page.locator('#dayFesta .fda')).toHaveText('Festa nazionale');
    await page.evaluate(() => apriGiorno('2026-04-06'));
    await expect(page.locator('#dayFesta .fnome')).toHaveText('🎉 Pasquetta (Lunedì dell’Angelo)');
    expect(await page.evaluate(() => window.StipCalc.festivo('2026-04-06', []))).toBe('Lunedì dell’Angelo'); // i nomi della paga non cambiano
    await page.evaluate(() => apriGiorno('2026-06-29'));
    await expect(page.locator('#dayFesta .fnome')).toHaveText('🎉 Festa locale'); await expect(page.locator('#dayFesta .fda')).toHaveText('Dalle “Feste locali” del lavoro Ditta di prova');
    await mese(page, '2026-06'); expect(await rosse(page)).toEqual(['2026-06-02', '2026-06-29']);
    await page.evaluate(() => { document.getElementById('dayModal').hidden = true; tab = 'pro'; render(); });
    await expect(page.locator('#festeCalNota')).toHaveText('Le feste nazionali italiane, con 🎉. Il santo patrono si aggiunge nel lavoro, in “Feste locali”.');
    expect(errori).toEqual([]);
  });
});
