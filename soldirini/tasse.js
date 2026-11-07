'use strict';
// ================= Soldirini v5 · tasse, CU, cestino, storico, blocco, promemoria =================
const CAT_NOMI={occasionale:'Prestazione occasionale',sportivo:'Compenso sportivo',altro:'Altro'};
const CAT_INFO={occasionale:'Ritenuta del 20% (puoi cambiarla qui sopra).',sportivo:'Nessuna ritenuta finché il totale dell’anno di tutte le società sportive resta sotto i 15.000 €; sulla parte oltre si applica la percentuale qui sopra.',altro:'Usa la percentuale che scrivi qui sopra.'};
const catOf=p=>p?.ore?.categoria||'occasionale';
const itNumParse=s=>{s=String(s??'').trim().replace(/[€\s]/g,'');if(!s)return 0;if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');return +s||0;};
const dIt=s=>s?parseYmd(s).toLocaleDateString('it-IT'):'';

// ---------- soglie per tipo di compenso ----------
SOGLIE_DEF=function(){return [
  {id:'sport15',nome:'Compensi sportivi · esenzione IRPEF',limite:15000,cat:'sportivo'},
  {id:'sport5',nome:'Compensi sportivi · contributi INPS',limite:5000,cat:'sportivo'},
  {id:'occ5',nome:'Prestazioni occasionali · contributi INPS',limite:5000,cat:'occasionale'}];};
function soglieMigr(){const I=impost();if(I.soglie.some(s=>s.id==='sport15'))return;const old=Object.fromEntries(I.soglie.map(s=>[s.id,s.limite]));
  I.soglie=SOGLIE_DEF();if(old.sport)I.soglie[0].limite=old.sport;if(old.occ)I.soglie[2].limite=old.occ;}
const soglia=id=>impost().soglie.find(s=>s.id===id)?.limite??(id==='sport15'?15000:5000);

// ---------- ritenuta dei compensi sportivi: solo oltre i 15.000 € dell'anno ----------
const _soldiOre=soldiOre;let SPC={k:'',m:{}};
function sportMap(){
  const k=DB.meta.seq+'|'+Object.keys(D().eventi).length+'|'+soglia('sport15');if(SPC.k===k)return SPC.m;
  const L=[];for(const e of eventi()){if(!e.ore)continue;const p=prog(e.pid);if(!p||catOf(p)!=='sportivo')continue;const s=_soldiOre(e);
    const mi=meseIncasso(e.pid,e.data.slice(0,7),'o');L.push({id:e.id,y:mi.slice(0,4),ord:mi+e.data+(e.created||0),lordo:s.lordo,pct:s.rp});}
  L.sort((a,b)=>a.ord.localeCompare(b.ord));const T=soglia('sport15');const cum={};const m={};
  for(const x of L){const b=cum[x.y]||0,a=b+x.lordo;cum[x.y]=a;m[x.id]=r2(Math.max(0,a-Math.max(T,b))*x.pct/100);}
  SPC={k,m};return m;
}
soldiOre=function(e){const s=_soldiOre(e);if(!e.ore)return s;const p=prog(e.pid);if(catOf(p)!=='sportivo')return s;
  const rit=sportMap()[e.id]??0;return {...s,rit,netto:r2(s.lordo-rit),rp:s.lordo?Math.round(rit/s.lordo*10000)/100:0,pct:s.rp};};

// ---------- soglie dell'anno ----------
soglieAnno=function(y){const A=aggrega(y);const lordo={};for(const t of Object.values(A.per)){const c=catOf(t.p);lordo[c]=r2((lordo[c]||0)+t.lordo);}
  return impost().soglie.map(s=>({...s,usato:lordo[s.cat]||0}));};
soglieHtml=function(y){
  const A=aggrega(y);const lordo={};for(const t of Object.values(A.per)){if(!t.lordo)continue;const c=catOf(t.p);lordo[c]=r2((lordo[c]||0)+t.lordo);}
  const altri=Object.values(A.per).filter(t=>t.lordo&&catOf(t.p)==='altro').map(t=>t.p.nome);
  let h=`<div class="kv big" style="padding-top:0"><span>Compensi lordi ${y}</span><b>${eur(A.tot.lordo)}</b></div>
    <p class="muted sm" style="margin:2px 0 6px">Prima della ritenuta, <b>rimborsi spese esclusi</b> (${eur(A.tot.rimb)} a parte). Contati nell’anno in cui vieni pagato.</p>`+
    Object.entries(lordo).map(([c,v])=>`<div class="kv"><span>${CAT_NOMI[c]}</span><b>${eur(v)}</b></div>`).join('');
  h+=soglieAnno(y).filter(s=>lordo[s.cat]!==undefined||s.cat==='occasionale').map(s=>{const pc=s.limite?s.usato/s.limite*100:0;const cls=pc>=100?'bad':pc>=80?'warn':'';
    return `<div class="soglia ${cls}"><div class="sh"><b>${esc(s.nome)}</b><span>${eur(s.usato)} di ${eur(s.limite)}</span></div><div class="meter"><i style="width:${Math.min(100,pc).toFixed(1)}%"></i></div><small>${pc>=100?'Soglia superata: parlane con il commercialista.':pc>=80?`Sei all’${Math.round(pc)}%: ti mancano ${eur(s.limite-s.usato)}.`:`Ti mancano ${eur(s.limite-s.usato)}.`}</small></div>`;}).join('');
  if(altri.length)h+=`<div class="note">${esc(altri.join(', '))}: tipo “Altro”, non conta nelle soglie. Se è una prestazione occasionale o un compenso sportivo, cambialo nel progetto.</div>`;
  return h+'<p class="muted sm">Il tipo di compenso si sceglie in ogni progetto. Importi delle soglie modificabili in Progetti → Impostazioni: verificali con il commercialista.</p>';
};

// ---------- elenco dei pagamenti e delle attività dell'anno ----------
function elencoPagamenti(y){
  const out=[];
  for(const ym of [...new Set(eventi().map(e=>e.data.slice(0,7)))].sort()){
    for(const [pid,t] of Object.entries(riepilogo(ym).per)){if(!t.n)continue;
      for(const [tp,val] of [['o',t.lordo],['r',t.rimb]]){if(!val)continue;const mi=meseIncasso(pid,ym,tp);if(!mi.startsWith(y))continue;
        const g=pagamenti()[`${pid}|${ym}|${tp}`];
        out.push({pid,p:t.p,ym,tp,mi,data:g?.pagato&&g.data?g.data:null,ore:tp==='o'?t.ore:0,lordo:tp==='o'?t.lordo:0,rit:tp==='o'?t.rit:0,netto:tp==='o'?t.netto:0,rimb:tp==='r'?t.rimb:0,km:tp==='r'?t.km:0});}}}
  return out.sort((a,b)=>(a.data||a.mi+'-99').localeCompare(b.data||b.mi+'-99')||a.p.nome.localeCompare(b.p.nome));
}
const quandoPag=it=>it.data?dIt(it.data):`previsto ${it.mi.slice(5)}/${it.mi.slice(0,4)}`;
function attivitaAnno(y){
  const ok=new Set(elencoPagamenti(y).map(i=>`${i.pid}|${i.ym}|${i.tp}`));
  return eventiDel(e=>ok.has(`${e.pid}|${e.data.slice(0,7)}|o`)||ok.has(`${e.pid}|${e.data.slice(0,7)}|r`)).map(e=>{
    const ym=e.data.slice(0,7),o=ok.has(`${e.pid}|${ym}|o`),r=ok.has(`${e.pid}|${ym}|r`);const s=soldiOre(e);const p=prog(e.pid);
    const rate=p.rimborso?.attivo?(+meseExtra(e.pid,ym).tariffa||0):0;
    const rimb=r?r2(kmOf(e)*rate+(e.spese||[]).reduce((a,x)=>a+(+x.importo||0),0)):0;
    return {e,p,data:e.data,att:etichetta(e),orari:e.ore?(isFisso(e)?'compenso fisso':(e.fasce||[]).map(f=>f.da+'–'+f.a).join(' ')):'',ore:o?s.ore:0,km:r?kmOf(e):0,lordo:o?s.lordo:0,rit:o?s.rit:0,netto:o?s.netto:0,rimb};});
}

// ---------- resoconto completo per il commercialista (PDF + CSV) ----------
function pagineReport(y){
  const pr=D().profilo;const A=aggrega(y);const items=elencoPagamenti(y);const att=attivitaAnno(y);
  const W=714,TOP=46,AV=1123-TOP-56,RH=18;const pages=[];let box,used=AV+1;
  const nuova=()=>{const pg=newPage();box=el('div',`position:absolute;left:40px;top:${TOP}px;width:${W}px;font-family:system-ui,Arial,sans-serif;color:#111;font-size:8.4pt;line-height:1.25`);pg.appendChild(box);pages.push(pg);used=0;};
  const put=(html,h)=>{if(used+h>AV)nuova();box.insertAdjacentHTML('beforeend',html);used+=h;};
  const row=(cols,vals,st='')=>`<div style="display:grid;grid-template-columns:${cols.map(c=>c.w+'px').join(' ')};height:${RH}px;align-items:center;border-bottom:1px solid #d8dedc;${st}">${vals.map((v,i)=>`<span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px;text-align:${cols[i].al||'left'}">${v}</span>`).join('')}</div>`;
  const sezione=(titolo,cols,rows,foot,nota)=>{
    put(`<div style="font:700 11.5pt system-ui,Arial;color:#2a2c30;margin:14px 0 4px">${titolo}</div>`+(nota?`<div style="color:#555;margin-bottom:4px">${nota}</div>`:''),nota?44:32);
    const head=row(cols,cols.map(c=>`<b>${c.t}</b>`),'background:#ecebe8;border-bottom:1.5px solid #2a2c30');put(head,RH);
    for(const r of rows){if(used+RH>AV){nuova();put(head,RH);}put(row(cols,r),RH);}
    if(foot)put(row(cols,foot.map(v=>`<b>${v}</b>`),'background:#f3f6f5;border-bottom:1.5px solid #2a2c30'),RH);
  };
  nuova();
  put(`<div style="font:700 17pt system-ui,Arial;color:#2a2c30">Riepilogo compensi e rimborsi ${y}</div>
    <div style="margin:3px 0 2px;font-size:9.5pt">${esc([pr.nome,pr.cognome].filter(Boolean).join(' '))}${pr.cf?' · C.F. '+esc(pr.cf):''} · creato con Soldirini il ${new Date().toLocaleDateString('it-IT')}</div>
    <div style="color:#444">Conteggio per <b>data di pagamento</b> (principio di cassa): se il pagamento non è segnato si usa il mese previsto per il progetto. Compensi e ritenute sono separati dai <b>rimborsi spese</b>, che non sono reddito.</div>`,78);
  const ps=Object.values(A.per).filter(t=>t.lordo||t.rimb);
  sezione('1 · Per committente',[{t:'Committente',w:148},{t:'Tipo',w:130},{t:'Ore',w:46,al:'right'},{t:'Lordo',w:78,al:'right'},{t:'Ritenuta',w:74,al:'right'},{t:'Netto',w:78,al:'right'},{t:'Rimborsi spese',w:80,al:'right'},{t:'Incassato',w:80,al:'right'}],
    ps.map(t=>[esc(t.p.nome),t.p.ore.attivo?CAT_NOMI[catOf(t.p)]+(t.p.ore.attivo&&catOf(t.p)!=='sportivo'?` ${nf(t.p.ore.ritenuta)}%`:''):'Solo rimborsi',t.ore?nf(t.ore):'',eur(t.lordo),eur(t.rit),eur(t.netto),eur(t.rimb),eur(r2(t.netto+t.rimb))]),
    ['Totale','',nf(A.tot.ore),eur(A.tot.lordo),eur(A.tot.rit),eur(A.tot.netto),eur(A.tot.rimb),eur(r2(A.tot.netto+A.tot.rimb))]);
  const sg=soglieAnno(y).filter(s=>s.usato||s.cat==='occasionale');
  sezione('2 · Soglie',[{t:'Soglia',w:360},{t:'Compensi lordi',w:120,al:'right'},{t:'Limite',w:110,al:'right'},{t:'Stato',w:124}],
    sg.map(s=>[esc(s.nome),eur(s.usato),eur(s.limite),s.usato>s.limite?'<b style="color:#b42318">superata</b>':`mancano ${eur(s.limite-s.usato)}`]));
  sezione(`3 · Elenco pagamenti ${y}`,[{t:'Pagato il',w:96},{t:'Committente',w:134},{t:'Mese lavorato',w:84},{t:'Voce',w:94},{t:'Lordo',w:76,al:'right'},{t:'Ritenuta',w:70,al:'right'},{t:'Netto',w:78,al:'right'},{t:'Rimborso',w:82,al:'right'}],
    items.map(i=>[quandoPag(i),esc(i.p.nome),MESI[+i.ym.slice(5)-1].slice(0,3)+' '+i.ym.slice(0,4),i.tp==='o'?'Compensi':'Rimborso spese',i.lordo?eur(i.lordo):'',i.rit?eur(i.rit):'',i.netto?eur(i.netto):'',i.rimb?eur(i.rimb):'']),
    ['Totale','','','',eur(A.tot.lordo),eur(A.tot.rit),eur(A.tot.netto),eur(A.tot.rimb)],'“previsto”: pagamento non ancora segnato, contato nel mese in cui di solito arriva.');
  sezione('4 · Dettaglio attività',[{t:'Data',w:62},{t:'Committente',w:104},{t:'Attività',w:150},{t:'Orari',w:94},{t:'Ore',w:34,al:'right'},{t:'Km',w:40,al:'right'},{t:'Lordo',w:60,al:'right'},{t:'Ritenuta',w:56,al:'right'},{t:'Netto',w:58,al:'right'},{t:'Rimborso',w:56,al:'right'}],
    att.map(a=>[dIt(a.data),esc(a.p.nome),esc(a.att),esc(a.orari),a.ore?nf(a.ore):'',a.km?nf(a.km,1):'',a.lordo?nf(a.lordo,2):'',a.rit?nf(a.rit,2):'',a.netto?nf(a.netto,2):'',a.rimb?nf(a.rimb,2):'']));
  put(`<div style="color:#555;margin-top:12px">Compensi sportivi: ritenuta calcolata solo sulla parte oltre ${eur(soglia('sport15'))} dell’anno (somma di tutti i compensi sportivi). Il rimborso del mese può comprendere anche spese inserite a mano (pedaggi, pasti…), quindi la somma del dettaglio può differire di poco dall’elenco pagamenti. Dati inseriti dall’utente: da verificare con le Certificazioni Uniche.</div>`,60);
  pages.forEach((pg,i)=>pg.appendChild(el('div',`position:absolute;left:40px;right:40px;bottom:22px;font:8pt system-ui,Arial;color:#777;display:flex;justify-content:space-between`,`<span>${esc([pr.nome,pr.cognome].filter(Boolean).join(' '))} · Riepilogo ${y}</span><span>pagina ${i+1} di ${pages.length}</span>`)));
  return pages;
}
pdfAnnoBytes=async function(y){return {bytes:await pagesToPdf(pagineReport(y)),name:`Riepilogo ${y} per il commercialista.pdf`};};
function csvAnno(y){
  const A=aggrega(y);const n=v=>v?String(r2(v)).replace('.',','):'';const q=s=>`"${String(s??'').replace(/"/g,'""')}"`;
  const L=[[`Riepilogo ${y} – ${[D().profilo.nome,D().profilo.cognome].filter(Boolean).join(' ')}`],[],['PER COMMITTENTE'],['Committente','Tipo','Ore','Lordo','Ritenuta','Netto','Rimborsi spese','Incassato']];
  for(const t of Object.values(A.per).filter(t=>t.lordo||t.rimb))L.push([t.p.nome,t.p.ore.attivo?CAT_NOMI[catOf(t.p)]:'Solo rimborsi',n(t.ore),n(t.lordo),n(t.rit),n(t.netto),n(t.rimb),n(t.netto+t.rimb)]);
  L.push(['Totale','',n(A.tot.ore),n(A.tot.lordo),n(A.tot.rit),n(A.tot.netto),n(A.tot.rimb),n(A.tot.netto+A.tot.rimb)],[],['ELENCO PAGAMENTI'],['Pagato il','Committente','Mese lavorato','Voce','Lordo','Ritenuta','Netto','Rimborso']);
  for(const i of elencoPagamenti(y))L.push([quandoPag(i),i.p.nome,monthName(i.ym),i.tp==='o'?'Compensi':'Rimborso spese',n(i.lordo),n(i.rit),n(i.netto),n(i.rimb)]);
  L.push([],['DETTAGLIO ATTIVITÀ'],['Data','Committente','Attività','Orari','Ore','Km','Lordo','Ritenuta','Netto','Rimborso']);
  for(const a of attivitaAnno(y))L.push([dIt(a.data),a.p.nome,a.att,a.orari,n(a.ore),n(a.km),n(a.lordo),n(a.rit),n(a.netto),n(a.rimb)]);
  return '﻿'+L.map(r=>r.map(q).join(';')).join('\r\n');
}

// ---------- tasse: quanto mettere da parte ----------
const SCAGLIONI=y=>(+y>=2026?[[28000,23],[50000,33],[Infinity,43]]:[[28000,23],[50000,35],[Infinity,43]]);
function irpef(x,y){let t=0,prev=0;for(const [lim,al] of SCAGLIONI(y)){if(x>prev)t+=(Math.min(x,lim)-prev)*al/100;prev=lim;}return t;}
const tasseImp=y=>{const I=impost();I.tasse=I.tasse||{};return Object.assign({altri:'',add:2.5},I.tasse[y]||{});};
const cuList=y=>Object.values(D().cu||{}).filter(c=>!c.deleted&&(!y||String(c.anno)===String(y))).sort((a,b)=>(a.tipo+a.comm).localeCompare(b.tipo+b.comm));
function stimaTasse(y){
  const A=aggrega(y);const T=tasseImp(y);const by={occasionale:0,sportivo:0,altro:0};
  for(const t of Object.values(A.per))by[catOf(t.p)]=r2(by[catOf(t.p)]+t.lordo);
  const dip=cuList(y).filter(c=>c.tipo==='dipendente');
  const altri=dip.length?dip.reduce((a,c)=>a+(+c.p1||0),0):itNumParse(T.altri);
  const sportEcc=Math.max(0,by.sportivo-soglia('sport15'));
  const imp=r2(by.occasionale+by.altro+sportEcc);
  const irp=r2(irpef(altri+imp,y)-irpef(altri,y));const add=r2(imp*(+String(T.add).replace(',','.')||0)/100);
  const rit=A.tot.rit;const saldo=r2(irp+add-rit);
  const t=new Date();const mesiRest=String(t.getFullYear())===String(y)?12-t.getMonth():12;
  return {A,by,altri,daCU:!!dip.length,sportEcc,imp,irp,add,rit,saldo,mesiRest,T};
}

// ---------- Certificazioni Uniche ----------
async function leggiCU(file){
  if(!window.pdfjsLib){await loadScript('lib/pdf.min.js');}
  pdfjsLib.GlobalWorkerOptions.workerSrc='lib/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const it=[];for(let n=1;n<=Math.min(pdf.numPages,10);n++){const pg=await pdf.getPage(n);const c=await pg.getTextContent();
    for(const x of c.items){const s=(x.str||'').trim();if(s)it.push({s,x:x.transform[4],y:x.transform[5],w:x.width||0,p:n});}}
  const testo=it.map(i=>i.s).join(' ');
  const isNum=s=>/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)||/^\d+,\d{2}$/.test(s);
  // numero più vicino sotto (o a destra di) un'etichetta
  const vicino=(re,filtro)=>{let best=null;
    for(const l of it.filter(i=>re.test(i.s)&&(!filtro||filtro(i)))){
      for(const v of it){if(v.p!==l.p||!isNum(v.s))continue;const dy=l.y-v.y,dx=v.x-l.x;
        const ok=(dy>=-2&&dy<40&&dx>-15&&dx<200)||(Math.abs(dy)<3&&dx>0&&dx<260);if(!ok)continue;const d=Math.abs(dy)*2+Math.abs(dx)*.5;if(!best||d<best.d)best={d,v:v.s};}
      if(best)return best.v;}
    return null;};
  const pagAut=new Set(it.filter(i=>/ammontare lordo corrisposto/i.test(i.s)).map(i=>i.p));
  const r={};
  const m=/CERTIFICAZIONE\s+UNICA\s*(20\d\d)/i.exec(testo);const m2=/periodo d.imposta\s*(20\d\d)/i.exec(testo);
  r.anno=m2?+m2[1]:m?+m[1]-1:new Date().getFullYear()-1;
  r.p4=vicino(/ammontare lordo corrisposto/i);r.p7=vicino(/altre somme non soggette/i,i=>pagAut.has(i.p));
  r.p8=vicino(/^imponibile$/i,i=>pagAut.has(i.p))||vicino(/imponibile/i,i=>pagAut.has(i.p));r.p9=vicino(/ritenute a titolo d.acconto/i,i=>pagAut.has(i.p));
  r.p1=vicino(/redditi di lavoro dipendente|lavoro dipendente e assimilati/i);r.p21=vicino(/^ritenute irpef$/i)||vicino(/ritenute irpef/i);
  const cz=/causale[^A-Z0-9]{0,20}\b([A-Z]{1,2}\d?)\b/.exec(testo);r.causale=cz?cz[1]:'';
  // denominazione del sostituto: testo dopo l'etichetta
  const den=it.find(i=>/cognome o denominazione|denominazione/i.test(i.s));
  if(den){const c=it.filter(v=>v.p===den.p&&den.y-v.y>2&&den.y-v.y<30&&Math.abs(v.x-den.x)<120&&!/[0-9]{5}/.test(v.s)).sort((a,b)=>b.y-a.y)[0];r.comm=c?.s||'';}
  r.tipo=r.p4?'autonomo':(r.p1?'dipendente':'autonomo');
  r.trovati=['p4','p7','p8','p9','p1','p21'].filter(k=>r[k]).length;
  return r;
}
let cuEd=null;
function openCU(c,daPdf){
  cuEd=c?clone(c):{id:uid(),tipo:'autonomo',anno:+cur.slice(0,4),comm:'',pid:'',p4:'',p7:'',p8:'',p9:'',p1:'',p21:'',causale:''};
  const x=cuEd;$('cuTitle').textContent=c&&!daPdf?'Certificazione Unica':'Nuova Certificazione Unica';
  $('cuTipo').value=x.tipo;$('cuAnno').value=x.anno;$('cuComm').value=x.comm||'';$('cuCaus').value=x.causale||'';
  $('cuPid').innerHTML='<option value="">— nessun progetto —</option>'+progetti().map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');$('cuPid').value=x.pid||'';
  for(const k of ['p4','p7','p8','p9','p1','p21'])$('cu-'+k).value=x[k]===''||x[k]==null?'':nf(x[k],2);
  $('cuMsg').innerHTML=daPdf?(x.trovati?`Ho letto <b>${x.trovati}</b> importi dal PDF. <b>Controllali</b> con il documento: ogni società usa un’impaginazione diversa.`:'Non sono riuscito a leggere gli importi da questo PDF: inseriscili guardando il documento (punti 4, 7, 8, 9).'):'';
  $('cuDel').hidden=!(c&&D().cu?.[c.id]);togCU();$('cuModal').hidden=false;document.body.classList.add('noscroll');
}
function togCU(){const d=$('cuTipo').value==='dipendente';$('cuAut').hidden=d;$('cuDip').hidden=!d;$('cuPidRow').hidden=d;}
function saveCU(){
  const x=cuEd;x.tipo=$('cuTipo').value;x.anno=+$('cuAnno').value||+cur.slice(0,4);x.comm=$('cuComm').value.trim();x.causale=$('cuCaus').value.trim();x.pid=$('cuPid').value;
  for(const k of ['p4','p7','p8','p9','p1','p21'])x[k]=$('cu-'+k).value.trim()===''?'':itNumParse($('cu-'+k).value);
  if(x.tipo==='autonomo'&&x.p4===''){toast('Manca il punto 4 (ammontare lordo).','err');return;}
  if(x.tipo==='dipendente'&&x.p1===''){toast('Manca il reddito di lavoro dipendente (punto 1).','err');return;}
  delete x.trovati;x.updatedAt=Date.now();(D().cu||(D().cu={}))[x.id]=x;
  logStorico('CU',`Certificazione Unica ${x.anno} ${x.comm||(prog(x.pid)?.nome)||''} salvata`);
  closeCU();changed();render();toast('Certificazione Unica salvata');
  if(x._file&&!DEMO&&navigator.onLine&&tokenOk()&&D().root?.id){const f=x._file;delete x._file;uploadNew({name:`CU ${x.anno} ${x.comm||'lavoro dipendente'}.pdf`,parents:[D().root.id],mimeType:'application/pdf'},f,'application/pdf').then(r=>{x.fileLink=r.webViewLink;x.updatedAt=Date.now();changed();}).catch(()=>{});}
  delete x._file;
}
async function delCU(){if(!await conferma('Elimino questa Certificazione Unica dall’app?','Elimina','danger'))return;D().cu[cuEd.id]={id:cuEd.id,deleted:true,updatedAt:Date.now()};closeCU();changed();render();}
function closeCU(){$('cuModal').hidden=true;document.body.classList.remove('noscroll');}
function confrontoCU(c){
  const t=aggrega(String(c.anno)).per[c.pid];if(!t)return '<p class="muted sm">Collega la CU a un progetto per confrontarla.</p>';
  const ok=(a,b)=>Math.abs((+a||0)-(+b||0))<1;const r=(lab,app,cu,nota)=>`<div class="cmp ${cu===''?'':ok(app,cu)?'ok':'ko'}"><span>${lab}</span><b>${eur(app)}</b><b>${cu===''?'—':eur(cu)}</b><em>${cu===''?'':ok(app,cu)?'✓':`${(+cu||0)>app?'+':'−'}${eur(Math.abs((+cu||0)-app))}`}</em></div>${nota?`<p class="muted sm cmpn">${nota}</p>`:''}`;
  const sportivo=catOf(t.p)==='sportivo';
  let note4='';if(!ok(t.lordo,c.p4)&&ok(r2(t.lordo+t.rimb),c.p4))note4='Il punto 4 comprende anche i rimborsi spese: quindi torna.';
  let h=`<div class="cmp head"><span></span><b>Soldirini</b><b>CU</b><em></em></div>`+
    r('Compensi lordi (punto 4)',t.lordo,c.p4,note4)+
    r('Somme non soggette (punto 7)',sportivo?Math.min(t.lordo,soglia('sport15'))+t.rimb:t.rimb,c.p7,sportivo?'Per i compensi sportivi di solito la parte esente e i rimborsi.':'Di solito i rimborsi spese.')+
    r('Imponibile (punto 8)',sportivo?Math.max(0,t.lordo-soglia('sport15')):t.lordo,c.p8)+
    r('Ritenute d’acconto (punto 9)',t.rit,c.p9);
  const bad=[['p4',t.lordo],['p9',t.rit]].some(([k,v])=>c[k]!==''&&!ok(v,c[k]))&&!note4;
  h+=bad?`<div class="note">I numeri non tornano. Controlla l’elenco qui sotto: forse un mese è stato pagato in un altro anno (cambia la data in “Entrati”), manca un’attività o la percentuale è diversa.</div>`:'';
  const L=elencoPagamenti(String(c.anno)).filter(i=>i.pid===c.pid);
  h+=`<details class="extra"><summary>Pagamenti ${c.anno} di ${esc(t.p.nome)} (${L.length})</summary>${L.map(i=>`<div class="due" style="--c:${t.p.colore}"><span class="bar"></span><span class="tx"><b>${i.tp==='o'?'Compensi':'Rimborso'} ${esc(monthName(i.ym))}</b><small>${quandoPag(i)}</small></span><b class="amt">${eur(i.tp==='o'?i.lordo:i.rimb)}</b><button class="btn ghost sm" data-unpag="${i.pid}|${i.ym}|${i.tp}">Data</button></div>`).join('')}</details>`;
  return h;
}

