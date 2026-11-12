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
    const waitRows=async()=>{for(let i=0;i<40;i++){if(document.querySelector('tr.mat-row,tr[mat-row]')||/no (data|sessions)/i.test(document.body.innerText)&&cur())return;await sleep(300)}};
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
    P('Načítavam hovory…');await waitRows();
    // largest page size
    const sel=document.querySelector('.mat-paginator-page-size-select .mat-select-trigger')||document.querySelector('.mat-paginator-page-size-select');
    if(sel){sel.click();await sleep(500);const opts=[...document.querySelectorAll('mat-option')];if(opts.length){const big=opts.map(o=>({o:o,n:parseInt(o.innerText)||0})).sort((a,b)=>b.n-a.n)[0];big.o.click();await sleep(1500);await waitRows();}}
    const parseRows=()=>{
      const out=[];
      document.querySelectorAll('tr').forEach(tr=>{
        const td=[...tr.querySelectorAll('td')].map(x=>x.innerText.trim());
        if(td.length>=6&&/^\d{2}\/\d{2}\/\d{4}$/.test(td[0])){
          const p=parseFloat(td[5].replace(/[^0-9.\-]/g,''));
          out.push({date:td[0],type:td[1],time:td[2],lang:td[3],dur:td[4],pay:isFinite(p)?p:0});
        }
      });
      if(!out.length){
        document.body.innerText.split(/\r?\n/).forEach(line=>{
          const m=line.match(/^\s*(\d{2}\/\d{2}\/\d{4}).*?(\d{2}:\d{2}:\d{2}).*?(\d{2}:\d{2}:\d{2}).*?£\s*([0-9.]+)\s*$/);
          if(m)out.push({date:m[1],type:'',time:m[2],lang:'',dur:m[3],pay:parseFloat(m[4])});
        });
      }
      return out;
    };
    let total=null;
    const readTotal=()=>{document.querySelectorAll('tr').forEach(tr=>{const t=tr.innerText;if(/^\s*Total/i.test(t)){const m=t.match(/£\s*([0-9.]+)/);if(m)total=parseFloat(m[1])}})};
    const range=()=>{const m=(document.querySelector('.mat-paginator-range-label')||{innerText:''}).innerText.match(/(\d+)\s*[–-]\s*(\d+)\s*of\s*(\d+)/);return m?{a:+m[1],b:+m[2],n:+m[3]}:null};
    const all=new Map();
    let pages=0;
    while(pages++<60){
      P('Strana '+pages+'…');parseRows().forEach(r=>all.set(r.date+' '+r.time+' '+r.dur+' '+r.pay,r));
      readTotal();
      const rg=range();
      const next=document.querySelector('.mat-paginator-navigation-next');
      if(!rg||rg.b>=rg.n||!next||next.disabled||next.classList.contains('mat-button-disabled'))break;
      next.click();await sleep(900);
    }
    const sessions=[...all.values()];
    const rg=range();
    return done(true,{y:TY,m:TM,sessions:sessions,total:total,count:rg?rg.n:sessions.length});
  }catch(e){return done(false,'Chyba čítania: '+e);}
})()
