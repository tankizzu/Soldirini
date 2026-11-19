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
  function oraria(lv){const P=lv.paga||{};const imp=num(P.importo);if(imp==null)return null;if(P.tipo==='mensile'){const dv=num(P.divisore)||168;return imp/dv;}if(P.tipo==='giornaliera'){const dv=num(P.divisore)||8;return imp/dv;}return imp;}
  // orario previsto dall'orario settimanale (solo "orario fisso"), in minuti
  function previsto(lv,iso){
    if(lv.modo!=='fisso')return null;if(lv.dal&&iso<lv.dal)return null;if(lv.al&&iso>lv.al)return null;
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
  // giorni dal lunedì al venerdì del mese che non sono festivi (anche le feste locali)
  function giorniLavorativi(ym,locali){let n=0;for(let d=1;d<=giorniDelMese(ym);d++){const iso=`${ym}-${pad(d)}`;if(giornoSett(iso)<=5&&!festivo(iso,locali))n++;}return n;}
  // 24c.1 · R-TURNI-1 (04, tornata 29) e D-110: ore di un giorno di assenza (ferie, permesso, malattia, altra assenza
  // pagata o non pagata). Vale il primo valore trovato; "punto" dice da dove viene. Punti 1-4: ore scritte dall'utente.
  function oreAssenza(lv,t,tp,iso){
    const pausa=num(t.pausa)??num(tp&&tp.pausa)??0;
    const dalle=(da,a)=>{const x=toMin(da),y=toMin(a);if(x==null||y==null)return null;let e=y;if(e<=x)e+=1440;return Math.max(0,e-x-pausa)/60;};
    let o=num(t.ore);if(o!=null)return {ore:o,punto:1};                  // 1. ore scritte nel turno
    o=dalle(t.da,t.a);if(o!=null)return {ore:o,punto:2};                 // 2. "dalle–alle" del turno, meno la pausa
    o=tp?num(tp.ore):null;if(o!=null)return {ore:o,punto:3};             // 3. ore del tipo
    o=tp?dalle(tp.da,tp.a):null;if(o!=null)return {ore:o,punto:4};       // 4. "dalle–alle" del tipo, meno la pausa
    if(lv.modo!=='turni'){const p=previsto(lv,iso);return {ore:p?p.min/60:0,punto:5};} // 5. orario fisso: l'orario previsto del giorno
    o=num(lv.oreGiorno);if(o!=null&&o>0)return {ore:o,punto:6};          // 6. turni: "Ore di una giornata" del lavoro
    const om=num(lv.oreMese);if(om!=null&&om>0){const g=giorniLavorativi(iso.slice(0,7),parseLocali(lv.locali));if(g)return {ore:r2(om/g),punto:7};} // 7. ore al mese ÷ giorni lavorativi
    return {ore:0,punto:8};                                               // 8. niente: 0 ore e avviso nella pagina del mese
  }

  // voci di un giorno: turni scritti + (se orario fisso) l'orario previsto quando non è sostituito
  function vociGiorno(lv,turniGiorno,iso){
    const loc=parseLocali(lv.locali),fest=festivo(iso,loc);
    const pv=fest?null:previsto(lv,iso);
    const voci=[];
    for(const t of turniGiorno){
      const tp=tipoDi(lv,t.tipo);const cat=tp?tp.cat:'lavoro';
      const da=t.da!=null&&t.da!==''?t.da:tp?.da,a=t.a!=null&&t.a!==''?t.a:tp?.a;
      const pausa=num(t.pausa)??num(tp?.pausa)??0;const ore=num(t.ore)??num(tp?.ore);
      const ass=PAGATE.includes(cat)||cat==='nonretr'?oreAssenza(lv,t,tp,iso):null;
      voci.push({id:t.id,tipo:tp,nome:tp?tp.nome:'Turno',sigla:tp?.sigla||'',colore:tp?.colore||lv.colore,cat,da:toMin(da),a:toMin(a),daS:da||'',aS:a||'',pausa,ore,ass,aggiunta:!!tp?.aggiunta,nota:t.nota||''});
    }
    // un'assenza di poche ore scritte (es. permesso di 2 ore, o "dalle 08 alle 10") non toglie tutto l'orario del giorno: lo riduce
    const parziale=v=>pv&&v.ass&&v.ass.punto<=4&&v.ass.ore*60<pv.min;
    const sostituisce=voci.some(v=>!v.aggiunta&&!parziale(v));
    if(pv&&!sostituisce)voci.unshift({id:null,implicito:true,nome:'Orario',sigla:'',colore:lv.colore,cat:'lavoro',da:pv.da,a:pv.a,daS:(lv.settimana[giornoSett(iso)]||{}).da,aS:(lv.settimana[giornoSett(iso)]||{}).a,pausa:pv.pausa,ore:null});
    // D-110 punto 2 (lavoro a turni): un'assenza senza ore scritte vale la giornata intera e i turni di lavoro di quel giorno non contano
    const senza=lv.modo==='turni'?voci.filter(v=>v.ass&&v.ass.punto>=6):[];
    const annulla=senza.length>0;
    // D-114 (04, tornata 30, decisione 1 A): una giornata sola per lavoro e per giorno. Le ore scritte delle altre assenze restano;
    // le assenze senza ore si prendono il resto (mai meno di 0) nell'ordine di 04 (tornata 31 §1a): malattia → ferie → permesso →
    // altra assenza pagata → assenza non pagata (le pagate prima: un'unione di telefoni non toglie soldi dalla stima); le seguenti valgono 0
    if(senza.length){
      const scritte=voci.filter(v=>v.ass&&v.ass.punto<=4).reduce((a,v)=>a+v.ass.ore,0);let resto=Math.max(0,r2(senza[0].ass.ore-scritte));
      const ORDINE={malattia:0,ferie:1,permesso:2,retribuita:3,nonretr:4};
      for(const v of senza.slice().sort((a,b)=>ORDINE[a.cat]-ORDINE[b.cat])){const o=resto;resto=0;v.ass=Object.assign({},v.ass,{ore:o,zero:o===0&&v.ass.punto!==8});}
    }
    return {voci,fest,previsto:pv,annulla};
  }

  // 24c.3 (R-MAGG-1 punto 3): un turno con l'orario diviso in pezzi; a orario fisso le parti fuori dall'orario previsto sono "fuori".
  // La pausa si toglie prima dalla parte dentro l'orario, poi dalle altre.
  function pezziTurno(s,e,pausa,pv){
    if(!pv)return [{s,e,min:Math.max(0,e-s-pausa),fuori:false}];
    const P=[];const a=Math.max(s,Math.min(e,pv.da)),b=Math.min(e,Math.max(s,pv.a));
    if(a>s)P.push({s,e:a,fuori:true});if(b>a)P.push({s:a,e:b,fuori:false});if(e>b)P.push({s:b,e,fuori:true});
    let p=pausa;for(const x of P.slice().sort((x,y)=>x.fuori-y.fuori)){const t=Math.min(p,x.e-x.s);x.min=x.e-x.s-t;p-=t;}
    return P;
  }
  // calcolo di un mese. turni = tutti i turni del lavoro (non eliminati)
  function calcolaMese(lv,turni,ym){
    const h=oraria(lv),P=lv.magg||{};const pS=pct(P.stra),pN=pct(P.nott),pF=pct(P.fest),pD=pct(P.dom);
    const pSN=pct(P.straNott),pSF=pct(P.straFest);const speciali=pSN!=null||pSF!=null; // 24c.3 · D-120, R-MAGG-1 (04, tornata 33 §3)
    const tipoPaga=(lv.paga||{}).tipo;const festePag=!!lv.festePagate&&(tipoPaga==='oraria'||tipoPaga==='giornaliera'); // 24c.3 · D-121, R-FESTE-1 (§4)
    let straPay=0,exN=0,exF=0,exD=0,festeGg=0;
    const perData={};for(const t of turni)if(t.data&&t.data.startsWith(ym))(perData[t.data]=perData[t.data]||[]).push(t);
    const T={giorniPag:0,giorniLav:0,lav:0,ord:0,stra:0,nott:0,fest:0,dom:0,pagate:0,ferie:0,ferieOre:0,perm:0,mal:0,nonretr:0,variab:0,senzaOre:0,straNott:0,straFest:0,festePag:0};
    const giorni=[];let cum=0;const soglia=lv.modo==='turni'?num(lv.oreMese):null;
    for(let d=1;d<=giorniDelMese(ym);d++){
      const iso=`${ym}-${pad(d)}`;const G=vociGiorno(lv,(perData[iso]||[]).filter(t=>!t.deleted),iso);
      let W=0,N=0,PG=0,senzaOre=false;const pvMin=G.previsto?G.previsto.min:0;
      const assParz=G.voci.filter(v=>v.ass&&v.ass.punto<=4).reduce((a,v)=>a+v.ass.ore*60,0);
      const pezzi=[]; // 24c.3 (R-MAGG-1 punto 3): pezzi di lavoro del giorno, per sapere quali minuti sono straordinario e se sono di notte
      for(const v of G.voci){
        if(v.implicito){const m=Math.max(0,pvMin-assParz);N+=Math.min(m,minNotte(lv,v.da,v.a));v.min=m;W+=m;pezzi.push({s:v.da,e:v.a,min:m,fuori:false});continue;}
        if(LAVORO.includes(v.cat)){
          if(G.annulla){v.min=0;v.annullato=true;continue;} // D-110: c'è un'assenza della giornata intera
          let m=0;
          if(v.da!=null&&v.a!=null){let e=v.a;if(e<=v.da)e+=1440;m=Math.max(0,e-v.da-(v.pausa||0));N+=Math.min(m,minNotte(lv,v.da,e));pezzi.push(...pezziTurno(v.da,e,v.pausa||0,lv.modo==='fisso'?G.previsto:null));}
          else if(v.ore!=null){m=v.ore*60;pezzi.push({s:null,e:null,min:m,fuori:lv.modo==='fisso'&&!!v.aggiunta});}
          if(v.cat==='variabile')T.variab+=m/60;
          v.min=m;W+=m;
        } else if(PAGATE.includes(v.cat)||v.cat==='nonretr'){
          // ore dell'assenza: R-TURNI-1 (oreAssenza)
          const o=v.ass.ore;v.min=o*60;if(v.ass.punto===8)senzaOre=true;
          if(v.cat==='nonretr')T.nonretr+=o;else{T.pagate+=o;if(!v.ass.zero)PG++;}
          if(v.cat==='ferie'&&!v.ass.zero){T.ferie+=1;T.ferieOre+=o;}if(v.cat==='permesso')T.perm+=o;if(v.cat==='malattia')T.mal+=o;
        }
      }
      let S=0;
      if(lv.modo==='fisso')S=Math.max(0,W-pvMin);
      else if(soglia!=null){const resto=Math.max(0,soglia*60-cum);S=Math.max(0,W-resto);}
      cum+=W;
      // R-FESTE-1: festa in settimana non lavorata, pagata se il lavoro lo dice (solo paga oraria e a giornata)
      if(festePag&&G.fest&&W===0){
        let oreF=null;
        if(lv.modo==='fisso'){const pf=previsto(lv,iso);if(pf)oreF=pf.min/60;}               // le ore dell'orario di quel giorno della settimana
        else if(giornoSett(iso)<=5){const o=oreAssenza(lv,{},null,iso);oreF=o.ore;if(o.punto===8)senzaOre=true;} // turni: punti 6-8 di R-TURNI-1
        if(oreF!=null){T.festePag+=oreF;festeGg++;}
      }
      if(senzaOre)T.senzaOre++; // giorni con un'assenza contata 0 ore (punto 8): avviso nella pagina del mese
      if(W>0)T.giorniLav++;else if(PG)T.giorniPag++;
      T.lav+=W/60;T.stra+=S/60;T.ord+=(W-S)/60;T.nott+=N/60;
      if(G.fest&&W)T.fest+=W/60;else if(giornoSett(iso)===7&&W)T.dom+=W/60;
      // R-MAGG-1: minuti di straordinario di notte (SN) e nei giorni di festa o di domenica
      if(S>0){
        const fuoriPrima=lv.modo==='fisso';const fine=p=>p.e==null?-Infinity:p.e;
        const ordine=pezzi.slice().sort((a,b)=>fuoriPrima&&a.fuori!==b.fuori?(a.fuori?-1:1):fine(b)-fine(a));
        let resto=S,SN=0;for(const p of ordine){const k=Math.min(resto,p.min);if(k<=0)continue;if(p.s!=null)SN+=Math.min(k,minNotte(lv,Math.max(p.s,p.e-k),p.e));resto-=k;}
        SN=Math.min(SN,N,S);const fsd=G.fest?'f':giornoSett(iso)===7?'d':'';
        T.straNott+=SN/60;if(fsd)T.straFest+=S/60;
        const esclF=m=>{if(fsd==='f')exF+=m;else if(fsd==='d')exD+=m;};
        let rA=pS||0,rB=pS||0; // rA: straordinario di notte, rB: straordinario di giorno
        if(fsd&&pSN!=null&&pSF!=null){rA=Math.max(pSN,pSF);exN+=SN;esclF(SN);}
        else if(pSN!=null){rA=pSN;exN+=SN;}
        else if(fsd&&pSF!=null){rA=pSF;esclF(SN);}
        if(fsd&&pSF!=null){rB=pSF;esclF(S-SN);}
        straPay+=SN*(1+rA)+(S-SN)*(1+rB);
      }
      giorni.push({data:iso,fest:G.fest,voci:G.voci,min:W,stra:S});
    }
    // soldi (solo se c'è la paga)
    const E={base:0,stra:0,nott:0,fest:0,dom:0};let lordo=null;
    if(h!=null){
      if(lv.paga.tipo==='mensile')E.base=Math.max(0,num(lv.paga.importo)-T.nonretr*h);
      else if(lv.paga.tipo==='giornaliera')E.base=(T.giorniLav+T.giorniPag)*num(lv.paga.importo); // a giornata: ogni giorno lavorato o pagato vale la paga giornaliera
      else E.base=(T.ord+T.pagate)*h;
      if(festePag){if(tipoPaga==='giornaliera')E.base+=festeGg*num(lv.paga.importo);else E.base+=T.festePag*h;} // R-FESTE-1 punto 5
      if(!speciali){E.stra=T.stra*h*(1+(pS||0));E.nott=T.nott*h*(pN||0);E.fest=T.fest*h*(pF||0);E.dom=T.dom*h*(pD||0);} // campi vuoti: come prima
      else{E.stra=straPay/60*h;E.nott=Math.max(0,T.nott-exN/60)*h*(pN||0);E.fest=Math.max(0,T.fest-exF/60)*h*(pF||0);E.dom=Math.max(0,T.dom-exD/60)*h*(pD||0);}
      for(const k in E)E[k]=r2(E[k]);lordo=r2(E.base+E.stra+E.nott+E.fest+E.dom);
    }
    for(const k in T)T[k]=Math.round(T[k]*100)/100;
    return {ym,T,E,lordo,oraria:h==null?null:r2(h),giorni,magg:{stra:pS,nott:pN,fest:pF,dom:pD,straNott:pSN,straFest:pSF}};
  }

  // trattenute: quelle scritte nel lavoro, altrimenti dalla busta più recente con lordo e netto
  function trattenute(lv,buste){
    const m=num(lv.tratt);if(m!=null)return {p:m/100,fonte:'impostazione'};
    const b=Object.values(buste||{}).filter(x=>!x.deleted&&num(x.lordo)>0&&num(x.netto)>0&&num(x.netto)<num(x.lordo)).sort((a,c)=>c.mese.localeCompare(a.mese))[0];
    return b?{p:1-num(b.netto)/num(b.lordo),fonte:'busta',mese:b.mese}:null;
  }

  // saldi di ferie e permessi: dall'ultima busta che li riporta, meno quanto usato dopo; altrimenti dalle impostazioni
  function saldi(lv,turni,buste,fino){
    // 24c.1: stessa regola di calcolaMese (R-TURNI-1, D-110, D-114): le ore di ogni assenza si calcolano giorno per giorno
    const usate=(cat,daYm,aYm,ore)=>{const perData={};for(const t of turni){if(t.deleted||!t.data)continue;const ym=t.data.slice(0,7);if(ym<=daYm||ym>aYm)continue;(perData[t.data]=perData[t.data]||[]).push(t);}
      let n=0;for(const [iso,L] of Object.entries(perData))for(const v of vociGiorno(lv,L,iso).voci){if(!v.ass||!v.tipo||v.cat!==cat)continue;if(ore)n+=v.ass.ore;else if(!v.ass.zero)n+=1;}
      return Math.round(n*100)/100;};
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

  g.StipCalc={pad,r2,num,toMin,giornoSett,pasqua,festivo,parseLocali,CAT,PAGATE,LAVORO,oraria,previsto,oreAssenza,giorniLavorativi,minNotte,vociGiorno,calcolaMese,trattenute,saldi,tipoDi};
})(typeof window!=='undefined'?window:globalThis);