// ---------- scheda Tasse ----------
function renderTasse(){
  const y=cur.slice(0,4);$('tasTitle').textContent='Tasse '+y;
  const S=stimaTasse(y);let h='';
  const verdetto=S.saldo>0?`Da mettere da parte: ${eur(S.saldo)}`:S.saldo<0?`Probabile rimborso: ${eur(-S.saldo)}`:'In pari';
  h+=`<div class="card" data-sum="${S.saldo>0?eur(S.saldo):'—'}" data-fid="stima"><h3>Quanto mettere da parte</h3>
    <div class="hero small"><div><small>${y}</small><b>${verdetto}</b></div>${S.saldo>0&&S.mesiRest?`<div><small>Al mese, da qui a dicembre</small><b>${eur(r2(S.saldo/S.mesiRest))}</b></div>`:''}${S.saldo>0&&S.A.tot.netto?`<div><small>Cioè circa</small><b>${Math.round(S.saldo/S.A.tot.netto*100)}% di ogni compenso netto</b></div>`:''}</div>
    <div class="kv"><span>Prestazioni occasionali</span><b>${eur(S.by.occasionale)}</b></div>
    ${S.by.sportivo?`<div class="kv"><span>Compensi sportivi (esenti fino a ${eur(soglia('sport15'))})</span><b>${eur(S.by.sportivo)}</b></div>`:''}
    ${S.by.altro?`<div class="kv"><span>Altri compensi</span><b>${eur(S.by.altro)}</b></div>`:''}
    <div class="kv"><span>Reddito tassabile da Soldirini</span><b>${eur(S.imp)}</b></div>
    <div class="kv"><span>IRPEF in più stimata${S.altri?' (sopra il lavoro dipendente)':''}</span><b>${eur(S.irp)}</b></div>
    <div class="kv"><span>Addizionali regionale e comunale (${nf(+String(S.T.add).replace(',','.'))}%)</span><b>${eur(S.add)}</b></div>
    <div class="kv"><span>Ritenute già trattenute</span><b>− ${eur(S.rit)}</b></div>
    <div class="kv big"><span>${S.saldo>=0?'Probabile da pagare':'Probabile a credito'}</span><b>${eur(Math.abs(S.saldo))}</b></div>
    <div class="g2" style="margin-top:8px"><label>Altri redditi ${y} (lavoro dipendente) €<input inputmode="decimal" id="tasAltri" value="${S.daCU?nf(S.altri,2):esc(S.T.altri)}" ${S.daCU?'disabled':''} placeholder="es. 18000"></label>
      <label>Addizionali %<input inputmode="decimal" id="tasAdd" value="${esc(S.T.add)}"></label></div>
    <p class="muted sm">${S.daCU?'Altri redditi presi dalle tue CU di lavoro dipendente.':'Il lavoro a tempo determinato o indeterminato non lo segni in Soldirini: scrivi qui il reddito annuo (o carica la sua CU) così la stima usa lo scaglione giusto.'}</p>
    ${S.by.occasionale>soglia('occ5')?`<div class="note">Hai superato ${eur(soglia('occ5'))} di prestazioni occasionali: sulla parte oltre scattano i contributi INPS (Gestione Separata), in parte a tuo carico. Non sono in questa stima.</div>`:''}
    ${S.by.sportivo>soglia('sport5')?`<div class="note">Compensi sportivi oltre ${eur(soglia('sport5'))}: sulla parte oltre scattano i contributi INPS. Non sono in questa stima.</div>`:''}
    <p class="muted sm">Stima indicativa con le aliquote IRPEF ${+y>=2026?'2026 (23%, 33%, 43%)':'2025 (23%, 35%, 43%)'}. Non considera detrazioni, deduzioni e contributi: verifica con il commercialista.</p></div>`;
  const cus=cuList(y);const aut=cus.filter(c=>c.tipo==='autonomo');
  const esiti=aut.map(c=>{const t=aggrega(String(c.anno)).per[c.pid];return t&&Math.abs(t.lordo-(+c.p4||0))<1&&Math.abs(t.rit-(+c.p9||0))<1;});
  h+=`<div class="card" data-fid="cu" data-sum="${cus.length?`${cus.length} CU${aut.length?` · ${esiti.filter(Boolean).length}/${aut.length} ok`:''}`:'—'}"><h3>Certificazioni Uniche</h3>
    <p class="muted sm" style="margin-top:0">Carica il PDF di ogni CU che ricevi: leggo gli importi e li confronto con i pagamenti segnati qui. Le CU del lavoro dipendente servono solo per la stima delle tasse.</p>
    <div class="acts"><label class="btn filebtn">Carica CU (PDF)<input type="file" id="cuFile" accept="application/pdf" hidden></label><button class="btn ghost" id="cuMan">Inserisci a mano</button></div>
    ${cus.map(c=>{const p=prog(c.pid);return `<div class="cuitem"><div class="cuh"><b>${esc(c.comm||p?.nome||'CU')}</b><span class="muted sm">${c.tipo==='dipendente'?'lavoro dipendente':'lavoro autonomo'}${c.causale?' · causale '+esc(c.causale):''}${p?' · '+esc(p.nome):''}</span><button class="btn ghost sm" data-cuedit="${c.id}">Modifica</button>${c.fileLink?`<a class="btn ghost sm" href="${esc(c.fileLink)}" target="_blank" rel="noopener">PDF ↗</a>`:''}</div>
      ${c.tipo==='dipendente'?`<p class="muted sm">Reddito ${eur(c.p1)} · ritenute IRPEF ${eur(c.p21||0)}. Non lo confronto: il lavoro dipendente non è in Soldirini.</p>`:confrontoCU(c)}</div>`;}).join('')||'<p class="muted sm">Nessuna CU per il '+y+'.</p>'}</div>`;
  $('tasList').innerHTML=h;foldify($('tasList'),'tas');
}

