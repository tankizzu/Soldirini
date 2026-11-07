'use strict';
// ================= Soldirini v17 · Google Calendar =================
// Su richiesta (Impostazioni → Google Calendar) crea un calendario per ogni progetto e per ogni lavoro
// e ci copia le attività, dal mese in cui si attiva in poi. Usa solo il permesso "calendar.app.created":
// l'app vede e modifica soltanto i calendari creati da lei, non gli altri calendari dell'utente.
(function(){
const C=window.StipCalc;
const CAL_SCOPE='https://www.googleapis.com/auth/calendar.app.created';
const CAPI='https://www.googleapis.com/calendar/v3';
const TZ='Europe/Rome';
const GC=()=>D().gcal||(D().gcal={});           // record sincronizzati: cfg, cal:<chiave>, ev:<id>
const cfg=()=>GC().cfg&&!GC().cfg.deleted?GC().cfg:null;
const attivo=()=>!!cfg()?.attivo;
const OREAVANTI=3; // mesi futuri in cui riportare l'orario abituale dei lavori a orario fisso
let inCorso=false,ultimo=null,errore=null;

// ---------- permesso Google per il calendario ----------
const haPermesso=()=>!!(TOK&&TOK.access&&TOK.exp>Date.now()+60000&&(TOK.scope==null||String(TOK.scope).includes(CAL_SCOPE)));
function chiediPermesso(){
  if(!tokenClient){initTokenClient();if(!tokenClient)return Promise.reject(new Error('Google non è ancora pronto, riprova tra un attimo.'));}
  return new Promise((res,rej)=>{tokWait={res,rej};
    tokenClient.requestAccessToken({scope:CFG.SCOPE+' '+CAL_SCOPE,include_granted_scopes:true,login_hint:DB.meta.account?.email||undefined});}).then(t=>{
      if(TOK&&TOK.scope!=null&&!String(TOK.scope).includes(CAL_SCOPE))throw new Error('Non hai dato il permesso per il calendario.');
      DB.meta.gcalOk=true;persist();return t;});
}
// dopo che il calendario è attivo, i prossimi accessi chiedono anche il permesso del calendario
const _getToken17=getToken;
getToken=function(interactive){
  if(interactive&&DB.meta.gcalOk&&!tokenOk()&&tokenClient){return new Promise((res,rej)=>{tokWait={res,rej};
    tokenClient.requestAccessToken({scope:CFG.SCOPE+' '+CAL_SCOPE,include_granted_scopes:true,prompt:'',login_hint:DB.meta.account?.email||undefined});});}
  return _getToken17(interactive);
};

async function cfetch(method,path,json){
  const t=await getToken(false);if(!t)throw new AuthErr('Accedi con Google.');
  const r=await fetch(CAPI+path,{method,headers:Object.assign({Authorization:'Bearer '+t},json?{'Content-Type':'application/json'}:{}),body:json?JSON.stringify(json):undefined});
  if(r.status===204)return null;
  let j=null;try{j=await r.json();}catch(e){}
  if(!r.ok){const e=new Error(`Google Calendar (${r.status}): ${j?.error?.message||r.statusText}`);e.status=r.status;throw e;}
  return j;
}

// ---------- cosa va nei calendari ----------
const hex=s=>[...new TextEncoder().encode(s)].map(b=>b.toString(16).padStart(2,'0')).join('');
const evId=k=>('sd'+hex(k)).slice(0,1000); // id stabile: lo stesso elemento non viene mai duplicato, anche da due telefoni
const piu1=iso=>{const d=parseYmd(iso);d.setDate(d.getDate()+1);return ymd(d);};
const hm=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`;
function orario(data,da,a){ // da/a in minuti; fine dopo la mezzanotte = giorno dopo
  const fine=a<=da?piu1(data):data;return {start:{dateTime:`${data}T${hm(da)}:00`,timeZone:TZ},end:{dateTime:`${fine}T${hm(a)}:00`,timeZone:TZ}};}
const tuttoIlGiorno=data=>({start:{date:data},end:{date:piu1(data)}});
function desiderati(){
  const c=cfg();const dal=c.dal;const out={};
  // progetti: un evento per attività (orario dalle fasce, altrimenti tutto il giorno)
  for(const e of eventiDel(e=>e.data>=dal,true)){const p=prog(e.pid);if(!p||p.deleted)continue;
    const f=(e.fasce||[]).filter(x=>x.da&&x.a);const tempi=f.length?orario(e.data,min(f[0].da),min(f[f.length-1].a)):tuttoIlGiorno(e.data);
    const note=[e.titolo&&e.titolo!==etichetta(e)?e.titolo:'',e.note||'',e.stato==='previsto'?'(prevista)':''].filter(Boolean).join('\n');
    out[evId('e|'+e.id)]=Object.assign({cal:'p:'+p.id,calNome:p.nome,summary:etichetta(e)+(e.stato==='previsto'?' ?':''),description:note},tempi);}
  // lavori: turni e orario abituale (questo fino a qualche mese avanti)
  const fine=(()=>{const d=new Date();d.setMonth(d.getMonth()+OREAVANTI+1,0);return ymd(d);})();
  for(const l of lavori()){const T=turniDi(l.id).filter(t=>t.data>=dal);const byD={};for(const t of T)(byD[t.data]=byD[t.data]||[]).push(t);
    const giorni=new Set(Object.keys(byD));if(l.modo==='fisso')for(let d=dal;d<=fine;d=piu1(d))giorni.add(d);
    for(const d of [...giorni].sort()){const G=C.vociGiorno(l,byD[d]||[],d);
      G.voci.forEach((v,i)=>{if(v.cat==='riposo')return;
        const nome=v.implicito?l.nome:((v.tipo?.icona?v.tipo.icona+' ':'')+v.nome+(l.modo==='turni'||lavori().length>1?' · '+l.nome:''));
        const tempi=v.da!=null&&v.a!=null?orario(d,v.da,v.a):tuttoIlGiorno(d);
        out[evId(`l|${l.id}|${d}|${v.id||'abituale'}|${i}`)]=Object.assign({cal:'l:'+l.id,calNome:l.nome,summary:nome+(v.ore!=null&&v.da==null?` (${nf(v.ore)} h)`:''),description:v.nota||''},tempi);});}}
  return out;
}
// promemoria di Google Calendar: avviso sul telefono prima di ogni evento (anche ad app chiusa)
function avvisi(x){const a=+(cfg()?.avviso||0);if(!a)return {useDefault:false,overrides:[]};
  return {useDefault:false,overrides:[{method:'popup',minutes:x.start.date?(a>=1440?a-540:360):a}]};} // eventi di tutto il giorno: la sera prima (18:00) o alle 9 del giorno prima
const firma=x=>JSON.stringify([x.summary,x.description,x.start,x.end,avvisi(x)]);

// ---------- calendari ----------
async function calendario(key,nome){
  const rec=GC()['cal:'+key];
  if(rec&&!rec.deleted&&rec.id){try{await cfetch('GET','/calendars/'+encodeURIComponent(rec.id));return rec.id;}catch(e){if(e.status!==404&&e.status!==410)throw e;}}
  const c=await cfetch('POST','/calendars',{summary:'Soldirini · '+nome,description:'Creato da Soldirini. Si aggiorna da solo: le modifiche vanno fatte nell’app.',timeZone:TZ});
  GC()['cal:'+key]={id:c.id,nome,updatedAt:Date.now()};return c.id;
}

// ---------- sincronizzazione ----------
async function sincronizza(manuale){
  if(!attivo()||inCorso)return;if(!haPermesso()){if(manuale)throw new Error('Serve il permesso per il calendario: tocca “Collega questo telefono”.');return;}
  inCorso=true;errore=null;let fatti=0,mod=false;
  try{
    const want=desiderati();const have={};for(const [k,r] of Object.entries(GC()))if(k.startsWith('ev:')&&!r.deleted)have[k.slice(3)]=r;
    const calId={};
    for(const [id,x] of Object.entries(want)){const h=firma(x);if(have[id]&&have[id].h===h)continue;
      if(!calId[x.cal])calId[x.cal]=await calendario(x.cal,x.calNome);const cal=calId[x.cal];
      // se l'evento era in un altro calendario (attività spostata di progetto) lo tolgo da lì
      if(have[id]&&have[id].cal&&have[id].cal!==cal){try{await cfetch('DELETE',`/calendars/${encodeURIComponent(have[id].cal)}/events/${id}`);}catch(e){}}
      const body={id,summary:x.summary,description:x.description,start:x.start,end:x.end,status:'confirmed',reminders:avvisi(x),extendedProperties:{private:{soldirini:'1'}}};
      try{await cfetch('PUT',`/calendars/${encodeURIComponent(cal)}/events/${id}`,body);}
      catch(e){if(e.status===404)await cfetch('POST',`/calendars/${encodeURIComponent(cal)}/events`,body);else throw e;}
      GC()['ev:'+id]={h,cal,updatedAt:Date.now()};fatti++;mod=true;
      if(manuale&&fatti%10===0)busy(true,`Aggiorno Google Calendar… ${fatti}`);}
    for(const [id,r] of Object.entries(have))if(!want[id]){
      try{await cfetch('DELETE',`/calendars/${encodeURIComponent(r.cal)}/events/${id}`);}catch(e){if(e.status!==404&&e.status!==410)throw e;}
      GC()['ev:'+id]={deleted:true,updatedAt:Date.now()};fatti++;mod=true;}
    ultimo=Date.now();
  }catch(e){errore=errMsg(e);if(manuale)throw e;}
  finally{inCorso=false;if(mod)changed();renderGcal();}
  return fatti;
}
const _processQueue17=processQueue;
processQueue=async function(){const r=await _processQueue17();try{await sincronizza(false);}catch(e){}return r;};

// ---------- attiva / disattiva ----------
async function attiva(){
  if(!DB.meta.account){toast('Prima accedi con Google.','err');return;}
  if(!await conferma('Soldirini creerà nel tuo Google Calendar un calendario per ogni progetto e per ogni lavoro, con le attività da questo mese in poi. Potrà vedere e modificare solo questi calendari, non gli altri. Continuo?','Attiva'))return;
  try{await chiediPermesso();}catch(e){toast(errMsg(e),'err');return;}
  const oggi=today();GC().cfg={attivo:true,dal:oggi.slice(0,7)+'-01',updatedAt:Date.now()};changed();
  busy(true,'Creo i calendari…');try{const n=await sincronizza(true);toast(`Google Calendar attivo: ${n} eventi copiati.`);}catch(e){toast(errMsg(e),'err');}finally{busy(false);renderGcal();}
}
async function collega(){try{await chiediPermesso();busy(true,'Aggiorno Google Calendar…');const n=await sincronizza(true);toast(n?`Calendario aggiornato (${n} modifiche).`:'Calendario già aggiornato.');}catch(e){toast(errMsg(e),'err');}finally{busy(false);renderGcal();}}
async function disattiva(){
  const v=await ask('Disattivare Google Calendar? Soldirini smette di aggiornarlo.',[{t:'Annulla',v:null,cls:'ghost'},{t:'Tieni i calendari',v:'tieni',cls:'ghost'},{t:'Elimina i calendari',v:'elimina',cls:'danger'}]);if(!v)return;
  if(v==='elimina'){if(!haPermesso()){try{await chiediPermesso();}catch(e){toast(errMsg(e),'err');return;}}
    busy(true,'Elimino i calendari…');try{for(const [k,r] of Object.entries(GC()))if(k.startsWith('cal:')&&!r.deleted&&r.id){try{await cfetch('DELETE','/calendars/'+encodeURIComponent(r.id));}catch(e){if(e.status!==404&&e.status!==410)throw e;}}}
    catch(e){busy(false);toast(errMsg(e),'err');return;}busy(false);}
  const now=Date.now();for(const k of Object.keys(GC()))if(k!=='cfg')GC()[k]={deleted:true,updatedAt:now};
  GC().cfg={attivo:false,updatedAt:now};changed();renderGcal();toast(v==='elimina'?'Calendari eliminati, Google Calendar disattivato.':'Google Calendar disattivato: i calendari restano, ma non si aggiornano più.');
}

// ---------- scheda nelle impostazioni ----------
function renderGcal(){
  const b=$('gcalBody');if(!b)return;const c=cfg();const cal=Object.entries(GC()).filter(([k,r])=>k.startsWith('cal:')&&!r.deleted);
  if(!attivo()){b.innerHTML=`<p class="muted sm" style="margin-top:0">Crea un calendario Google per ogni progetto e lavoro e lo tiene aggiornato da solo (da questo mese in poi). Così vedi tutto anche in Google Calendar, sul telefono e sul computer.</p><button class="btn" id="gcalOn">Attiva Google Calendar</button>`;return;}
  const ok=haPermesso()||DB.meta.gcalOk;
  b.innerHTML=`<p class="sm" style="margin-top:0"><b>Attivo</b> dal ${esc(monthName(c.dal.slice(0,7)))} · ${cal.length} ${cal.length===1?'calendario':'calendari'}${ultimo?' · aggiornato alle '+new Date(ultimo).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):''}</p>
    ${cal.length?`<p class="muted sm">${cal.map(([,r])=>'Soldirini · '+esc(r.nome)).join('<br>')}</p>`:''}
    ${errore?`<p class="warn sm">${esc(errore)}</p>`:''}
    ${!DB.meta.gcalOk?'<p class="muted sm">Su questo telefono non è ancora collegato: tocca “Collega questo telefono”.</p>':''}
    <div class="acts">${!DB.meta.gcalOk?'<button class="btn sm" id="gcalLink">Collega questo telefono</button>':'<button class="btn ghost sm" id="gcalNow">Aggiorna ora</button>'}<button class="btn ghost sm" id="gcalOff">Disattiva</button></div>
    <label>Avvisami prima di ogni attività<select id="gcalAvv">${[[0,'nessun avviso'],[15,'15 minuti prima'],[30,'30 minuti prima'],[60,'1 ora prima'],[120,'2 ore prima'],[1440,'il giorno prima']].map(([v,t])=>`<option value="${v}" ${+(c.avviso||0)===v?'selected':''}>${t}</option>`).join('')}</select></label>
    <p class="muted sm">L’avviso arriva da Google Calendar sul telefono, anche con Soldirini chiusa. Gli eventi di tutto il giorno avvisano la sera prima.</p>
    <p class="muted sm">Le modifiche si fanno in Soldirini: quelle fatte direttamente in Google Calendar vengono sovrascritte.</p>`;
}
const _renderProg17=renderProgetti;
renderProgetti=function(){_renderProg17();renderGcal();};
document.addEventListener('change',e=>{if(e.target.id==='gcalAvv'){const c=GC().cfg;c.avviso=+e.target.value;c.updatedAt=Date.now();changed();renderGcal();toast('Avvisi aggiornati: li applico agli eventi alla prossima sincronizzazione.');}});
document.addEventListener('click',e=>{const id=e.target.id;if(id==='gcalOn')attiva();else if(id==='gcalOff')disattiva();else if(id==='gcalLink'||id==='gcalNow')collega();});
window.GCal={desiderati,sincronizza,evId,CAL_SCOPE};
render();
})();
