'use strict';
// ================= Soldirini v19 · animazioni (scelte dell'utente: tutte le varianti A, velocità veloce) =================
// Le animazioni CSS sono in index.html (blocco "v19 animazioni"); qui solo quelle che servono di JavaScript.
(function(){
const ridotte=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const T=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t'))||0.7;
// 1 · cambio mese: il calendario (e il riepilogo) scorrono nella direzione del mese
let dir=0;
function anima(el,d){if(!el||ridotte())return;el.classList.remove('mA-r','mA-l');void el.offsetWidth;el.classList.add(d>0?'mA-r':'mA-l');}
for(const [id,d] of [['prev',-1],['next',1],['rPrev',-1],['rNext',1]])$(id)?.addEventListener('click',()=>{dir=d;},true);
// 4 · numeri che contano fino al nuovo valore · 6 · schede a cascata quando cambia pagina o mese
const vecchi=new Map();let ultima='';
const leggi=t=>{const s=t.replace(/[^\d,-]/g,'').replace(',','.');const n=parseFloat(s);return isNaN(n)?null:n;};
function conta(b,da,a){const neg=b.textContent.trim().startsWith('−');const dur=600*T(),t0=performance.now();
  const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);b.textContent=(neg?'− ':'')+eur(r2(Math.abs(da+(a-da)*e)));if(p<1)requestAnimationFrame(step);else b.textContent=(neg?'− ':'')+eur(Math.abs(a));};
  requestAnimationFrame(step);}
const _render19=render;
render=function(){
  _render19();
  const chiave=tab+'|'+cur+'|'+(typeof rieMode!=='undefined'?rieMode:'');
  if(dir&&tab==='cal')anima($('grid'),dir);
  if(dir&&tab==='rie')for(const id of ['rieTot','rieLav','rieFix','rieCards'])anima($(id),dir);
  dir=0;
  if(chiave!==ultima&&!ridotte()){const s=$('v-'+tab);if(s){s.classList.remove('cascata');void s.offsetWidth;s.classList.add('cascata');clearTimeout(s._c);s._c=setTimeout(()=>s.classList.remove('cascata'),900);}}
  if(!ridotte())document.querySelectorAll('#v-'+tab+' .hero b').forEach(b=>{const k=tab+'|'+(b.previousElementSibling?.textContent||'');const nuovo=leggi(b.textContent);if(nuovo==null)return;
    const prima=vecchi.has(k)?vecchi.get(k):(chiave!==ultima?0:nuovo);vecchi.set(k,nuovo);if(prima!==nuovo)conta(b,prima,nuovo);});
  ultima=chiave;
};
render();
})();