// ---------- cestino e storico ----------
function logStorico(a,d){const L=D().storico||(D().storico=[]);L.push({id:uid(),t:Date.now(),a,d});if(L.length>400)L.splice(0,L.length-400);}
const GG30=30*864e5;
function cestino(){const now=Date.now();
  const ev=Object.values(D().eventi).filter(e=>e.deleted&&e.deletedAt&&now-e.deletedAt<GG30&&e.tipo);
  const pr=Object.values(D().progetti).filter(p=>p.deleted&&p.deletedAt&&now-p.deletedAt<GG30);
  return {ev:ev.sort((a,b)=>b.deletedAt-a.deletedAt),pr};}
function svuotaVecchi(){const now=Date.now();for(const [id,e] of Object.entries(D().eventi))if(e.deleted&&e.deletedAt&&now-e.deletedAt>=GG30&&e.tipo)D().eventi[id]={id,pid:e.pid,data:e.data,deleted:true,deletedAt:e.deletedAt,updatedAt:e.updatedAt};}
function ripristina(id,kind){const now=Date.now();
  if(kind==='p'){const p=D().progetti[id];const t=p.deletedAt;delete p.deleted;delete p.deletedAt;p.updatedAt=now;
    for(const e of Object.values(D().eventi))if(e.pid===id&&e.deleted&&e.deletedAt===t&&e.tipo){delete e.deleted;delete e.deletedAt;e.updatedAt=now;markExport(exportKeysOf(e));}
    logStorico('Ripristino',`Progetto “${p.nome}” ripristinato`);}
  else{const e=D().eventi[id];delete e.deleted;delete e.deletedAt;e.updatedAt=now;markExport(exportKeysOf(e));logStorico('Ripristino',`${etichetta(e)} del ${dIt(e.data)} ripristinata`);}
  changed();render();toast('Ripristinato');}
