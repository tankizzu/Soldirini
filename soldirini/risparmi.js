'use strict';
// ================= Soldirini v18 · risparmi: obiettivi, movimenti, andamento =================
// 24c.17 (D-176): niente più quota a percentuale del salvadanaio (tornerà con le notifiche della banca). I dati vecchi
// (risparmi.cfg con la percentuale, movimenti con il segno `salvadanaio`) restano com'erano (D-117) e qui si ignorano:
// i movimenti contano tutti con la loro data.
(function(){
const num=v=>leggiNumero(v)??0; // 24c.6 (P2): importi scritti a mano all'italiana (numeri.js)
const RS=()=>D().risparmi||(D().risparmi={});
const obiettivi=()=>Object.entries(RS()).filter(([k,r])=>k.startsWith('ob:')&&!r.deleted).map(([k,r])=>Object.assign({id:k.slice(3)},r)).sort((a,b)=>(a.entro||'9').localeCompare(b.entro||'9'));
// 24c.14 (D-169): movimenti rovinati (data assente o non valida, importo non numero) ignorati, anche qui
// 24c.20 (04, T1 / SV57): la data deve essere un giorno vero (Entrate.dataValida), come nei conti: «2026-02-30» non compare
const movimenti=()=>Object.entries(RS()).filter(([k,r])=>k.startsWith('mv:')&&r&&typeof r==='object'&&!r.deleted&&(window.Entrate&&Entrate.dataValida?Entrate.dataValida(r.data):typeof r.data==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.data))&&leggiNumero(r.importo)!=null).map(([k,r])=>Object.assign({id:k.slice(3)},r)).sort((a,b)=>b.data.localeCompare(a.data)||(b.updatedAt||0)-(a.updatedAt||0));
const totale=fn=>r2(movimenti().filter(fn||(()=>true)).reduce((a,m)=>a+num(m.importo),0));
const mesiTra=(da,a)=>{const [y1,m1]=da.split('-').map(Number),[y2,m2]=a.split('-').map(Number);return (y2-y1)*12+(m2-m1);};
SUB.ris='rie';
// 24c.20 (02 §2.3): «5 dicembre» e «50 euro» (anche «12 euro e 30») per le righe e il lettore di schermo
const giornoMese=d=>{const x=parseYmd(d);return `${x.getDate()} ${MESI[x.getMonth()]}${x.getFullYear()!==+today().slice(0,4)?' '+x.getFullYear():''}`;};
const eurParole=v=>{const e=Math.floor(Math.round(v*100)/100),c=Math.round((v-e)*100);return `${e.toLocaleString('it-IT')} euro${c?' e '+String(c).padStart(2,'0'):''}`;};

function renderRisparmi(){
  const tot=totale(),ym=today().slice(0,7),y=cur.slice(0,4);const meseTot=totale(m=>m.data.startsWith(ym));
  // andamento dell'anno
  const mesi=Array.from({length:12},(_,i)=>totale(m=>m.data.startsWith(`${y}-${pad(i+1)}`)));const mx=Math.max(1,...mesi.map(Math.abs));
  const O=obiettivi();
  // 24c.20: testi definitivi di 02 (tornata 59 §2.1-§2.4); prelevato più di quanto messo → «Presi dai risparmi in tutto», importo senza segno; un obiettivo che andrebbe sotto zero si mostra a 0,00 € (§2.2)
  $('risBody').innerHTML=`<div class="hero"><div class="rim"><small>${tot<0?'Presi dai risparmi in tutto':'Messi da parte in tutto'}</small><b>${eur(Math.abs(tot))}</b><small class="det">Questo mese ${eur(meseTot)}</small></div></div>
  <div class="card"><h3>🐷 Metti da parte o preleva</h3>
    <div class="acts rsdue"><button class="btn" id="rsMv">+ Ho messo da parte</button><button class="btn ghost" id="rsPrel">Ho prelevato</button></div>
    <label class="check" style="margin-top:10px"><input type="checkbox" id="rsTogli" aria-describedby="rsTogliNota" ${impost().salvaToglie===true?'checked':''}> I soldi messi da parte si tolgono dai soldi del mese</label>
    <p class="muted sm" id="rsTogliNota">Esempio: il 2 dicembre metti da parte 100 €. Accesa, i soldi rimanenti di dicembre scendono di 100 €; se il 15 prelevi 30 €, risalgono di 30 €. Spenta, i risparmi restano un conto a parte. Le tasse non cambiano mai.</p></div>
  <div class="card"><h3>🎯 Obiettivi</h3>${O.map(o=>{const s=Math.max(0,totale(m=>m.ob===o.id));const t=num(o.target);const p=t?Math.min(100,Math.round(s/t*100)):0;
      const n=o.entro?Math.max(1,mesiTra(ym,o.entro)+1):0;const serve=t>s&&n?r2((t-s)/n):0;
      return `<div class="obp"><div class="kv"><span><b>${esc(o.nome)}</b>${o.entro?` <small class="muted">entro ${esc(monthName(o.entro))}</small>`:''}</span><b>${eur(s)} / ${eur(t)}</b></div><div class="bar"><span style="width:${p}%"></span></div>
        <small class="muted">${p>=100?'🎉 Obiettivo raggiunto!':serve?`Servono ${eur(serve)} al mese`:''}</small> <button class="btn ghost sm" data-obed="${esc(o.id)}">Modifica</button></div>`;}).join('')||'<p class="muted sm">Nessun obiettivo per ora. Un obiettivo ti fa vedere quanto manca a qualcosa che vuoi comprare.</p>'}
    <div class="acts"><button class="btn ghost sm" id="rsOb">+ Nuovo obiettivo</button></div></div>
  <div class="card"><h3>📊 Andamento ${y}</h3><div class="rbars">${mesi.map((v,i)=>`<div class="rbar" title="${esc(MESI[i])}: ${eur(v)}"><span class="${v<0?'neg':''}" style="height:${Math.round(Math.abs(v)/mx*100)}%"></span><small>${MESI[i].slice(0,1).toUpperCase()}</small></div>`).join('')}</div>
    <div class="kv big"><span>Messi da parte nel ${y}</span><b>${eur(r2(mesi.reduce((a,v)=>a+v,0)))}</b></div></div>
  <div class="card"><h3>📒 Movimenti</h3>${movimenti().slice(0,15).map(m=>{const o=m.ob&&RS()['ob:'+m.ob];const v=num(m.importo),fuori=v<0,gm=giornoMese(m.data),ob=o&&!o.deleted?o.nome:'';
      const cosa=fuori?'Prelevato':'Messo da parte',euro=eurParole(Math.abs(v));
      return `<div class="fxr" role="group" aria-label="${esc(`${cosa}, ${euro}, ${gm}${ob?', obiettivo '+ob:''}`)}"><span aria-hidden="true">${fuori?'↘':'↗'}</span><span class="tx"><b>${esc(gm)} · ${cosa}</b><small>${[ob,m.nota].filter(Boolean).map(esc).join(' · ')}</small></span><b class="rsimp">${eur(Math.abs(v))}</b><button class="btn ghost sm" data-mved="${esc(m.id)}" aria-label="${esc(`Modifica il movimento del ${gm}, ${euro}`)}">Modifica</button></div>`;}).join('')||'<p class="muted sm">Non hai ancora segnato niente. Quando metti da parte dei soldi, o ne prelevi, tocca i pulsanti qui sopra.</p>'}</div>`;
  // 24c.19 (D-183): ogni sezione si riduce come nel resto dell'app (plus.js foldify): chiuse a ogni apertura della pagina (D-010),
  // restano aperte mentre si resta qui (salvataggi, «I soldi messi da parte si tolgono…»); il riquadro in alto resta sempre visibile
  foldify($('risBody'),'ris');
}
const _render18r=render;
render=function(){_render18r();if(tab==='ris')renderRisparmi();};

// ---------- finestre ----------
const apri=id=>{$(id).hidden=false;document.body.classList.add('noscroll');};
const chiudi=id=>{$(id).hidden=true;document.body.classList.remove('noscroll');};
let ob=null,mv=null;
function apriOb(id){const o=id?RS()['ob:'+id]:null;ob={id:id||uid()};$('obTit').textContent=o?'Obiettivo':'Nuovo obiettivo';$('obDel').hidden=!o;
  $('obNome').value=o?.nome||'';$('obTarget').value=o?.target||'';$('obEntro').value=o?.entro||'';apri('obModal');}
function salvaOb(){const nome=$('obNome').value.trim(),t=num($('obTarget').value);if(!nome){toast('Dai un nome all’obiettivo.','err');return;}if(!(t>0)){toast('Scrivi quanto vuoi mettere da parte.','err');return;}
  RS()['ob:'+ob.id]={nome,target:String(r2(t)),entro:$('obEntro').value,updatedAt:Date.now()};changed();chiudi('obModal');render();toast('Obiettivo salvato.');}
async function eliminaOb(){if(!await conferma('Eliminare l’obiettivo? I soldi messi da parte restano nel totale.','Elimina','danger'))return;RS()['ob:'+ob.id]={deleted:true,updatedAt:Date.now()};changed();chiudi('obModal');render();}
// 24c.20: testi definitivi di 02 (tornata 59 §2.2): titolo e pulsante secondo il verso; errori sotto il campo, alla perdita del fuoco
function apriMv(id,pre){const m=id?RS()['mv:'+id]:null;mv={id:id||uid(),tipo:m?(num(m.importo)<0?'out':'in'):(pre?.tipo||'in'),salvadanaio:m?.salvadanaio||''};
  $('mvDel').hidden=!m;
  $('mvImp').value=m?String(Math.abs(num(m.importo))).replace('.',','):'';$('mvData').value=m?.data||today();$('mvNota').value=m?.nota||'';
  const O=obiettivi();$('mvOb').innerHTML='<option value="">Nessun obiettivo</option>'+O.map(o=>`<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('');$('mvOb').value=m?.ob||'';
  $('mvObL').hidden=!O.length&&!m?.ob;errMv('Imp','');errMv('Data','');contaMv();
  tipoMv();apri('mvModal');setTimeout(()=>{if(!$('mvModal').hidden)$('mvImp').focus();},50);}
function tipoMv(){document.querySelectorAll('#mvTipo button').forEach(b=>b.classList.toggle('on',b.dataset.t===mv.tipo));const fuori=mv.tipo==='out';
  $('mvTit').textContent=fuori?'Ho prelevato':'Ho messo da parte';$('mvSave').textContent=fuori?'Segna come prelevati':'Segna come messi da parte';}
function errMv(c,t){const e=$('mv'+c+'Err');e.textContent=t;e.hidden=!t;$('mv'+c).classList.toggle('bad',!!t);return !t;}
const impMv=()=>{const v=leggiNumero($('mvImp').value,true);return errMv('Imp',v>0?'':'Scrivi un importo più grande di 0.');};
const dataMv=()=>errMv('Data',window.Entrate&&Entrate.dataValida?(Entrate.dataValida($('mvData').value)?'':'Scegli un giorno.'):($('mvData').value?'':'Scegli un giorno.'));
// con la scelta D-169 accesa, sotto il giorno: «Conta nei soldi di {mese}.» (anno solo se diverso da quello di oggi)
function contaMv(){const d=$('mvData').value,ok=impost().salvaToglie===true&&/^\d{4}-\d{2}-\d{2}$/.test(d);$('mvConta').hidden=!ok;
  if(ok){const y=d.slice(0,4);$('mvConta').textContent=`Conta nei soldi di ${MESI[+d.slice(5,7)-1]}${y!==today().slice(0,4)?' '+y:''}.`;}}
function salvaMv(){const ok=[impMv(),dataMv()];if(ok.includes(false)){$(ok[0]?'mvData':'mvImp').focus();return;}const v=leggiNumero($('mvImp').value,true);
  RS()['mv:'+mv.id]={data:$('mvData').value,importo:String(r2(mv.tipo==='out'?-v:v)),ob:$('mvOb').value,nota:$('mvNota').value.trim(),...(mv.salvadanaio?{salvadanaio:mv.salvadanaio}:{}),updatedAt:Date.now()};
  changed();chiudi('mvModal');render();toast(`✓ Segnati ${eur(r2(v))} ${mv.tipo==='out'?'prelevati':'messi da parte'}.`);}
async function eliminaMv(){if(!await conferma('Eliminare questo movimento?','Elimina','danger'))return;RS()['mv:'+mv.id]={deleted:true,updatedAt:Date.now()};changed();chiudi('mvModal');render();}

function bind(){
  $('risBody').addEventListener('click',e=>{const t=e.target;
    if(t.id==='rsMv'){apriMv(null);return;}if(t.id==='rsPrel'){apriMv(null,{tipo:'out'});return;}if(t.id==='rsOb'){apriOb(null);return;}
    if(t.dataset.obed){apriOb(t.dataset.obed);return;}if(t.dataset.mved){apriMv(t.dataset.mved);return;}});
  $('risBody').addEventListener('change',e=>{
    if(e.target.id==='rsTogli'){const I=impost();if(e.target.checked)I.salvaToglie=true;else delete I.salvaToglie;I.updatedAt=Date.now();changed();render();} // 24c.14 (D-169)
  });
  $('obClose').onclick=()=>chiudi('obModal');$('obSave').onclick=salvaOb;$('obDel').onclick=eliminaOb;
  $('mvClose').onclick=()=>chiudi('mvModal');$('mvAnn').onclick=()=>chiudi('mvModal');$('mvSave').onclick=salvaMv;$('mvDel').onclick=eliminaMv;
  $('mvImp').addEventListener('blur',impMv);$('mvData').addEventListener('blur',dataMv);$('mvData').addEventListener('input',()=>{contaMv();if(!$('mvDataErr').hidden)dataMv();});
  $('mvImp').addEventListener('input',()=>{if(!$('mvImpErr').hidden)impMv();});
  $('mvTipo').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){mv.tipo=b.dataset.t;tipoMv();}});
  for(const id of ['obModal','mvModal'])$(id).addEventListener('click',e=>{if(e.target.id===id)chiudi(id);});
}
bind();
window.Risparmi={renderRisparmi,totale,obiettivi};
})();
