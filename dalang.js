(async function(){
  const TY=__Y__, TM=__M__;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const P=m=>{if(window.Android&&Android.progress)Android.progress(m)};
  const done=(ok,v)=>{ if(window.Android){ ok?Android.result(JSON.stringify(v)):Android.error(String(v)); } return {ok:ok,v:v}; };
  try{
    const MN=['january','february','march','april','may','june','july','august','september','october','november','december'];
    const mIndex=n=>MN.findIndex(x=>x.indexOf(String(n).toLowerCase().slice(0,3))===0);
    const cur=()=>{
      const srcs=[document.body.innerText||'',document.body.textContent||''];
      for(const t of srcs){
        let m=t.match(/Payments for\s+([A-Za-z]{3,})\s+(\d{4})/i)||t.match(/([A-Za-z]{3,})\s*\/\s*(\d{4})/);
        if(m){const i=mIndex(m[1]);if(i>=0)return {y:+m[2],m:i+1}}
      }
      return null;
    };
    const DATE=/\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{4}/, DATEX=/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/, POUND=/£\s*[0-9]/;
    const isRow=e=>{const t=e.textContent||'';return DATE.test(t)&&POUND.test(t)};
    // leaf-most elements that contain both a date and an amount = one booking row (works for tables and for mobile card layouts)
    const rowEls=()=>[...document.querySelectorAll('tr,[role="row"],mat-row,.mat-row,mat-list-item,mat-card,li,div')]
      .filter(e=>isRow(e)&&![...e.querySelectorAll('*')].some(isRow));
    const parseRows=()=>rowEls().map(e=>{
      const t=(e.textContent||'').replace(/\s+/g,' ');
      const d=t.match(DATEX);
      const times=t.match(/\d{2}:\d{2}:\d{2}/g)||[];
      const pounds=[...t.matchAll(/£\s*([0-9]+(?:[.,][0-9]+)?)/g)];
      if(!d||!pounds.length)return null;
      const lm=t.match(/\d{2}:\d{2}:\d{2}\s+([A-Za-z][A-Za-z ]*?)\s+\d{2}:\d{2}:\d{2}/)||t.match(/\b(Slovak|Czech)\b/);
      const dm=(times[1]||'').match(/^(\d+):(\d{2}):(\d{2})$/);
      return {date:d[1].padStart(2,'0')+'/'+d[2].padStart(2,'0')+'/'+d[3],time:times[0]||'',dur:times[1]||'',lang:lm?lm[1].trim():'',min:dm?Math.round(((+dm[1])*60+(+dm[2])+(+dm[3])/60)*100)/100:0,pay:parseFloat(pounds[pounds.length-1][1].replace(',','.'))};
    }).filter(Boolean);
    const waitRows=async()=>{for(let i=0;i<40;i++){if(parseRows().length||/no (data|sessions)/i.test(document.body.innerText)&&cur())return;await sleep(300)}};
    const stable=async()=>{let last=-1,same=0;for(let i=0;i<20&&same<2;i++){const n=parseRows().length;same=(n===last&&n>0)?same+1:0;last=n;await sleep(500)}};
    const diag=()=>[...document.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label')).filter(x=>/month|year/i.test(x)).slice(0,6).join(', ');
    P('Hľadám mesiac…');let c=cur();
    if(!c)return done(false,'Na stránke sa nenašiel výber mesiaca.');
    let guard=0;
    while((c.y*12+c.m)!==(TY*12+TM)&&guard++<60){
      const back=(c.y*12+c.m)>(TY*12+TM);
      const b=document.querySelector(back?'button[aria-label^="Go back a month"]':'button[aria-label^="Go forward a month"]');
      if(!b)return done(false,'Mesiac sa nedá otvoriť: chýba tlačidlo (zobrazený '+c.m+'/'+c.y+', hľadaný '+TM+'/'+TY+'; '+diag()+').');
      if(b.disabled||b.classList.contains('mat-button-disabled'))return done(false,'Portál nemá údaje pre mesiac '+TM+'/'+TY+' (zobrazený '+c.m+'/'+c.y+').');
      const before=c.y*12+c.m;
      b.click();
      for(let w=0;w<20;w++){await sleep(400);const n=cur();if(n&&(n.y*12+n.m)!==before)break}
      await waitRows();c=cur();
      if(!c)return done(false,'Stránka po zmene mesiaca nenačítala dáta.');
      if((c.y*12+c.m)===before)return done(false,'Mesiac sa po ťuknutí nezmenil (zobrazený '+c.m+'/'+c.y+', hľadaný '+TM+'/'+TY+').');
    }
    if((c.y*12+c.m)!==(TY*12+TM))return done(false,'Nepodarilo sa prepnúť na požadovaný mesiac.');
    P('Načítavam hovory…');await waitRows();await stable();
    // largest page size
    const sel=document.querySelector('.mat-paginator-page-size-select .mat-select-trigger')||document.querySelector('.mat-paginator-page-size-select');
    if(sel){sel.click();await sleep(600);const opts=[...document.querySelectorAll('mat-option')];if(opts.length){const big=opts.map(o=>({o:o,n:parseInt(o.textContent)||0})).sort((a,b)=>b.n-a.n)[0];big.o.click();await sleep(1500);await waitRows();await stable();}}
    let total=null;
    const readTotal=()=>{
      const els=[...document.querySelectorAll('tr,[role="row"],mat-footer-row,.mat-footer-row,div,li')].filter(e=>/^\s*Total\b/i.test(e.textContent||'')&&POUND.test(e.textContent||'')&&!DATE.test(e.textContent||''));
      els.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length);
      if(els.length){const m=(els[0].textContent||'').match(/£\s*([0-9]+(?:[.,][0-9]+)?)/);if(m)total=parseFloat(m[1].replace(',','.'))}
    };
    const range=()=>{const el=document.querySelector('.mat-paginator-range-label');const m=((el&&el.textContent)||'').match(/(\d+)\s*[–-]\s*(\d+)\s*(?:of|z)\s*(\d+)/);return m?{a:+m[1],b:+m[2],n:+m[3]}:null};
    const all=[];let pages=0,prev='';
    while(pages++<60){
      P('Strana '+pages+'…');
      const rows=parseRows();
      const sig=rows.map(r=>r.date+r.time+r.dur+r.pay).join('|');
      if(sig&&sig===prev)break;
      prev=sig;rows.forEach(r=>all.push(r));
      readTotal();
      const rg=range();
      const next=document.querySelector('.mat-paginator-navigation-next');
      if(!rg||rg.b>=rg.n||!next||next.disabled||next.classList.contains('mat-button-disabled'))break;
      next.click();await sleep(1000);await stable();
    }
    const rg=range();
    if(!all.length&&rg&&rg.n>0){
      const tr=document.querySelectorAll('tr').length,td=document.querySelectorAll('td').length;
      const smp=((document.querySelector('tr.mat-row,tr[mat-row],[role="row"]+[role="row"]')||{textContent:''}).textContent||'').replace(/\s+/g,' ').trim().slice(0,140);
      const tb=((document.querySelector('table')||{textContent:''}).textContent||'').replace(/\s+/g,' ').trim().slice(0,140);
      return done(false,'Riadky sa nepodarilo prečítať ('+tr+' tr, '+td+' td, '+(rg?rg.a+'-'+rg.b+' z '+rg.n:'bez stránkovania')+'; riadok: "'+smp+'"; tabuľka: "'+tb+'").');
    }
    return done(true,{y:TY,m:TM,sessions:all,total:total,count:rg?rg.n:all.length});
  }catch(e){return done(false,'Chyba čítania: '+e);}
})()
