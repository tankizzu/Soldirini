// Busta paga FINTA con una struttura a tabella simile a quelle TeamSystem, numeri inventati (D-081, D-086).
// Nessun dato reale: nomi, importi e date sono di fantasia e scelti apposta diversi da quelli della busta reale (D-084). Disegnata su una tela nel browser e restituita come PNG/JPEG.
// opz.mese: 'nome' (OTTOBRE 2026) | 'numero' (10/2026 vicino a "MESE RETRIBUZIONE") | 'nessuno'
// opz.foto: true = immagine rimpicciolita, sfocata e in JPEG (come una foto)
function disegnaBustaFinta(opz) {
  const W = 1240, Hh = 1100, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#111'; g.textBaseline = 'alphabetic';
  const T = (s, x, y, px = 20, b = false) => { g.font = `${b ? 'bold ' : ''}${px}px Arial, Helvetica, sans-serif`; g.fillText(s, x, y); };
  const D = (s, xr, y, px = 20) => { g.font = `${px}px Arial, Helvetica, sans-serif`; g.fillText(s, xr - g.measureText(s).width, y); }; // allineato a destra
  T('COOPERATIVA SOCIALE ESEMPIO', 40, 50, 24, true); T('CEDOLINO PAGA', 900, 50, 24, true);
  T('DIPENDENTE ROSSI MARIO', 40, 95); T('LIVELLO B2', 520, 95); T('PART-TIME 60%', 760, 95);
  if (opz.mese === 'nome') { T('MESE RETRIBUZIONE', 40, 135); T('OTTOBRE 2026', 300, 135, 20, true); }
  if (opz.mese === 'numero') { T('MESE RETRIBUZIONE', 40, 135); T('10/2026', 300, 135, 20, true); }
  T('DATA TERMINE TD 31/08/2028', 520, 135); T('DATA ASS. CONV. 12/05/2025', 860, 135);
  g.fillRect(40, 155, W - 80, 2);
  const COL = { voce: 40, desc: 120, ore: 560, base: 700, stat: 840, comp: 1040, tratt: 1190 };
  T('VOCE', COL.voce, 185, 18, true); T('DESCRIZIONE', COL.desc, 185, 18, true); T('ORE-GIORNI', 520, 185, 18, true); T('BASE', 650, 185, 18, true);
  T('DATI STATISTICI', 760, 185, 18, true); T('COMPETENZE', 920, 185, 18, true); T('TRATTENUTE', 1070, 185, 18, true);
  const righe = [['0001', 'RETRIBUZIONE ORDINARIA', '120,00', '9,87650', '', '1.185,18', ''], ['0050', 'SCATTI ANZIANITA', '', '', '', '34,22', ''],
    ['0320', 'MAGGIORAZIONE FESTIVO', '8,00', '1,97500', '', '15,80', ''], ['0510', 'CONTRIBUTI IVS', '', '1.235,00', '', '', '115,72'],
    ['0700', 'IRPEF', '', '', '', '', '98,30'], ['0710', 'ADDIZIONALE REGIONALE', '', '', '', '', '12,14'], ['0711', 'ADDIZIONALE COMUNALE', '', '', '', '', '4,60']];
  righe.forEach((r, i) => { const y = 220 + i * 34; T(r[0], COL.voce, y); T(r[1], COL.desc, y); if (r[2]) D(r[2], COL.ore, y); if (r[3]) D(r[3], COL.base, y); if (r[5]) D(r[5], COL.comp, y); if (r[6]) D(r[6], COL.tratt, y); });
  g.fillRect(40, 470, W - 80, 2);
  T('TOTALI', COL.desc, 505, 20, true); D('1.235,20', COL.comp, 505); D('230,76', COL.tratt, 505);
  T('NETTO BUSTA', 860, 560, 22, true); D('1. 004, 44', COL.tratt, 560, 22);
  T('IMPONIBILE IRPEF', 40, 560); D('1.119,48', 400, 560); T('IRPEF NETTA', 40, 594); D('98,30', 400, 594);
  g.fillRect(40, 625, W - 80, 2);
  T('ANNO PREC.', 260, 660, 18, true); T('MATURATO', 420, 660, 18, true); T('GODUTO', 580, 660, 18, true); T('RESIDUO', 720, 660, 18, true); T('PROIEZIONE', 860, 660, 18, true);
  const fp = [['FERIE h', '24,00', '86,64', '32,00', '78,64', '104,00'], ['PERMESSI', '0,00', '4,00', '4,00', '0,00', '0,00'],
    ['R.O.L.', '10,00', '20,22', '6,00', '24,22', '34,00'], ['EX FEST. h', '0,00', '12,00', '4,00', '8,00', '16,00']];
  fp.forEach((r, i) => { const y = 695 + i * 34; T(r[0], 40, y); [370, 520, 660, 810, 980].forEach((x, k) => D(r[k + 1], x, y)); });
  g.fillRect(40, 845, W - 80, 2);
  T('IMPONIBILE CONTR. MESE', 40, 885); D('1.235,00', 480, 885); T('CONTRIBUTI INPS', 600, 885); D('115,72', 980, 885);
  if (!opz.foto) return c.toDataURL('image/png');
  const s = opz.scala || 0.62, c2 = document.createElement('canvas'); c2.width = Math.round(W * s); c2.height = Math.round(Hh * s); const g2 = c2.getContext('2d');
  g2.filter = `blur(${opz.sfoca ?? 0.6}px)`; g2.drawImage(c, 0, 0, c2.width, c2.height); g2.filter = 'none';
  g2.globalCompositeOperation = 'multiply'; g2.fillStyle = 'rgb(232,226,214)'; g2.fillRect(0, 0, c2.width, c2.height); // carta un po' grigia
  return c2.toDataURL('image/jpeg', 0.7);
}
// valori attesi della busta finta
const ATTESI = { lordo: 1235.2, trattenute: 230.76, netto: 1004.44, ferie: 78.64, rol: 24.22, exfest: 8, unita: 'ore', imponibilePrev: 1235, contribLav: 115.72 };
// da data URL a File senza fetch (la CSP blocca connect-src data:)
function fileDa(url, nome) { const [t, b] = url.split(','); const tipo = t.slice(5).split(';')[0]; const s = atob(b); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new File([a], nome, { type: tipo }); }
module.exports = { disegnaBustaFinta, fileDa, ATTESI };
