// 24c.14: liste movimenti ING inventate (CSV ed Excel) per le prove. Solo dati inventati (D-089), con la forma di
// consegne/00-formato-lista-movimenti-ing.md. Ogni riga è [data contabile, data valuta, uscite, entrate, causale, descrizione].
const TESTA = 'DATA CONTABILE,DATA VALUTA,USCITE,ENTRATE,CAUSALE,DESCRIZIONE OPERAZIONE';
const it = v => { const [i, d] = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '-' : '+') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const usc = v => v < 0 ? `"${it(v)}"` : '', ent = v => v > 0 ? `"${it(v)}"` : '';
const carta = (acq, v, presso, dc = acq) => [dc, acq, usc(v), ent(v), 'Pagamento Carta', `Operazione Mastercard del ${acq} alle ore 10:00 con Carta xxxxxxxxxxxx0000 Div=EUR Importo in divisa=${Math.abs(v)} / Importo in Euro=${Math.abs(v)} presso ${presso}`];
const stip = (d, v, per, chi = 'DITTA ESEMPIO S.R.L.') => [d, d, '', ent(v), 'Accredito Stipendio/Pensione', `Bonifico N. 0000000000 BIC Ordinante XXXXITMM Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante ${chi} Note: Accredito stipendi-emolumenti periodo ${per}`];
const pens = (d, v) => [d, d, '', ent(v), 'Accredito Stipendio/Pensione', `Bonifico N. 0000000000 BIC Ordinante XXXXITMM Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante INPS Note: Pagamento pensione`];
const sdd = (d, v, nome) => [d, d, usc(v), '', 'Addebito Diretto', `Addebito SDD CORE Scad. ${d} Imp. ${Math.abs(v)} Creditor id. IT00ZZZ0000000000000 ${nome} Id Mandato 0000000000 Debitore NOME INVENTATO Rif. 000000000000`];
const bonEnt = (d, v, chi, nota, dv = d) => [d, dv, '', ent(v), 'Accredito Bonifico', `Bonifico N. 0000000000 BIC Ordinante XXXXITMMXXX Codifica Ordinante IT00X0000000000000000000000 Anagrafica Ordinante ${chi} Note: ${nota}`];
const bonUsc = (d, v, nota) => [d, d, usc(v), '', 'Bonifico in uscita', `Bonifico N. 0000000000 A favore di NOME INVENTATO IBAN beneficiario IT00X0000000000000000000000 Note: ${nota}`];
const accredito = (d, v, caus) => [d, d, '', ent(v), caus, `${caus} N. 0000000000`];
const numero = s => Number(String(s).replace(/"/g, '').replace(/\./g, '').replace(',', '.'));
// lista CSV con i saldi giusti
function lista(righe, iniziale = 500) {
  const tot = righe.reduce((a, r) => a + numero(r[2] || r[3]), 0);
  return [TESTA, `${righe[0][0]},,,"${it(iniziale)}",,Saldo iniziale`, ...righe.map(r => r.join(',')), `${righe[righe.length - 1][0]},,,"${it(iniziale + tot)}",,Saldo finale`].join('\r\n') + '\r\n';
}
const file = (testo, name = 'ListaMovimenti.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(testo, 'utf8') });
const xfile = b => ({ name: 'ListaMovimenti.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: b });
// Excel con la forma del file vero (testata, intestazione in riga 12 dalla colonna B), costruito nella pagina con JSZip.
// opz: { doctype: testo messo prima di <worksheet>, cellaExtra: XML di una cella in più nella prima riga dei movimenti,
//        sstGrande: byte di spazi in sharedStrings, righeVuote: righe di movimenti copiate in più }
async function xlsx(page, righe, opz = {}) {
  const mov = righe.map(r => ({ dc: r[0], dv: r[1], caus: r[4], desc: r[5], v: numero(r[2] || r[3]) }));
  const saldo = (500 + mov.reduce((a, m) => a + m.v, 0));
  return Buffer.from(await page.evaluate(async ({ mov, saldo, opz }) => {
    const S = [], si = t => { let i = S.indexOf(t); if (i < 0) { S.push(t); i = S.length - 1; } return i; };
    const esx = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const ser = d => { const [g, m, y] = d.split('/').map(Number); return (Date.UTC(y, m - 1, g) - Date.UTC(1899, 11, 30)) / 86400000; };
    const col = i => String.fromCharCode(66 + i);
    const cella = (r, i, v) => typeof v === 'number' ? `<c r="${col(i)}${r}" s="1"><v>${v}</v></c>` : `<c r="${col(i)}${r}" t="s"><v>${si(v)}</v></c>`;
    const f = v => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(2).replace('.', ',');
    const testata = [[2, 'LISTA MOVIMENTI CONTO CORRENTE ARANCIO'], [4, 'Intestatario: NOME INVENTATO · Conto: IT00X0000000000000000000000'], [6, `Periodo: dal ${mov[0].dc} al ${mov[mov.length - 1].dc}`], [8, 'Saldo iniziale: +500,00 EUR'], [9, `Saldo finale: ${f(saldo)} EUR`]];
    let rows = testata.map(([r, t]) => `<row r="${r}">${cella(r, 0, t)}</row>`).join('');
    rows += `<row r="12">${['DATA CONTABILE', 'DATA VALUTA', 'CAUSALE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO'].map((h, i) => cella(12, i, h)).join('')}</row>`;
    const tutti = opz.righeVuote ? Array.from({ length: opz.righeVuote }, (_, k) => mov[k % mov.length]) : mov;
    tutti.forEach((m, k) => { const r = 13 + k; rows += `<row r="${r}">${[ser(m.dc), ser(m.dv), m.caus, m.desc, m.v].map((v, i) => cella(r, i, v)).join('')}${k === 0 && opz.cellaExtra ? opz.cellaExtra : ''}</row>`; });
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    z.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Movimenti" sheetId="1" r:id="rId1"/></sheets></workbook>');
    z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?>${opz.doctype || ''}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
    const sst = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${S.map(t => `<si><t xml:space="preserve">${esx(t)}</t></si>`).join('')}</sst>`;
    z.file('xl/sharedStrings.xml', opz.sstGrande ? sst.replace('</sst>', ' '.repeat(opz.sstGrande) + '</sst>') : sst);
    return await z.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  }, { mov, saldo, opz }), 'base64');
}
module.exports = { TESTA, it, carta, stip, pens, sdd, bonEnt, bonUsc, accredito, lista, file, xfile, xlsx, numero };