function renderCestino(){
  const {ev,pr}=cestino();const box=$('cestBox');if(!box)return;
  box.innerHTML=(pr.map(p=>`<div class="due" style="--c:${p.colore}"><span class="bar"></span><span class="tx"><b>Progetto ${esc(p.nome)}</b><small>eliminato il ${new Date(p.deletedAt).toLocaleDateString('it-IT')}</small></span><button class="btn ghost sm" data-rip="${p.id}" data-k="p">Ripristina</button></div>`).join('')+
    ev.filter(e=>!pr.some(p=>p.id===e.pid&&p.deletedAt===e.deletedAt)).slice(0,60).map(e=>{const p=prog(e.pid);return `<div class="due" style="--c:${p?.colore||'#888'}"><span class="bar"></span><span class="tx"><b>${esc(etichetta(e))}</b><small>${dIt(e.data)} · ${esc(p?.nome||'')} · eliminata il ${new Date(e.deletedAt).toLocaleDateString('it-IT')}</small></span><button class="btn ghost sm" data-rip="${e.id}" data-k="e">Ripristina</button></div>`;}).join(''))||'<p class="muted sm">Il cestino è vuoto.</p>';
  const L=(D().storico||[]).slice(-120).reverse();
  $('storBox').innerHTML=L.map(x=>`<div class="stor"><span class="muted sm">${new Date(x.t).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span><span><b>${esc(x.a)}</b> · ${esc(x.d)}</span></div>`).join('')||'<p class="muted sm">Ancora nessuna modifica registrata.</p>';
}
// registro le azioni principali
const _saveEv5=saveEv;saveEv=async function(){const nuovo=!md.id;const e=readEv();const n=md.dates.length;const lab=`${etichetta(e)} · ${prog(e.pid)?.nome||''}`;const d0=md.dates[0]||$('evDate').value;
  await _saveEv5();if($('evModal').hidden){logStorico(nuovo?'Aggiunta':'Modifica',`${lab} · ${dIt(d0)}${nuovo&&n>1?` e altri ${n-1} giorni`:''}`);persist();}};
