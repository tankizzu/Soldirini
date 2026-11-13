'use strict';
// ================= Soldirini v18 · risparmi: obiettivi, salvadanaio mensile, andamento =================
(function(){
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return isNaN(n)?0:n;};
const RS=()=>D().risparmi||(D().risparmi={});
const cfg=()=>RS().cfg&&!RS().cfg.deleted?RS().cfg:{perc:'20'};
const obiettivi=()=>Object.entries(RS()).filter(([k,r])=>k.startsWith('ob:')&&!r.deleted).map(([k,r])=>Object.assign({id:k.slice(3)},r)).sort((a,b)=>(a.entro||'9').localeCompare(b.entro||'9'));
const movimenti=()=>Object.entries(RS()).filter(([k,r])=>k.startsWith('mv:')&&!r.deleted).map(([k,r])=>Object.assign({id:k.slice(3)},r)).sort((a,b)=>b.data.localeCompare(a.data));
const totale=fn=>r2(movimenti().filter(fn||(()=>true)).reduce((a,m)=>a+num(m.importo),0));
const mesiTra=(da,a)=>{const [y1,m1]=da.split('-').map(Number),[y2,m2]=a.split('-').map(Number);return (y2-y1)*12+(m2-m1);};
const mesePrima=ym=>{const d=new Date(+ym.slice(0,4),+ym.slice(5)-2,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
const ultimoGiorno=ym=>`${ym}-${pad(new Date(+ym.slice(0,4),+ym.slice(5),0).getDate())}`;
SUB.ris='rie';

function renderRisparmi(){
  const tot=totale(),ym=today().slice(0,7),y=cur.slice(0,4);const meseTot=totale(m=>m.data.startsWith(ym));
  const prec=mesePrima(ym);const giaPrec=movimenti().some(m=>m.salvadanaio===prec);const Cp=contiMese(prec),Cc=contiMese(ym);
  const perc=num(cfg().perc);const sugg=r2(Math.max(0,Cp.rimanenti)*perc/100);
  // andamento dell'anno
  const mesi=Array.from({length:12},(_,i)=>totale(m=>m.data.startsWith(`${y}-${pad(i+1)}`)));const mx=Math.max(1,...mesi.map(Math.abs));
  const O=obiettivi();
  $('risBody').innerHTML=`<div class="hero"><div class="rim"><small>Messi da parte in tutto</small><b>${eur(tot)}</b><small class="det">Questo mese ${eur(meseTot)}</small></div></div>
  <div class="card"><h3>🐷 Salvadanaio del mese</h3>
    <div class="kv"><span>Rimasti a ${esc(monthName(prec))}</span><b class="mnt">${eur(Cp.rimanenti)}</b></div>
    ${giaPrec?`<p class="sm">✓ Per ${esc(monthName(prec))} hai già messo da parte.</p>`:Cp.rimanenti>0?`<p class="sm">Ti propongo di mettere da parte il <b>${nf(perc)}%</b>: <b class="mnt">${eur(sugg)}</b>.</p><div class="acts"><button class="btn sm" id="rsSalv" data-v="${sugg}">Metti da parte ${eur(sugg)}</button><button class="btn ghost sm" id="rsSalvAltro">Un altro importo</button></div>`:`<p class="muted sm">A ${esc(monthName(prec))} non è avanzato niente da mettere da parte.</p>`}
    <div class="kv"><span>${esc(monthName(ym))}, finora</span><b class="mnt">${eur(Cc.rimanenti)}</b></div>
    <label style="margin-top:8px">Percentuale da mettere da parte ogni mese<input id="rsPerc" type="number" inputmode="decimal" min="0" max="100" value="${esc(cfg().perc)}"></label></div>
  <div class="card"><h3>🎯 Obiettivi</h3>${O.map(o=>{const s=totale(m=>m.ob===o.id);const t=num(o.target);const p=t?Math.min(100,Math.round(s/t*100)):0;
      const n=o.entro?Math.max(1,mesiTra(ym,o.entro)+1):0;const serve=t>s&&n?r2((t-s)/n):0;
      return `<div class="obp"><div class="kv"><span><b>${esc(o.nome)}</b>${o.entro?` <small class="muted">entro ${esc(monthName(o.entro))}</small>`:''}</span><b>${eur(s)} / ${eur(t)}</b></div><div class="bar"><span style="width:${p}%"></span></div>
        <small class="muted">${p>=100?'🎉 Obiettivo raggiunto!':serve?`Servono ${eur(serve)} al mese`:''}</small> <button class="btn ghost sm" data-obed="${o.id}">Modifica</button></div>`;}).join('')||'<p class="muted sm">Nessun obiettivo. Esempi: vacanze, fondo emergenze, auto nuova.</p>'}
    <div class="acts"><button class="btn sm" id="rsMv">+ Metti da parte</button><button class="btn ghost sm" id="rsOb">+ Nuovo obiettivo</button></div></div>
  <div class="card"><h3>📈 Andamento ${y}</h3><div class="rbars">${mesi.map((v,i)=>`<div class="rbar" title="${esc(MESI[i])}: ${eur(v)}"><span class="${v<0?'neg':''}" style="height:${Math.round(Math.abs(v)/mx*100)}%"></span><small>${MESI[i].slice(0,1).toUpperCase()}</small></div>`).join('')}</div>
    <div class="kv big"><span>Messi da parte nel ${y}</span><b>${eur(r2(mesi.reduce((a,v)=>a+v,0)))}</b></div></div>
  <div class="card"><h3>Movimenti</h3>${movimenti().slice(0,15).map(m=>{const o=m.ob&&RS()['ob:'+m.ob];return `<div class="fxr"><span>${num(m.importo)<0?'↘':'↗'}</span><span class="tx"><b>${eur(num(m.importo))}</b><small>${parseYmd(m.data).toLocaleDateString('it-IT')}${o&&!o.deleted?' · '+esc(o.nome):''}${m.nota?' · '+esc(m.nota):''}</small></span><button class="btn ghost sm" data-mved="${m.id}">Modifica</button></div>`;}).join('')||'<p class="muted sm">Ancora nessun movimento.</p>'}</div>`;
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
function apriMv(id,pre){const m=id?RS()['mv:'+id]:null;mv={id:id||uid(),tipo:m&&num(m.importo)<0?'out':'in',salvadanaio:m?.salvadanaio||pre?.salvadanaio||''};
  $('mvTit').textContent=m?'Movimento':'Metti da parte';$('mvDel').hidden=!m;
  $('mvImp').value=m?Math.abs(num(m.importo)):(pre?.importo||'');$('mvData').value=m?.data||pre?.data||today();$('mvNota').value=m?.nota||pre?.nota||'';
  $('mvOb').innerHTML='<option value="">— nessun obiettivo —</option>'+obiettivi().map(o=>`<option value="${o.id}">${esc(o.nome)}</option>`).join('');$('mvOb').value=m?.ob||'';
  tipoMv();apri('mvModal');}
function tipoMv(){document.querySelectorAll('#mvTipo button').forEach(b=>b.classList.toggle('on',b.dataset.t===mv.tipo));$('mvTit').textContent=mv.tipo==='out'?'Prelevo dai risparmi':$('mvDel').hidden?'Metti da parte':'Movimento';}
function salvaMv(){const v=num($('mvImp').value);if(!(v>0)){toast('Scrivi l’importo.','err');return;}
  RS()['mv:'+mv.id]={data:$('mvData').value||today(),importo:String(r2(mv.tipo==='out'?-v:v)),ob:$('mvOb').value,nota:$('mvNota').value.trim(),salvadanaio:mv.salvadanaio,updatedAt:Date.now()};
  changed();chiudi('mvModal');render();toast(mv.tipo==='out'?'Prelievo registrato.':'Messo da parte!');}
async function eliminaMv(){if(!await conferma('Eliminare questo movimento?','Elimina','danger'))return;RS()['mv:'+mv.id]={deleted:true,updatedAt:Date.now()};changed();chiudi('mvModal');render();}

function bind(){
  $('risBody').addEventListener('click',e=>{const t=e.target;const prec=mesePrima(today().slice(0,7));
    if(t.id==='rsSalv'){RS()['mv:'+uid()]={data:ultimoGiorno(prec),importo:t.dataset.v,ob:'',nota:'Salvadanaio di '+monthName(prec),salvadanaio:prec,updatedAt:Date.now()};changed();render();toast('Messo da parte!');return;}
    if(t.id==='rsSalvAltro'){apriMv(null,{data:ultimoGiorno(prec),nota:'Salvadanaio di '+monthName(prec),salvadanaio:prec});return;}
    if(t.id==='rsMv'){apriMv(null);return;}if(t.id==='rsOb'){apriOb(null);return;}
    if(t.dataset.obed){apriOb(t.dataset.obed);return;}if(t.dataset.mved){apriMv(t.dataset.mved);return;}});
  $('risBody').addEventListener('change',e=>{if(e.target.id==='rsPerc'){RS().cfg={perc:String(Math.min(100,Math.max(0,num(e.target.value)))),updatedAt:Date.now()};changed();render();}});
  $('obClose').onclick=()=>chiudi('obModal');$('obSave').onclick=salvaOb;$('obDel').onclick=eliminaOb;
  $('mvClose').onclick=()=>chiudi('mvModal');$('mvSave').onclick=salvaMv;$('mvDel').onclick=eliminaMv;
  $('mvTipo').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){mv.tipo=b.dataset.t;tipoMv();}});
  for(const id of ['obModal','mvModal'])$(id).addEventListener('click',e=>{if(e.target.id===id)chiudi(id);});
}
bind();
window.Risparmi={renderRisparmi,totale,obiettivi};
})();
