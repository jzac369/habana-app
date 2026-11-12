(async function(){
  const TY=__Y__, TM=__M__;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const P=m=>{if(window.Android&&Android.progress)Android.progress(m)};
  const done=(ok,v)=>{ if(window.Android){ ok?Android.result(JSON.stringify(v)):Android.error(String(v)); } return {ok:ok,v:v}; };
  const MON={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const DATE=/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/;
  const g=async u=>{const r=await fetch(u,{credentials:'include'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()};
  const txt=n=>(n.textContent||'').replace(/\s+/g,' ').trim();
  const dom=h=>new DOMParser().parseFromString(h,'text/html');
  try{
    if(!/\/interpreter/.test(location.pathname))return done(false,'Nie si prihlásený do Magny.');
    const key=TY*12+TM;
    // 1) list of completed bookings, newest first, 25 per page
    const items=new Map();
    for(const tab of ['complete','cancelled']){
    let page=1,stop=false;
    while(!stop&&page<=120){
      P('Magna: zoznam, strana '+page+'…');
      const d=dom(await g('/interpreter/bookings?tab='+tab+'&page='+page));
      const links=[...d.querySelectorAll('a[href]')].filter(a=>/\/bookings\/(\d+)\/view/.test(a.getAttribute('href')));
      if(!links.length)break;
      let newer=0,inMonth=0,older=0;
      links.forEach(a=>{
        const id=a.getAttribute('href').match(/\/bookings\/(\d+)\/view/)[1];
        let n=a,dm=null;
        for(let i=0;i<8&&n&&!dm;i++){n=n.parentElement;if(n)dm=txt(n).match(DATE)}
        if(!dm)return;
        const k=(+dm[3])*12+MON[dm[2]];
        if(k===key){inMonth++;items.set(id,{id:id,d:+dm[1],m:MON[dm[2]],y:+dm[3]})}
        else if(k>key)newer++;else older++;
      });
      if(inMonth===0&&older>0&&newer===0)stop=true;
      if(older>=links.length)stop=true;
      page++;
      await sleep(150);
    }
    }
    // 2) amounts on each booking page
    const list=[...items.values()];
    const sessions=[];let missing=0,i=0;
    const worker=async()=>{
      while(i<list.length){
        const it=list[i++];
        try{
          const t=txt(dom(await g('/interpreter/bookings/'+it.id+'/view')).body);
          const pay=t.match(/Payable amount\s*([\d.,]+)\s*GBP/);
          const st=(t.match(/Status\s*(Complete|Cancelled|Scheduled|In progress)/)||[])[1];
          const dm=t.match(/Booking date\/time\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/);
          const pv=pay?parseFloat(pay[1].replace(/,/g,'')):0;
          const am=t.match(/Actual duration\s*([\d.]+)\s*minutes/);const mv=am?Math.round(parseFloat(am[1])*100)/100:0;
          if(pay&&(!st||st==='Complete'||(st==='Cancelled'&&pv>0))){
            const day=dm?{d:+dm[1],m:MON[dm[2]],y:+dm[3]}:it;
            sessions.push({date:String(day.d).padStart(2,'0')+'/'+String(day.m).padStart(2,'0')+'/'+day.y,pay:pv,min:mv,ref:it.id,cancelled:st==='Cancelled'});
          }else if(!pay&&st!=='Cancelled')missing++;
        }catch(e){missing++}
        P('Magna: '+sessions.length+' z '+list.length+' jobov…');
        await sleep(120);
      }
    };
    await Promise.all([worker(),worker(),worker()]);
    // 3) monthly statement total (only exists for finished months)
    let total=null;
    try{
      const d=dom(await g('/interpreter/payments'));
      d.querySelectorAll('tr').forEach(tr=>{
        const t=txt(tr),m=t.match(DATE),a=t.match(/([\d,]+\.\d{2})\s*GBP/);
        if(m&&a&&(+m[3])*12+MON[m[2]]===key)total=parseFloat(a[1].replace(/,/g,''));
      });
    }catch(e){}
    return done(true,{y:TY,m:TM,sessions:sessions,total:total,count:list.length-missing,missing:missing});
  }catch(e){return done(false,'Chyba čítania Magny: '+e);}
})()