const _delEv5=delEv;delEv=async function(){const id=md?.id;const e=id&&D().eventi[id];const lab=e?`${etichetta(e)} · ${dIt(e.data)}`:'';await _delEv5();if(id&&D().eventi[id]?.deleted){logStorico('Eliminata',lab+' (nel cestino per 30 giorni)');persist();}};
const _setPag5=setPagato;setPagato=function(key,on,data){const [pid,ym,t]=key.split('|');logStorico('Pagamento',`${prog(pid)?.nome||''} ${t==='r'?'rimborso':'compensi'} ${monthName(ym)}: ${on?'pagato il '+dIt(data||today()):'non pagato'}`);return _setPag5(key,on,data);};
const _saveProj5=saveProj;saveProj=function(){const nuovo=pe.isNew;const nome=$('pjNome').value.trim();_saveProj5();if($('pjModal').hidden){logStorico(nuovo?'Nuovo progetto':'Progetto',`${nome}${nuovo?' creato':' modificato'}`);persist();}};
const _delProj5=delProj;delProj=async function(){const p=pe.p;await _delProj5();if(D().progetti[p.id]?.deleted){logStorico('Progetto eliminato',`${p.nome} (nel cestino per 30 giorni)`);persist();}};

// ---------- blocco con PIN o impronta (solo su questo dispositivo) ----------
const LOCKK='soldirini-lock';
const lockCfg=()=>{try{return JSON.parse(localStorage.getItem(LOCKK)||'null');}catch(e){return null;}};
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b)));const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function hashPin(pin,salt){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pin));return b64u(d);}
let bloccato=false,nascostoDa=0;
function blocca(){const c=lockCfg();if(!c)return;bloccato=true;$('lock').hidden=false;$('lockPin').value='';$('lockBio').hidden=!c.bio;$('lockErr').textContent='';document.body.classList.add('noscroll');}
function sblocca(){bloccato=false;$('lock').hidden=true;document.body.classList.remove('noscroll');}
async function provaPin(){const c=lockCfg();if(!c)return sblocca();if(await hashPin($('lockPin').value.trim(),c.salt)===c.hash)sblocca();else{$('lockErr').textContent='PIN sbagliato.';$('lockPin').value='';}}
async function provaBio(){const c=lockCfg();if(!c?.bio)return;try{await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:unb64(c.bio)}],userVerification:'required',timeout:60000}});sblocca();}catch(e){$('lockErr').textContent='Impronta non riconosciuta: usa il PIN.';}}
async function impostaPin(){
  const v=await ask(`Scegli un PIN di 4–8 cifre. Serve solo su questo dispositivo; se lo dimentichi esci dall’account e rientra (i dati sono su Drive).<input type="password" inputmode="numeric" id="pin1" placeholder="PIN" style="margin-top:10px"><input type="password" inputmode="numeric" id="pin2" placeholder="Ripeti il PIN" style="margin-top:8px">`,[{t:'Annulla',v:false,cls:'ghost'},{t:'Imposta',v:true}],true);
  if(!v)return;const a=$('pin1').value.trim(),b=$('pin2').value.trim();
  if(!/^\d{4,8}$/.test(a)){toast('Il PIN deve avere da 4 a 8 cifre.','err');return;}if(a!==b){toast('I due PIN non coincidono.','err');return;}
  const salt=b64u(crypto.getRandomValues(new Uint8Array(12)));localStorage.setItem(LOCKK,JSON.stringify({salt,hash:await hashPin(a,salt),bio:lockCfg()?.bio||null}));renderSicurezza();toast('PIN impostato: Soldirini si blocca quando la riapri.');}
