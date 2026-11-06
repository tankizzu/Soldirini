'use strict';
// ================= Soldirini v15 · calcoli del lavoro dipendente =================
// Modulo senza interfaccia: riceve i dati e restituisce numeri. Testato a parte (test/stip15.js).
// Idee e parte del codice riprese da Strafobico (festività, straordinario oltre le ore del mese, netto dalle buste).
(function(g){
  const pad=n=>String(n).padStart(2,'0');
  const r2=v=>Math.round((+v||0)*100)/100;
  const num=v=>{if(v===''||v==null)return null;const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n;};
  const toMin=v=>{if(v==null||v==='')return null;const m=String(v).match(/^(\d{1,2})[:.](\d{2})$/);if(!m)return null;const h=+m[1],mi=+m[2];if(h>24||mi>59)return null;return (h%24)*60+mi;};
  const giornoSett=iso=>{const d=new Date(Date.UTC(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10))).getUTCDay();return d===0?7:d;}; // 1 = lunedì … 7 = domenica
  const giorniDelMese=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();

  // ---------- festività italiane ----------
  function pasqua(y){
    const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),gg=Math.floor((b-f+1)/3),h=(19*a+b-d-gg+15)%30;
    const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    return new Date(Date.UTC(y,Math.floor((h+l-7*m+114)/31)-1,((h+l-7*m+114)%31)+1));
  }
  const FISSE={'01-01':'Capodanno','01-06':'Epifania','04-25':'Festa della Liberazione','05-01':'Festa del Lavoro','06-02':'Festa della Repubblica',
    '08-15':'Ferragosto','11-01':'Ognissanti','12-08':'Immacolata','12-25':'Natale','12-26':'Santo Stefano'};
  // "29/06, 4/10" -> ['06-29','10-04'] (santo patrono e altre feste locali)
  function parseLocali(s){const out=[];String(s||'').replace(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})/g,(_,d,m)=>{if(+m>=1&&+m<=12&&+d>=1&&+d<=31)out.push(pad(m)+'-'+pad(d));return '';});return out;}
  function festivo(iso,locali){
    const y=+iso.slice(0,4),md=iso.slice(5);
    if(FISSE[md])return FISSE[md];
    if(y>=2026&&md==='10-04')return 'San Francesco d’Assisi'; // legge 151/2025
    const p=pasqua(y),pq=new Date(p.getTime()+864e5),iP=p.toISOString().slice(0,10),iQ=pq.toISOString().slice(0,10);
    if(iso===iP)return 'Pasqua';if(iso===iQ)return 'Lunedì dell’Angelo';
    if((locali||[]).includes(md))return 'Festa locale';
    return null;
  }

  // ---------- categorie dei tipi di turno ----------
  // lavoro: ore lavorate da orario · variabile: ore lavorate scritte a mano · ferie/permesso/malattia/retribuita: assenze pagate
  // nonretr: assenza non pagata · riposo: niente
  const CAT={lavoro:'Lavoro',variabile:'Lavoro a ore',ferie:'Ferie',permesso:'Permesso',malattia:'Malattia',retribuita:'Altra assenza pagata',nonretr:'Assenza non pagata',riposo:'Riposo'};
  const PAGATE=['ferie','permesso','malattia','retribuita'];
  const LAVORO=['lavoro','variabile'];

  const pct=v=>{const n=num(v);return n==null?null:n/100;};
  function oraria(lv){const P=lv.paga||{};const imp=num(P.importo);if(imp==null)return null;if(P.tipo==='mensile'){const dv=num(P.divisore)||168;return imp/dv;}return imp;}
  // orario previsto dall'orario settimanale (solo "orario fisso"), in minuti
  function previsto(lv,iso){
    if(lv.modo!=='fisso')return null;if(lv.dal&&iso<lv.dal)return null;
    const s=(lv.settimana||{})[giornoSett(iso)];if(!s)return null;
    const a=toMin(s.da),b=toMin(s.a);if(a==null||b==null)return null;
    let e=b;if(e<=a)e+=1440;return {da:a,a:e,pausa:num(s.pausa)||0,min:Math.max(0,e-a-(num(s.pausa)||0))};
  }
  // minuti in fascia notturna dentro [s,e] (minuti dall'inizio del giorno, e può superare 1440)
  function minNotte(lv,s,e){
    const N=lv.nott||{};const a=toMin(N.da),b=toMin(N.a);if(a==null||b==null||a===b)return 0;
    const fasce=a>b?[[a-1440,b],[a,b+1440],[a+1440,b+2880]]:[[a,b],[a+1440,b+1440]];
    let t=0;for(const [x,y] of fasce)t+=Math.max(0,Math.min(e,y)-Math.max(s,x));return t;
  }
  const tipoDi=(lv,id)=>(lv.tipi||[]).find(t=>t.id===id)||null;

  // voci di un giorno: turni scritti + (se orario fisso) l'orario previsto quando non è sostituito
  function vociGiorno(lv,turniGiorno,iso){
    const loc=parseLocali(lv.locali),fest=festivo(iso,loc);
    const pv=fest?null:previsto(lv,iso);
    const voci=[];
    for(const t of turniGiorno){
      const tp=tipoDi(lv,t.tipo);const cat=tp?tp.cat:'lavoro';
      const da=t.da!=null&&t.da!==''?t.da:tp?.da,a=t.a!=null&&t.a!==''?t.a:tp?.a;
      const pausa=num(t.pausa)??num(tp?.pausa)??0;const ore=num(t.ore)??num(tp?.ore);
      voci.push({id:t.id,tipo:tp,nome:tp?tp.nome:'Turno',sigla:tp?.sigla||'',colore:tp?.colore||lv.colore,cat,da:toMin(da),a:toMin(a),daS:da||'',aS:a||'',pausa,ore,aggiunta:!!tp?.aggiunta,nota:t.nota||''});
    }
    // un'assenza di poche ore (es. permesso di 2 ore) non toglie tutto l'orario del giorno: lo riduce
    const parziale=v=>pv&&(PAGATE.includes(v.cat)||v.cat==='nonretr')&&v.ore!=null&&v.ore*60<pv.min;
    const sostituisce=voci.some(v=>!v.aggiunta&&!parziale(v));
    if(pv&&!sostituisce)voci.unshift({id:null,implicito:true,nome:'Orario',sigla:'',colore:lv.colore,cat:'lavoro',da:pv.da,a:pv.a,daS:(lv.settimana[giornoSett(iso)]||{}).da,aS:(lv.settimana[giornoSett(iso)]||{}).a,pausa:pv.pausa,ore:null});
    return {voci,fest,previsto:pv};
  }

  // calcolo di un mese. turni = tutti i turni del lavoro (non eliminati)
  function calcolaMese(lv,turni,ym){
    const h=oraria(lv),P=lv.magg||{};const pS=pct(P.stra),pN=pct(P.nott),pF=pct(P.fest),pD=pct(P.dom);
    const perData={};for(const t of turni)if(t.data&&t.data.startsWith(ym))(perData[t.data]=perData[t.data]||[]).push(t);
    const T={giorniLav:0,lav:0,ord:0,stra:0,nott:0,fest:0,dom:0,pagate:0,ferie:0,ferieOre:0,perm:0,mal:0,nonretr:0,variab:0};
    const giorni=[];let cum=0;const soglia=lv.modo==='turni'?num(lv.oreMese):null;
    for(let d=1;d<=giorniDelMese(ym);d++){
      const iso=`${ym}-${pad(d)}`;const G=vociGiorno(lv,(perData[iso]||[]).filter(t=>!t.deleted),iso);
      let W=0,N=0;const pvMin=G.previsto?G.previsto.min:0;
      const assParz=G.voci.filter(v=>!v.implicito&&!LAVORO.includes(v.cat)&&v.ore!=null).reduce((a,v)=>a+v.ore*60,0);
      for(const v of G.voci){
        if(v.implicito){const m=Math.max(0,pvMin-assParz);N+=Math.min(m,minNotte(lv,v.da,v.a));v.min=m;W+=m;continue;}
        if(LAVORO.includes(v.cat)){
          let m=0;
          if(v.da!=null&&v.a!=null){let e=v.a;if(e<=v.da)e+=1440;m=Math.max(0,e-v.da-(v.pausa||0));N+=Math.min(m,minNotte(lv,v.da,e));}
          else if(v.ore!=null)m=v.ore*60;
          if(v.cat==='variabile')T.variab+=m/60;
          v.min=m;W+=m;
        } else if(PAGATE.includes(v.cat)||v.cat==='nonretr'){
          // ore dell'assenza: scritte nel turno, altrimenti quelle del tipo, altrimenti l'orario previsto del giorno
          const prev=previsto(lv,iso);const o=v.ore!=null?v.ore:(prev?prev.min/60:0);v.min=o*60;
          if(v.cat==='nonretr')T.nonretr+=o;else T.pagate+=o;
          if(v.cat==='ferie'){T.ferie+=1;T.ferieOre+=o;}if(v.cat==='permesso')T.perm+=o;if(v.cat==='malattia')T.mal+=o;
        }
      }
      let S=0;
      if(lv.modo==='fisso')S=Math.max(0,W-pvMin);
      else if(soglia!=null){const resto=Math.max(0,soglia*60-cum);S=Math.max(0,W-resto);}
      cum+=W;
      if(W>0)T.giorniLav++;
      T.lav+=W/60;T.stra+=S/60;T.ord+=(W-S)/60;T.nott+=N/60;
      if(G.fest&&W)T.fest+=W/60;else if(giornoSett(iso)===7&&W)T.dom+=W/60;
      giorni.push({data:iso,fest:G.fest,voci:G.voci,min:W,stra:S});
    }
    // soldi (solo se c'è la paga)
    const E={base:0,stra:0,nott:0,fest:0,dom:0};let lordo=null;
    if(h!=null){
      if(lv.paga.tipo==='mensile')E.base=Math.max(0,num(lv.paga.importo)-T.nonretr*h);
      else E.base=(T.ord+T.pagate)*h;
      E.stra=T.stra*h*(1+(pS||0));E.nott=T.nott*h*(pN||0);E.fest=T.fest*h*(pF||0);E.dom=T.dom*h*(pD||0);
      for(const k in E)E[k]=r2(E[k]);lordo=r2(E.base+E.stra+E.nott+E.fest+E.dom);
    }
    for(const k in T)T[k]=Math.round(T[k]*100)/100;
    return {ym,T,E,lordo,oraria:h==null?null:r2(h),giorni,magg:{stra:pS,nott:pN,fest:pF,dom:pD}};
  }

  // trattenute: quelle scritte nel lavoro, altrimenti dalla busta più recente con lordo e netto
  function trattenute(lv,buste){
    const m=num(lv.tratt);if(m!=null)return {p:m/100,fonte:'impostazione'};
    const b=Object.values(buste||{}).filter(x=>!x.deleted&&num(x.lordo)>0&&num(x.netto)>0&&num(x.netto)<num(x.lordo)).sort((a,c)=>c.mese.localeCompare(a.mese))[0];
    return b?{p:1-num(b.netto)/num(b.lordo),fonte:'busta',mese:b.mese}:null;
  }

  // saldi di ferie e permessi: dall'ultima busta che li riporta, meno quanto usato dopo; altrimenti dalle impostazioni
  function saldi(lv,turni,buste,fino){
    const usate=(cat,daYm,aYm,ore)=>{let n=0;for(const t of turni){if(t.deleted||!t.data)continue;const ym=t.data.slice(0,7);if(ym<=daYm||ym>aYm)continue;const tp=tipoDi(lv,t.tipo);if(!tp||tp.cat!==cat)continue;
      if(ore){const o=num(t.ore)??num(tp.ore)??(previsto(lv,t.data)?.min||0)/60;n+=o;}else n+=1;}return Math.round(n*100)/100;};
    const B=Object.values(buste||{}).filter(b=>!b.deleted&&b.mese<=fino).sort((a,c)=>c.mese.localeCompare(a.mese));
    const out={};const y=fino.slice(0,4);
    const F=lv.ferie||{};const fOre=F.unita==='ore';
    const bf=B.find(b=>num(b.ferie)!=null);
    if(bf)out.ferie={saldo:r2(num(bf.ferie)-usate('ferie',bf.mese,fino,fOre)),unita:fOre?'ore':'giorni',fonte:'busta',mese:bf.mese};
    else if(num(F.anno)!=null)out.ferie={saldo:r2((num(F.anno)||0)+(num(F.residuo)||0)-usate('ferie',`${y-1}-12`,fino,fOre)),unita:fOre?'ore':'giorni',fonte:'impostazioni'};
    const R=lv.perm||{};const rOre=R.unita!=='giorni';
    const br=B.find(b=>num(b.rol)!=null);
    if(br)out.rol={saldo:r2(num(br.rol)-usate('permesso',br.mese,fino,rOre)),unita:rOre?'ore':'giorni',fonte:'busta',mese:br.mese};
    else if(num(R.anno)!=null)out.rol={saldo:r2((num(R.anno)||0)-usate('permesso',`${y-1}-12`,fino,rOre)),unita:rOre?'ore':'giorni',fonte:'impostazioni'};
    const bx=B.find(b=>num(b.exfest)!=null);
    if(bx)out.exfest={saldo:num(bx.exfest),unita:bx.unitaPerm||'ore',fonte:'busta',mese:bx.mese};
    return out;
  }

  g.StipCalc={pad,r2,num,toMin,giornoSett,pasqua,festivo,parseLocali,CAT,PAGATE,LAVORO,oraria,previsto,minNotte,vociGiorno,calcolaMese,trattenute,saldi,tipoDi};
})(typeof window!=='undefined'?window:globalThis);
