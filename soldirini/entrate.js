'use strict';
// ================= Soldirini v24 · "conta quando entra" (D-009, D-051, D-052, D-071) =================
// Stipendio, pensione, compensi e rimborsi dei progetti contano nei soldi rimanenti solo quando sono segnati "Entrato",
// nel mese della data di entrata. Tasse, CU e soglie NON usano questo modulo: restano su aggrega/meseIncasso (E-6).
// Dati:
//   entrate["lav|<lavoro>|<AAAA-MM>"] e entrate["pen|<AAAA-MM>"] = {entrato, data, importo, updatedAt}
//   pagamenti["<progetto>|<AAAA-MM>|o|r"] (già esistenti) con in più `importo`
//   entrate["v24|risposta"] = {risposta:'si'|'no', updatedAt}  (domanda del primo avvio, D-051)
// "entrate" è una chiave nuova: dalla v15 mergeData la unisce voce per voce (vince updatedAt), i telefoni non aggiornati la conservano.
(function(){
const EN=()=>D().entrate||(D().entrate={});
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return isNaN(n)?null:n;};
const ymOra=()=>today().slice(0,7);
const addMese=(ym,n)=>{const d=new Date(+ym.slice(0,4),+ym.slice(5)-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
const mesiTra=(a,b)=>(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5)-+a.slice(5));
const gm=d=>{const [y,m,g]=d.split('-');return `${g}/${m}/${y}`;};
const MESE=ym=>MESI[+ym.slice(5)-1];

// ---------- lettura dei dati (03, requisito 1: i dati del file su Drive non sono fidati) ----------
const RE_YM=/^\d{4}-(0[1-9]|1[0-2])$/;
function dataValida(d){if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const [y,m,g]=d.split('-').map(Number);const x=new Date(y,m-1,g);
  return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===g;}
const importoValido=v=>typeof v==='number'&&isFinite(v);
// voce entrata: {data, importo|null} se valida; altrimenti null (= in attesa)
function leggi(r){if(!r||typeof r!=='object'||r.entrato!==true||!dataValida(r.data))return null;return {data:r.data,importo:importoValido(r.importo)?r.importo:null};}
function leggiPag(g){if(!g||typeof g!=='object'||g.pagato!==true||!dataValida(g.data))return null;return {data:g.data,importo:importoValido(g.importo)?g.importo:null};}

// ---------- le voci del mese (E-1) ----------
const lavoroDi=id=>lavori().find(l=>l.id===id);
function primoMeseLavoro(l){const c=[];if(l.dal&&RE_YM.test(String(l.dal).slice(0,7)))c.push(String(l.dal).slice(0,7));
  for(const t of turniDi(l.id))if(t.data)c.push(t.data.slice(0,7));
  for(const b of Object.values(D().buste||{}))if(b&&b.lid===l.id&&!b.deleted&&RE_YM.test(b.mese||''))c.push(b.mese);
  return c.length?c.sort()[0]:null;}
function mesiDa(da,a){const out=[];if(!da||da>a)return out;for(let ym=da;ym<=a;ym=addMese(ym,1))out.push(ym);return out;}
// stipendio di un lavoro per il mese di competenza: importo proposto (E-3) e da dove viene
function propostaLav(l,ym){const {M,netto,busta}=datiMeseLavoro(l,ym);const T=M.T||{};
  const c=!!busta||(T.lav||0)>0||(T.pagate||0)>0||(M.lordo||0)>0;if(!c)return null;
  if(busta&&busta.netto!==''&&num(busta.netto)!=null)return {imp:num(busta.netto),fonte:'busta'};
  if(netto!=null)return {imp:netto,fonte:'stima'};
  return {imp:null,fonte:M.lordo?'lordo':null,lordo:M.lordo||null};}
function propostaPen(ym){const x=pensioneMese(ym);if(!x||!(x.v>0))return null;return {imp:x.v,fonte:x.ced?'cedolino':'stima'};}
function mesiPen(){const P=window.Pensione;const p=P&&P.profilo?P.profilo():null;const c=[];
  if(p&&p.dal&&RE_YM.test(String(p.dal).slice(0,7)))c.push(String(p.dal).slice(0,7));
  for(const k of Object.keys(D().cedolini||{}))if(RE_YM.test(k)&&D().cedolini[k]&&!D().cedolini[k].deleted)c.push(k);
  return c.length?mesiDa(c.sort()[0],ymOra()):[];}
// tutte le voci fino al mese `fino` compreso
function voci(fino){fino=fino||ymOra();const out=[];const E=EN();
  for(const l of lavori()){for(const ym of mesiDa(primoMeseLavoro(l),fino)){const pr=propostaLav(l,ym);if(!pr)continue;const k=`lav|${l.id}|${ym}`;
      out.push({key:k,tipo:'lav',ym,l,titolo:`Stipendio di ${MESE(ym)}`,fonteNome:l.nome||'Lavoro',pr,ent:leggi(E[k])});}}
  for(const ym of mesiPen()){if(ym>fino)continue;const pr=propostaPen(ym);if(!pr)continue;const k=`pen|${ym}`;
    out.push({key:k,tipo:'pen',ym,titolo:`Pensione di ${MESE(ym)}`,fonteNome:'Pensione',pr,ent:leggi(E[k])});}
  for(const d of dovuti()){if(d.ym>fino)continue;const k='prog|'+d.key;
    out.push({key:k,tipo:'prog',t:d.t,ym:d.ym,pid:d.pid,titolo:`${d.t==='r'?'Rimborsi':'Compensi'} di ${MESE(d.ym)}`,fonteNome:d.p.nome,pr:{imp:d.imp,fonte:'calcolo'},previsto:meseIncasso(d.pid,d.ym,d.t),ent:leggiPag(pagamenti()[d.key])});}
  return out;}
// una voce per chiave (anche di mesi futuri)
function voce(key){const m=/^(lav)\|([^|]+)\|(\d{4}-\d{2})$/.exec(key)||/^(pen)\|(\d{4}-\d{2})$/.exec(key)||/^prog\|([^|]+)\|(\d{4}-\d{2})\|([or])$/.exec(key);if(!m)return null;
  if(m[1]==='lav'){const l=lavoroDi(m[2]);if(!l)return null;const ym=m[3];const pr=propostaLav(l,ym)||{imp:null,fonte:null};
    return {key,tipo:'lav',ym,l,titolo:`Stipendio di ${MESE(ym)}`,fonteNome:l.nome||'Lavoro',pr,ent:leggi(EN()[key])};}
  if(m[1]==='pen'){const ym=m[2];const pr=propostaPen(ym)||{imp:null,fonte:null};return {key,tipo:'pen',ym,titolo:`Pensione di ${MESE(ym)}`,fonteNome:'Pensione',pr,ent:leggi(EN()[key])};}
  const pk=key.slice(5);const d=dovuti().find(x=>x.key===pk);const [pid,ym,t]=pk.split('|');const p=prog(pid);if(!p)return null;
  return {key,tipo:'prog',t,ym,pid,titolo:`${t==='r'?'Rimborsi':'Compensi'} di ${MESE(ym)}`,fonteNome:p.nome,pr:{imp:d?d.imp:null,fonte:'calcolo'},previsto:meseIncasso(pid,ym,t),ent:leggiPag(pagamenti()[pk])};}
const importoDi=v=>v.ent?(v.ent.importo!=null?v.ent.importo:(v.pr.imp||0)):0;

// ---------- soldi entrati per mese della data di entrata (E-2) ----------
// Una sola lettura di tutti i dati: contiAnno la usa per i 12 mesi.
function indice(){const I={};const add=(ym,k,v)=>{const x=I[ym]||(I[ym]={lav:0,pen:0,prog:0});x[k]=r2(x[k]+v);};const E=EN();
  for(const [k,r] of Object.entries(E)){const e=leggi(r);if(!e)continue;
    let m=/^lav\|([^|]+)\|(\d{4}-\d{2})$/.exec(k);
    if(m){const l=lavoroDi(m[1]);if(!l)continue;const imp=e.importo!=null?e.importo:(propostaLav(l,m[2])||{}).imp||0;add(e.data.slice(0,7),'lav',imp);continue;}
    m=/^pen\|(\d{4}-\d{2})$/.exec(k);if(m){const imp=e.importo!=null?e.importo:(propostaPen(m[1])||{}).imp||0;add(e.data.slice(0,7),'pen',imp);}}
  for(const d of dovuti()){const e=leggiPag(d.pag);if(!e)continue;add(e.data.slice(0,7),'prog',e.importo!=null?e.importo:d.imp);}
  return I;}

// ---------- finestra "È entrato / È entrata / Entrati" (E-3, E-4, E-5, D-052) ----------
let aperta=null;
const parole=v=>v.tipo==='pen'?{q:'Quanto è entrata',w:'Quando è entrata',si:'Entrata',no:'Non entrata',del:'della pensione'}
  :v.tipo==='prog'?{q:'Quanto è entrato',w:'Quando sono entrati',si:'Entrati',no:'Non entrati',del:v.t==='r'?'dei rimborsi':'dei compensi'}
  :{q:'Quanto è entrato',w:'Quando è entrato',si:'Entrato',no:'Non entrato',del:'dello stipendio'};
function notaImporto(v){const f=v.pr.fonte;
  if(v.tipo==='lav'){if(f==='busta')return 'Proposto dal netto della busta. Correggilo se in banca è diverso.';if(f==='stima')return 'Stima: correggila con quello che vedi in banca.';
    if(f==='lordo')return 'C’è solo il lordo: il netto lo trovi sull’estratto conto.';return 'Scrivi quanto è entrato in banca.';}
  if(v.tipo==='pen')return f==='cedolino'?'Proposto dal netto del cedolino. Correggilo se in banca è diverso.':'Stima: correggila con quello che vedi in banca.';
  return (v.t==='r'?'Totale dei rimborsi':'Netto dei compensi')+' calcolato da Soldirini. Correggilo se in banca è diverso. La data decide anche l’anno per le tasse.';}
function apri(key){const v=voce(key);if(!v){toast('Questa voce non c’è più.','err');return;}aperta=v;const P=parole(v);
  $('enTit').textContent=v.titolo;
  $('enSub').textContent=v.fonteNome+(v.ent?` · ✓ ${P.si.toLowerCase()} il ${gm(v.ent.data)}`:v.tipo==='lav'?(v.pr.fonte==='busta'?' · busta di '+MESE(v.ym):v.pr.fonte==='stima'?' · stima':''):v.tipo==='pen'?(v.pr.fonte==='cedolino'?' · cedolino':' · stima'):'');
  $('enImpL').firstChild.textContent=P.q;$('enDataL').firstChild.textContent=P.w;
  const imp=v.ent?importoDi(v):v.pr.imp;$('enImp').value=imp!=null?String(r2(imp)).replace('.',','):'';
  $('enImp').placeholder=v.pr.fonte==='lordo'&&!v.ent?'scrivi quanto è entrato':'0,00';
  $('enImpNota').textContent=notaImporto(v);
  $('enData').value=v.ent?v.ent.data:today();$('enData').max=today();
  $('enNo').hidden=!v.ent;$('enNo').textContent=P.no;
  controlla();$('enModal').hidden=false;document.body.classList.add('noscroll');setTimeout(()=>$('enImp').focus(),50);}
function chiudi(){$('enModal').hidden=true;aperta=null;if([...document.querySelectorAll('.modal')].every(m=>m.hidden))document.body.classList.remove('noscroll');}
function controlla(){const v=aperta;if(!v)return false;const P=parole(v);const d=$('enData').value;const imp=num($('enImp').value);
  const md=$('enDataMsg');md.className='sm';md.textContent='';$('enData').classList.remove('bad');let ok=true;
  if(!dataValida(d)){md.className='sm err';md.textContent='Scrivi la data.';ok=false;}
  else if(d>today()){md.className='sm err';md.textContent='La data non può essere nel futuro: i soldi devono essere già arrivati.';$('enData').classList.add('bad');ok=false;}
  else if(d.slice(0,7)<v.ym){md.className='sm warn';md.textContent=`⚠ Data insolita: è prima di ${MESE(v.ym)}, il mese ${P.del}. Se è giusta, salva pure.`;}
  if(!(imp>0))ok=false;
  // T-S7: busta o cedolino arrivati dopo con un netto diverso da quello segnato
  const w=$('enImpAvv');w.textContent='';
  if(v.ent&&v.ent.importo!=null&&(v.pr.fonte==='busta'||v.pr.fonte==='cedolino')&&v.pr.imp!=null&&Math.abs(v.pr.imp-v.ent.importo)>=0.005)
    w.textContent=`⚠ ${v.pr.fonte==='busta'?'La busta':'Il cedolino'} dice ${eur(v.pr.imp)}. Conta quello che hai scritto: correggilo se serve.`;
  $('enSave').disabled=!ok;return ok;}
function salva(){const v=aperta;if(!v||!controlla())return;const d=$('enData').value;const imp=r2(num($('enImp').value));const now=Date.now();
  if(v.tipo==='prog')pagamenti()[v.key.slice(5)]={pagato:true,data:d,importo:imp,updatedAt:now}; // T-P6: l'importo si salva sempre
  else EN()[v.key]={entrato:true,data:d,importo:imp,updatedAt:now};
  const P=parole(v);chiudi();changed();render();toast(`${P.si} il ${gm(d)}: conta nei soldi di ${monthName(d.slice(0,7))}.`);}
function nonEntrato(){const v=aperta;if(!v)return;const now=Date.now();
  if(v.tipo==='prog')pagamenti()[v.key.slice(5)]={pagato:false,data:'',updatedAt:now};
  else EN()[v.key]={entrato:false,data:'',updatedAt:now}; // segnata, non cancellata: vince anche sugli altri telefoni
  chiudi();changed();render();toast('Tolto: ora è tra quelli in arrivo.');}

// ---------- righe di stato (schermata 4 di 02) ----------
function rigaStato(key){const v=voce(key);if(!v)return '';const P=parole(v);
  if(v.ent)return `<button type="button" class="enst ok" data-en="${esc(v.key)}"><span class="tx">✓ ${P.si} il ${esc(gm(v.ent.data).slice(0,5))}<small>${esc(provenienza(v))}</small></span><b>${eur(importoDi(v))}</b></button>`;
  if(v.pr.imp==null&&v.pr.fonte==null)return '';
  return `<div class="enst"><span class="tx">In attesa<small>${esc(provenienza(v))}</small></span><button type="button" class="btn sm" data-en="${esc(v.key)}">${v.tipo==='pen'?'È entrata':v.tipo==='prog'?'Entrati':'È entrato'}</button></div>`;}
function provenienza(v){const f=v.pr.fonte;const i=v.pr.imp!=null?eur(v.pr.imp):'';
  if(f==='busta')return 'Busta ✓'+(v.ent?'':' · '+i);if(f==='cedolino')return 'Cedolino ✓'+(v.ent?'':' · '+i);if(f==='stima')return 'Stima '+i;
  if(f==='lordo')return 'Solo il lordo: scrivi il netto';if(f==='calcolo')return i;return '';}

// ---------- scheda "In arrivo" sotto i soldi rimanenti (E-7) ----------
// 24b.2 (D-099 punto 1): nel Riepilogo solo i compensi dei progetti, in una scheda nello stile di Tasse e Risparmi;
// stipendio e pensione in arrivo in cima alle pagine Lavoro dipendente e Pensione (stesse righe, stesso "È entrato")
// 24c.1 (02, tornata 27 §2-3): importo a destra; sotto il titolo progetto, lavoro ("· stima") o "dal cedolino"/"stima";
// pulsanti alti 44 px con un'etichetta che dice quale voce si segna (con più righe tutti i pulsanti dicevano solo "Entrati")
function righeInArrivo(L,ora){return L.map(v=>{const vecchia=mesiTra(v.ym,ora)>2,f=v.pr.fonte;
    const da=v.tipo==='pen'?(f==='cedolino'?'dal cedolino':f==='stima'?'stima':''):[esc(v.fonteNome),f==='stima'?'stima':''].filter(Boolean).join(' · ');
    const det=[da,v.pr.imp==null?'importo da scrivere':'',v.tipo==='prog'&&v.previsto?'previsti a '+esc(MESE(v.previsto)):''].filter(Boolean).join(' · ');
    const tit=esc(v.titolo),lab=v.tipo==='prog'?`Segna come entrati i ${tit.charAt(0).toLowerCase()+tit.slice(1)}, ${esc(v.fonteNome)}`:v.tipo==='pen'?`${tit}: è entrata`:`${tit}, ${esc(v.fonteNome)}: è entrato`;
    return `<div class="ir${vecchia?' old':''}"><span class="tx"><b>${tit}</b>${det?`<small>${det}</small>`:''}${vecchia?'<small class="w">⚠ Da più di 2 mesi: controlla se è entrato</small>':''}</span>${v.pr.imp!=null?`<b class="imp">${eur(v.pr.imp)}</b>`:''}<button type="button" class="btn sm${v.tipo==='prog'?' ghost':''}" data-en="${esc(v.key)}" aria-label="${lab}">${v.tipo==='pen'?'È entrata':v.tipo==='prog'?'Entrati':'È entrato'}</button></div>`;}).join('');}
// clessidra a linea, stesso tratto dei disegni dei pulsanti Tasse e Risparmi (02, tornata 27 §2)
const CLESSIDRA='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 4 5 5.5 5 9s-5 5-5 9M17 3c0 4-5 5.5-5 9s5 5 5 9"/></svg>';
function contenitore(id,dove){let box=$(id);if(!dove)return box;if(!box){box=document.createElement('div');box.id=id;box.className='cards';}if(dove.previousElementSibling!==box)dove.before(box);return box;}
function renderInArrivo(){
  const tot=$('rieTot');if(!tot)return;
  let box=$('rieIn');if(!box){box=document.createElement('div');box.id='rieIn';box.className='cards';}
  if(tot.nextElementSibling!==box)tot.after(box);
  const lav=contenitore('lavIn',$('rieLav')),pen=contenitore('penIn',$('riePen'));
  const ora=ymOra();const tutte=rieMode==='anno'||cur!==ora?[]:voci(ora).filter(v=>!v.ent&&(v.pr.imp!=null||v.pr.fonte==='lordo')).sort((a,b)=>a.ym.localeCompare(b.ym)||a.titolo.localeCompare(b.titolo));
  const di=t=>tutte.filter(v=>v.tipo===t),somma=L=>eur(r2(L.reduce((a,v)=>a+(v.pr.imp||0),0)));
  const P=di('prog');
  box.innerHTML=P.length?`<section class="card inarr insub" aria-labelledby="inCmpT"><div class="inhead"><span class="ico">${CLESSIDRA}</span><span class="tx"><b id="inCmpT">Compensi non ancora entrati</b><small>${somma(P)} in tutto · non contati nei soldi rimanenti</small></span></div>${righeInArrivo(P,ora)}</section>`:'';
  for(const [b,L,id] of [[lav,di('lav'),'inLavT'],[pen,di('pen'),'inPenT']])if(b)b.innerHTML=L.length?`<section class="card inarr" aria-labelledby="${id}"><h3 id="${id}">In arrivo <small class="muted">· non contato nei soldi rimanenti</small></h3>${righeInArrivo(L,ora)}</section>`:'';}

// ---------- primo avvio della v24 (E-10, D-051, D-071) ----------
// una sola volta per apertura dell'app, alla prima occasione (avvio o prima sincronizzazione): mai a metà dell'uso
let chiesto=false;
async function forseChiedi(){if(chiesto)return;chiesto=true;const E=EN();if(E['v24|risposta']&&(E['v24|risposta'].risposta==='si'||E['v24|risposta'].risposta==='no'))return;
  const ora=ymOra();const passate=voci(addMese(ora,-1)).filter(v=>(v.tipo==='lav'||v.tipo==='pen')&&!v.ent&&!E[v.key]&&valoreV23(v)>0);
  if(!passate.length)return;
  const r=await ask(`<b>Novità: i soldi contano quando entrano</b><br>Da questa versione stipendio e pensione entrano nei soldi rimanenti <b>solo quando li segni come entrati</b>, nel mese in cui arrivano in banca.<br><br><b>Segno come entrati stipendi e pensioni dei mesi passati?</b><br><span class="muted sm">Così i mesi passati restano come li vedi oggi. ${esc(MESI[+ora.slice(5)-1].replace(/^./,c=>c.toUpperCase()))} resta in attesa: lo segni tu quando arriva. Puoi sempre correggere un mese dalla sua voce.</span>`,
    [{t:'No, li segno io',v:'no',cls:'ghost'},{t:'Sì, segnali come entrati',v:'si'}],true);
  if(r!=='si'&&r!=='no')return; // finestra chiusa senza scegliere: niente risposta salvata, la domanda torna al prossimo avvio
  const now=Date.now();let n=0;
  if(r==='si')for(const v of passate){EN()[v.key]={entrato:true,data:`${v.ym}-${pad(lastDay(v.ym))}`,importo:r2(valoreV23(v)),updatedAt:now};n++;}
  EN()['v24|risposta']={risposta:r,updatedAt:now};changed();render();
  if(r==='si')toast(`Segnati come entrati ${n} ${n===1?'mese':'mesi'} di stipendio e pensione.`);}
// importo che la v23 contava per quel mese (anche il lordo, E-10)
function valoreV23(v){if(v.tipo==='lav'){const pr=v.pr;return pr.imp!=null?pr.imp:(pr.lordo||0);}return v.pr.imp||0;}

// ---------- collegamenti ----------
document.addEventListener('click',e=>{const b=e.target.closest('[data-en]');if(b){e.preventDefault();e.stopPropagation();apri(b.getAttribute('data-en'));}},true);
$('enClose').onclick=chiudi;$('enAnn').onclick=chiudi;$('enSave').onclick=salva;$('enNo').onclick=nonEntrato;
$('enImp').addEventListener('input',controlla);$('enData').addEventListener('input',controlla);$('enData').addEventListener('change',controlla);
$('enModal').addEventListener('click',e=>{if(e.target===$('enModal'))chiudi();});
// i progetti usano la stessa finestra (prima: chiediPagamento in plus.js)
chiediPagamento=function(key){apri('prog|'+key);};
const _renderRieEn=renderRiepilogo;renderRiepilogo=function(){_renderRieEn();renderInArrivo();};
// la domanda del primo avvio: subito senza account; con l'account dopo la prima sincronizzazione (così vede la risposta data su un altro telefono)
const _syncEn=sync;sync=async function(){const r=await _syncEn.apply(this,arguments);if(!chiesto)try{await forseChiedi();}catch(e){console.warn(e);}return r;};
setTimeout(()=>{if(!DB.meta.account)forseChiedi();},800);

window.Entrate={voci,voce,indice,apri,rigaStato,leggi,leggiPag,dataValida,forseChiedi,importoDi};
})();