async function togliPin(){const c=lockCfg();if(!c)return;
  const v=await ask('Per togliere il blocco scrivi il PIN attuale.<input type="password" inputmode="numeric" id="pin1" style="margin-top:10px">',[{t:'Annulla',v:false,cls:'ghost'},{t:'Togli blocco',v:true,cls:'danger'}],true);
  if(!v)return;if(await hashPin($('pin1').value.trim(),c.salt)!==c.hash){toast('PIN sbagliato.','err');return;}localStorage.removeItem(LOCKK);renderSicurezza();toast('Blocco tolto');}
async function attivaBio(on){const c=lockCfg();if(!c){toast('Prima imposta un PIN.','err');renderSicurezza();return;}
  if(!on){c.bio=null;localStorage.setItem(LOCKK,JSON.stringify(c));renderSicurezza();return;}
  try{const cred=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Soldirini',id:location.hostname},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'soldirini',displayName:'Soldirini'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},timeout:60000}});
    c.bio=b64u(cred.rawId);localStorage.setItem(LOCKK,JSON.stringify(c));toast('Impronta o volto attivati');}catch(e){toast('Il dispositivo non ha attivato l’impronta: resta il PIN.','err');}
  renderSicurezza();}
async function renderSicurezza(){const c=lockCfg();const box=$('sicBox');if(!box)return;
  let bio=false;try{bio=!!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());}catch(e){}
  box.innerHTML=c?`<p class="sm">Soldirini è bloccata con PIN su questo dispositivo.</p><div class="acts"><button class="btn ghost sm" id="pinCambia">Cambia PIN</button><button class="btn danger sm" id="pinTogli">Togli blocco</button></div>${bio?`<label class="check"><input type="checkbox" id="bioOn" ${c.bio?'checked':''}> Sblocca anche con impronta o volto</label>`:''}`
    :`<p class="muted sm">Proteggi i tuoi dati se qualcuno usa il telefono: Soldirini chiede il PIN quando la apri.</p><button class="btn sm" id="pinSet">Imposta PIN</button>`;}

// ---------- promemoria ----------
function promemoriaDati(){const I=impost();const t=today();const fino=ymd(new Date(Date.now()+8*864e5));
  return {on:!!I.promemoria,ora:I.oraPromemoria||'21:00',eventi:eventiDel(e=>e.stato==='previsto'&&e.data>=t&&e.data<=fino,true).map(e=>({data:e.data,testo:`${etichetta(e)} · ${prog(e.pid)?.nome||''}`}))};}
async function aggiornaPromemoriaCache(){try{if(!('caches' in window))return;const c=await caches.open('promemoria-soldirini');await c.put('promemoria.json',new Response(JSON.stringify(promemoriaDati()),{headers:{'Content-Type':'application/json'}}));}catch(e){}}
async function registraPeriodico(on){try{const reg=await navigator.serviceWorker?.ready;if(!reg||!('periodicSync' in reg))return false;
  if(!on){await reg.periodicSync.unregister('soldirini-promemoria');return true;}
  const st=await navigator.permissions.query({name:'periodic-background-sync'});if(st.state!=='granted')return false;
  await reg.periodicSync.register('soldirini-promemoria',{minInterval:4*3600*1000});return true;}catch(e){return false;}}
promemoria=async function(){
  const I=impost();if(!I.promemoria||!('Notification' in window)||Notification.permission!=='granted')return;
  const [hh,mm]=(I.oraPromemoria||'21:00').split(':').map(Number);const n=new Date();if(n.getHours()*60+n.getMinutes()<hh*60+mm)return;
  const L=eventiDel(e=>e.stato==='previsto'&&e.data===today(),true);if(!L.length)return;
  const k='soldirini-notif-'+today();try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1');}catch(e){}
  const body=L.map(e=>etichetta(e)+' · '+(prog(e.pid)?.nome||'')).join('\n')+'\nL’hai fatta? Tocca per confermare.';
  try{const reg=await navigator.serviceWorker?.getRegistration();if(reg)reg.showNotification('Soldirini',{body,icon:'soldirini-tonda-192.png',tag:'conferma-'+today()});else new Notification('Soldirini',{body,icon:'soldirini-tonda-192.png'});}catch(e){}
};
function icsPromemoria(){
  const I=impost();const ora=(I.oraPromemoria||'21:00').replace(':','')+'00';const t=today();
  const L=eventiDel(e=>e.stato==='previsto'&&e.data>=t,true).slice(0,200);if(!L.length){toast('Non ci sono attività previste da ricordare.','err');return;}
  const esc2=s=>String(s).replace(/[,;\\]/g,m=>'\\'+m).replace(/\n/g,'\\n');const st=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const ev=L.map(e=>{const d=e.data.replace(/-/g,'');const fine=String(+ora.slice(0,2)).padStart(2,'0')+String(+ora.slice(2,4)+15).padStart(2,'0')+'00';
    return ['BEGIN:VEVENT',`UID:${e.id}@soldirini`,`DTSTAMP:${st}`,`DTSTART:${d}T${ora}`,`DTEND:${d}T${+ora.slice(2,4)+15<60?fine:ora}`,`SUMMARY:${esc2('Soldirini: '+etichetta(e)+' – confermi?')}`,`DESCRIPTION:${esc2((prog(e.pid)?.nome||'')+'. Apri Soldirini e conferma se l’hai fatta.')}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M',`DESCRIPTION:${esc2('Confermi '+etichetta(e)+'?')}`,'END:VALARM','END:VEVENT'].join('\r\n');});
  download(new TextEncoder().encode(['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Soldirini//IT','CALSCALE:GREGORIAN',...ev,'END:VCALENDAR'].join('\r\n')),'Soldirini promemoria.ics','text/calendar');
  toast(`Promemoria per ${L.length} attività previste: apri il file per aggiungerli al calendario.`);
}

// ---------- estensioni di interfaccia ----------
const _render5=render;
render=function(){document.body.dataset.tab=tab;_render5();if(tab==='tas')renderTasse();aggiornaPromemoriaCache();};
const _renderRie5=renderRiepilogo;
renderRiepilogo=function(){
  _renderRie5();if(rieMode!=='anno')return;const y=cur.slice(0,4);const L=elencoPagamenti(y);
  const card=`<div class="card" data-fid="elenco" data-sum="${L.length} voci"><h3>Elenco pagamenti ${y}</h3><p class="muted sm" style="margin-top:0">Ogni pagamento contato nel ${y}, con compensi e rimborsi separati. Tocca “Data” per correggere quando ti hanno pagato.</p>
    ${L.map(i=>`<div class="due" style="--c:${i.p.colore}"><span class="bar"></span><span class="tx"><b>${esc(i.p.nome)} · ${i.tp==='o'?'compensi':'rimborso spese'} ${esc(monthName(i.ym))}</b><small>${quandoPag(i)}${i.tp==='o'?` · lordo ${eur(i.lordo)} · ritenuta ${eur(i.rit)}`:''}</small></span><b class="amt">${eur(i.tp==='o'?i.netto:i.rimb)}</b><button class="btn ghost sm" data-unpag="${i.pid}|${i.ym}|${i.tp}">Data</button></div>`).join('')||'<p class="muted">Nessun pagamento.</p>'}</div>`;
  const comm=document.querySelector('#rieAnno details[data-fold*="commercialista"]');
  if(comm)comm.insertAdjacentHTML('beforebegin',card);else $('rieAnno').insertAdjacentHTML('beforeend',card);
  foldify($('rieAnno'),'riea');
  const inv=$('pdfAnnoInv');if(inv&&!$('csvAnno'))inv.insertAdjacentHTML('afterend','<button class="btn ghost" id="csvAnno">Excel (CSV)</button>');
  const pc=document.querySelector('#rieAnno details[data-fold*="commercialista"] .fbody p');if(pc)pc.textContent=`Un PDF completo: totali per committente, soglie, elenco di tutti i pagamenti del ${y} e dettaglio di ogni attività. Il commercialista può controllare riga per riga.`;
};
const _openProj5=openProj;
openProj=function(id){_openProj5(id);$('pjCat').value=catOf(pe.p);$('pjCatInfo').textContent=CAT_INFO[catOf(pe.p)];};
const _renderProg5=renderProgetti;
renderProgetti=function(){_renderProg5();renderCestino();renderSicurezza();$('oraProm').value=impost().oraPromemoria||'21:00';};

function bind5(){
  $('evSave').onclick=()=>saveEv();$('evDel').onclick=()=>delEv();$('pjSave').onclick=()=>saveProj();$('pjDel').onclick=()=>delProj();
  $('tPrev').onclick=()=>shift(-12);$('tNext').onclick=()=>shift(12);
  $('tasList').addEventListener('change',e=>{if(!['tasAltri','tasAdd'].includes(e.target.id))return;const y=cur.slice(0,4);const I=impost();I.tasse=I.tasse||{};const T=tasseImp(y);
    if(e.target.id==='tasAltri')T.altri=e.target.value;if(e.target.id==='tasAdd')T.add=e.target.value;I.tasse[y]=T;I.updatedAt=Date.now();changed();renderTasse();});
  $('tasList').addEventListener('click',async e=>{
    if(e.target.id==='cuMan')openCU(null);
    const ed=e.target.closest('[data-cuedit]');if(ed)openCU(D().cu[ed.dataset.cuedit]);
    const pg=e.target.closest('[data-unpag]');if(pg)chiediPagamento(pg.dataset.unpag);
  });
  $('tasList').addEventListener('change',async e=>{if(e.target.id!=='cuFile')return;const f=e.target.files[0];e.target.value='';if(!f)return;
    busy(true,'Leggo la Certificazione Unica…');try{const r=await leggiCU(f);busy(false);
      const p=progetti().find(p=>r.comm&&(r.comm.toLowerCase().includes(p.nome.toLowerCase())||p.nome.toLowerCase().includes(r.comm.toLowerCase().split(' ')[0])));
      openCU(null);Object.assign(cuEd,{tipo:r.tipo,anno:r.anno,comm:r.comm||'',causale:r.causale||'',pid:p?.id||'',p4:itNumParse(r.p4)||'',p7:itNumParse(r.p7)||'',p8:itNumParse(r.p8)||'',p9:itNumParse(r.p9)||'',p1:itNumParse(r.p1)||'',p21:itNumParse(r.p21)||'',trovati:r.trovati,_file:f});openCU(cuEd,true);
    }catch(err){busy(false);toast('Non riesco a leggere il PDF: '+errMsg(err)+'. Inserisci i dati a mano.','err');openCU(null);}});
  $('cuTipo').onchange=togCU;$('cuSave').onclick=saveCU;$('cuDel').onclick=delCU;$('cuClose').onclick=closeCU;
  $('cuModal').addEventListener('click',e=>{if(e.target.id==='cuModal')closeCU();});
  $('rieAnno').addEventListener('click',e=>{if(e.target.id==='csvAnno'){const y=cur.slice(0,4);download(new TextEncoder().encode(csvAnno(y)),`Riepilogo ${y} per il commercialista.csv`,'text/csv');toast('File scaricato: si apre con Excel');}});
  $('pjCat').onchange=()=>{$('pjCatInfo').textContent=CAT_INFO[$('pjCat').value];if($('pjCat').value==='occasionale'&&!+$('pjO-ritenuta').value)$('pjO-ritenuta').value=20;};
  $('cestBox').addEventListener('click',e=>{const b=e.target.closest('[data-rip]');if(b)ripristina(b.dataset.rip,b.dataset.k);});
  $('sicBox').addEventListener('click',e=>{if(e.target.id==='pinSet'||e.target.id==='pinCambia')impostaPin();if(e.target.id==='pinTogli')togliPin();});
  $('sicBox').addEventListener('change',e=>{if(e.target.id==='bioOn')attivaBio(e.target.checked);});
  $('lockOk').onclick=provaPin;$('lockPin').addEventListener('keydown',e=>{if(e.key==='Enter')provaPin();});$('lockBio').onclick=provaBio;
  $('lockForgot').onclick=async()=>{if(await conferma('Per sbloccare senza PIN esco dall’account su questo dispositivo: i dati restano sul tuo Drive e tornano quando rientri.','Esci e sblocca','danger')){localStorage.removeItem(LOCKK);sblocca();try{logout();}catch(e){}}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)nascostoDa=Date.now();else if(lockCfg()&&!bloccato&&nascostoDa&&Date.now()-nascostoDa>60000)blocca();});
  $('oraProm').onchange=()=>{const I=impost();I.oraPromemoria=$('oraProm').value;I.updatedAt=Date.now();changed();aggiornaPromemoriaCache();toast('Orario dei promemoria salvato');};
  $('promem').addEventListener('change',()=>setTimeout(async()=>{const ok=await registraPeriodico($('promem').checked);if($('promem').checked&&ok)toast('Promemoria attivi anche ad app chiusa (quando il telefono lo permette).');aggiornaPromemoriaCache();},300));
  $('icsBtn').onclick=icsPromemoria;
}

// ---------- avvio v5 ----------
soglieMigr();svuotaVecchi();bind5();
if(lockCfg())blocca();
render();
if(new URLSearchParams(location.search).get('conferma'))tab='cal',render();
