(function(){'use strict';
const STORAGE_KEY='echoMicrodoseData';
let DB=load();

function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return JSON.parse(raw);}catch(e){}
  const now=new Date().toISOString();
  const d={meta:{appVersion:'1.3.0',createdAt:now,updatedAt:now},participant:{initials:'',age:null,sexOrGender:'',handDominance:'right',heightCm:null,weightKg:null,goals:[],protocol:{type:'fadiman',pattern:[1,0,0,1,0,0,1]}},baseline:null,doses:[],daily:[],weekly:[],ftt:[],pvt:[]};
  save(d); return d;
}
function save(d=DB){d.meta.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}
function uuid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)}
function sum(a){return a.reduce((x,y)=>x+(+y||0),0)}
function mean(a){return a.length?sum(a)/a.length:0}
function lastN(a,n){return a.slice(Math.max(0,a.length-n))}
function fmtDate(iso){const d=new Date(iso);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}

/* ----- Scales ----- */
const phq9=['Little interest or pleasure in doing things','Feeling down, depressed or hopeless','Trouble falling or staying asleep, or sleeping too much','Feeling tired or having little energy','Poor appetite or overeating','Feeling bad about yourself — or that you are a failure or have let yourself or your family down','Trouble concentrating on things','Moving or speaking so slowly… or being fidgety/restless','Thoughts that you would be better off dead, or self‑harm thoughts'];
const gad7=['Feeling nervous, anxious or on edge','Not being able to stop or control worrying','Worrying too much about different things','Trouble relaxing','Being so restless that it is hard to sit still','Becoming easily annoyed or irritable','Feeling afraid as if something awful might happen'];
const pss10=['Upset by unexpected events?','Unable to control important things?','Felt nervous and stressed?','Felt confident handling problems?','Felt things were going your way?','Couldn’t cope with all the things?','Able to control irritations?','Felt on top of things?','Angered by things outside your control?','Felt difficulties piling up too high?'];
const who5=['I have felt cheerful and in good spirits','I have felt calm and relaxed','I have felt active and vigorous','I woke up feeling fresh and rested','My daily life has been filled with things that interest me'];
const phqOpts=[{value:0,label:'Not at all'},{value:1,label:'Several days'},{value:2,label:'More than half the days'},{value:3,label:'Nearly every day'}];
const gadOpts=phqOpts;
const pssOpts=[{value:0,label:'Never'},{value:1,label:'Almost never'},{value:2,label:'Sometimes'},{value:3,label:'Fairly often'},{value:4,label:'Very often'}];
const whoOpts=[{value:0,label:'At no time'},{value:1,label:'Some of the time'},{value:2,label:'Less than half the time'},{value:3,label:'More than half the time'},{value:4,label:'Most of the time'},{value:5,label:'All of the time'}];

function catPHQ(t){return t<=4?'Minimal':t<=9?'Mild':t<=14?'Moderate':t<=19?'Mod. severe':'Severe'}
function catGAD(t){return t<=4?'Minimal':t<=9?'Mild':t<=14?'Moderate':'Severe'}
function catPSS(t){return t<=13?'Low stress':t<=26?'Moderate stress':'High stress'}
function catWHO(t){return (t*4)>=51?'Normal well‑being':'Poor well‑being'}

/* ----- UI helpers ----- */
function el(sel){return document.querySelector(sel)}
function els(sel){return Array.from(document.querySelectorAll(sel))}

/* ----- KPI + Charts + Insight Engine ----- */
const chartsCache={};
function updateKpisAndCharts(){
  const wrap=el('#kpis'); wrap.innerHTML='';
  const last7=lastN([...DB.daily].sort((a,b)=>new Date(a.date)-new Date(b.date)),7);
  const kpi=(label,val)=>`<div class="kpi"><div class="label">${label}</div><div class="value">${val}</div></div>`;
  const m=(k)=>mean(last7.map(x=>+x[k]||0));
  wrap.innerHTML = [
    kpi('Entries (7d)', last7.length),
    kpi('Mood avg (7d)', m('mood').toFixed(1)),
    kpi('Anxiety avg (7d)', m('anxiety').toFixed(1)),
    kpi('Stress avg (7d)', m('stress').toFixed(1)),
    kpi('Sleep (h, 7d)', m('sleepHours').toFixed(1)),
    kpi('FTT dom taps (7d)', mean(lastN(DB.ftt.filter(f=>f.hand==='dominant'),7).map(f=>f.avg||f.count||0)).toFixed(1))
  ].join('');

  // Charts
  const daily=[...DB.daily].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels=daily.map(d=>fmtDate(d.date));
  makeOrUpdateLine('chartMood','Mood (1–10)',labels,daily.map(d=>+d.mood||null),'#7ee787');
  makeOrUpdateLine('chartAnxiety','Anxiety (0–10)',labels,daily.map(d=>+d.anxiety||null),'#ef7f7f');
  makeOrUpdateLine('chartStress','Stress (0–10)',labels,daily.map(d=>+d.stress||null),'#ffd166');
  makeOrUpdateLine('chartSleep','Sleep hours',labels,daily.map(d=>+d.sleepHours||null),'#7db3ff');

  const ftt=[...DB.ftt].sort((a,b)=>new Date(a.date)-new Date(b.date));
  makeOrUpdateMultiline('chartFtt','FTT taps/10s', ftt.map(r=>fmtDate(r.date+'T00:00:00')), [
    {label:'Dominant', data: ftt.map(r=>r.hand==='dominant'?(r.avg||r.count||null):null), color:'#a78bfa'},
    {label:'Non‑dominant', data: ftt.map(r=>r.hand==='nondominant'?(r.avg||r.count||null):null), color:'#22d3ee'}
  ]);

  // Insights
  el('#insightBody').innerHTML = generateInsightText();
}
function makeOrUpdateLine(id,label,labels,data,color){
  if(!chartsCache[id]){
    chartsCache[id]=new Chart(el('#'+id),{type:'line',data:{labels,datasets:[{label,data,borderColor:color,pointRadius:3,tension:.2}]},options:{plugins:{legend:{display:false}},responsive:true,maintainAspectRatio:false}});
  }else{
    const c=chartsCache[id]; c.data.labels=labels; c.data.datasets[0].data=data; c.update();
  }
}
function makeOrUpdateMultiline(id, title, labels, series){
  if(!chartsCache[id]){
    chartsCache[id]=new Chart(el('#'+id),{type:'line',data:{labels,datasets:series.map(s=>({label:s.label,data:s.data,borderColor:s.color,pointRadius:3,tension:.2}))},options:{responsive:true,maintainAspectRatio:false}});
  }else{
    const c=chartsCache[id]; c.data.labels=labels; c.data.datasets=series.map(s=>({label:s.label,data:s.data,borderColor:s.color,pointRadius:3,tension:.2})); c.update();
  }
}

/* ---- Insight generator ---- */
function linRegSlope(nums){
  const x=nums.map((_,i)=>i+1), y=nums.map(v=>+v||0);
  const n=y.length; if(n<2) return 0;
  const sx=x.reduce((a,b)=>a+b,0), sy=y.reduce((a,b)=>a+b,0);
  const sxx=x.reduce((a,b)=>a+b*b,0), sxy=x.reduce((a,c,i)=>a+(c*y[i]),0);
  const denom = n*sxx - sx*sx; if(denom===0) return 0;
  return (n*sxy - sx*sy)/denom;
}
function trendWord(slope){ if(Math.abs(slope)<0.05) return 'stable'; return slope>0?'rising':'falling'; }
function generateInsightText(){
  const daily=[...DB.daily].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(daily.length===0) return 'No entries yet. Add a daily check‑in to start unlocking insights.';
  const last14=lastN(daily,14);
  const moods=last14.map(d=>+d.mood||0), anx=last14.map(d=>+d.anxiety||0), stress=last14.map(d=>+d.stress||0), sleep=last14.map(d=>+d.sleepHours||0);
  const mSlope=linRegSlope(moods), aSlope=linRegSlope(anx), sSlope=linRegSlope(stress), slSlope=linRegSlope(sleep);
  const moodT=trendWord(mSlope), anxT=trendWord(aSlope), strT=trendWord(sSlope), slpT=trendWord(slSlope);
  const m7=mean(lastN(daily,7).map(d=>+d.mood||0)).toFixed(1);
  const a7=mean(lastN(daily,7).map(d=>+d.anxiety||0)).toFixed(1);
  const s7=mean(lastN(daily,7).map(d=>+d.stress||0)).toFixed(1);
  const sl7=mean(lastN(daily,7).map(d=>+d.sleepHours||0)).toFixed(1);
  let lines=[];
  lines.push(`Mood looks <strong>${moodT}</strong>; 7‑day average is <strong>${m7}</strong>.`);
  lines.push(`Anxiety is <strong>${anxT}</strong>; 7‑day average is <strong>${a7}</strong>.`);
  lines.push(`Stress is <strong>${strT}</strong>; 7‑day average is <strong>${s7}</strong>.`);
  lines.push(`Sleep hours trend is <strong>${slpT}</strong>; 7‑day average is <strong>${sl7}h</strong>.`);
  if(mSlope>0.1 && aSlope<-0.1){ lines.push('Rising mood with falling anxiety suggests a favorable short‑term response. Keep routines steady and keep logging.'); }
  if(sSlope<-0.1 && slSlope>0.1){ lines.push('Lower stress with improving sleep usually move together; consider a steady wind‑down routine on dose and off days.'); }
  if(Math.abs(mSlope)<0.05 && Math.abs(aSlope)<0.05 && Math.abs(sSlope)<0.05){ lines.push('Signals look steady. Stability helps you notice subtler changes when they begin.'); }
  lines.push('<span class="muted small">Guidance only, not medical advice. If symptoms worsen or safety concerns occur, seek professional support.</span>');
  return lines.map(l=>`<p>${l}</p>`).join('');
}

/* ----- Builders & Renderers ----- */
function createScale(container,qs,opts,prefix){
  container.innerHTML='';
  qs.forEach((q,i)=>{
    const block=document.createElement('div'); block.className='q';
    const L=document.createElement('label'); L.textContent=`${i+1}. ${q}`; block.appendChild(L);
    const opt=document.createElement('div'); opt.className='opt';
    opts.forEach(o=>{const lab=document.createElement('label'); const r=document.createElement('input'); r.type='radio'; r.name=`${prefix}${i}`; r.value=o.value; r.required=true; lab.appendChild(r); lab.appendChild(document.createTextNode(' '+o.label)); opt.appendChild(lab);});
    block.appendChild(opt); container.appendChild(block);
  });
}
function renderDoseList(){const c=el('#doseList'); c.innerHTML=''; if(!DB.doses.length){c.innerHTML='<p class="muted">No doses recorded yet.</p>'; return;}
  DB.doses.sort((a,b)=>new Date(b.ts)-new Date(a.ts)).forEach(d=>{
    const div=document.createElement('div'); div.className='row';
    div.innerHTML=`<strong>${new Date(d.ts).toLocaleString()}</strong> — ${d.doseAmount}${d.doseUnit} ${d.substance}${d.strain? ' ('+d.strain+')':''}`;
    c.appendChild(div);
  });
}
function renderDailyList(){const c=el('#dailyList'); c.innerHTML=''; if(!DB.daily.length){c.innerHTML='<p class="muted">No daily entries yet.</p>'; return;}
  DB.daily.sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{
    const div=document.createElement('div'); div.className='row'; div.innerHTML=`<strong>${e.date}</strong> — mood ${e.mood}, anxiety ${e.anxiety}, stress ${e.stress}, sleep ${e.sleepHours}h`; c.appendChild(div);
  });
}
function renderWeeklyList(){const c=el('#weeklyList'); c.innerHTML=''; if(!DB.weekly.length){c.innerHTML='<p class="muted">No weekly check‑ins yet.</p>'; return;}
  DB.weekly.sort((a,b)=>new Date(b.weekStart)-new Date(a.weekStart)).forEach(e=>{
    const d=document.createElement('div'); d.className='row'; d.innerHTML=`<strong>${e.weekStart}</strong> — PHQ‑9 ${e.phq9.total}, GAD‑7 ${e.gad7.total}, PSS‑10 ${e.pss10.total}, WHO‑5 ${e.who5.total}`; c.appendChild(d);
  });
}

/* ----- Save Handlers ----- */
function getVals(prefix,count){const out=[]; for(let i=0;i<count;i++){ let v=null; els(`input[name="${prefix}${i}"]`).forEach(r=>{if(r.checked) v=+r.value}); if(v===null) return null; out.push(v);} return out;}
function handleBaselineSave(){
  const initials=el('#blInitials').value.trim();
  const age=+el('#blAge').value||null;
  const height=+el('#blHeight').value||null;
  const weight=+el('#blWeight').value||null;
  const hand=el('#blHand').value;
  const goals=Array.from(el('#blGoals').selectedOptions).map(o=>o.value);
  const protocol=el('#blProtocol').value;
  let pattern=[]; if(protocol==='fadiman') pattern=[1,0,0,1,0,0,1];
  else if(protocol==='stamets') pattern=[1,1,1,1,0,0,0];
  else { pattern=Array.from(el('#patternInputs').querySelectorAll('input')).map(i=>i.checked?1:0); }
  const phq=getVals('phq9q',9), gad=getVals('gad7q',7), pss=getVals('pss10q',10), who=getVals('who5q',5);
  if(!phq||!gad||!pss||!who){alert('Please answer all baseline questions.');return;}
  DB.participant={...DB.participant,initials,age,heightCm:height,weightKg:weight,handDominance:hand,goals,protocol:{type:protocol,pattern}};
  DB.baseline={date:new Date().toISOString().slice(0,10),phq9:{items:phq,total:sum(phq)},gad7:{items:gad,total:sum(gad)},pss10:{items:pss,total:sum(pss)},who5:{items:who,total:sum(who)}};
  save(); el('#baselineSummary').classList.remove('hidden');
  el('#baselineSummary').innerHTML=`<p><strong>Baseline saved.</strong> PHQ‑9 ${DB.baseline.phq9.total} (${catPHQ(DB.baseline.phq9.total)}), GAD‑7 ${DB.baseline.gad7.total} (${catGAD(DB.baseline.gad7.total)}), PSS‑10 ${DB.baseline.pss10.total} (${catPSS(DB.baseline.pss10.total)}), WHO‑5 ${DB.baseline.who5.total} (${catWHO(DB.baseline.who5.total)}).</p>`;
  updateKpisAndCharts();
}
function handleWeeklySave(){
  const weekStart=el('#weeklyDate').value; if(!weekStart){alert('Pick the week start date.');return;}
  const phq=getVals('weeklyPhq',9), gad=getVals('weeklyGad',7), pss=getVals('weeklyPss',10), who=getVals('weeklyWho',5);
  if(!phq||!gad||!pss||!who){alert('Please answer all weekly questions.');return;}
  DB.weekly=DB.weekly.filter(e=>e.weekStart!==weekStart);
  DB.weekly.push({id:uuid(),weekStart,phq9:{items:phq,total:sum(phq)},gad7:{items:gad,total:sum(gad)},pss10:{items:pss,total:sum(pss)},who5:{items:who,total:sum(who)},notes:el('#weeklyNotes').value.trim()});
  save(); renderWeeklyList(); updateKpisAndCharts();
}
function handleDailySave(){
  const date=el('#dailyDate').value; if(!date){alert('Pick a date.');return;}
  const rec={
    id:uuid(),date,
    isDoseDay:el('#dailyDoseDay').value==='true',
    sleepHours:+el('#dailySleep').value||0,
    sleepQuality:+el('#dailySleepQuality').value||0,
    rested:+el('#dailyRested').value||0,
    mood:+el('#dailyMood').value||0,
    anxiety:+el('#dailyAnxiety').value||0,
    focus:+el('#dailyFocus').value||0,
    energy:+el('#dailyEnergy').value||0,
    stress:+el('#dailyStress').value||0,
    productivity:+el('#dailyProductivity').value||0,
    social:+el('#dailySocial').value||0,
    libido:+el('#dailyLibido').value||0,
    giNotes:el('#dailyGi').value.trim(),
    otherNotes:el('#dailyOther').value.trim(),
    adverse:el('#dailyAdverse').value==='true',
    safetyNotes:(el('#dailyAdverse').value==='true')?el('#dailyAdverseNotes').value.trim():''
  };
  if(!rec.sleepHours && !rec.mood && !rec.anxiety && !rec.focus && !rec.energy && !rec.stress){
    alert('Fill at least one quick field.'); return;
  }
  DB.daily=DB.daily.filter(e=>e.date!==date);
  DB.daily.push(rec); save(); renderDailyList(); updateKpisAndCharts();
  el('#insightBody').innerHTML = generateInsightText();
  el('#dailyForm').reset();
}

/* ----- FTT (scroll lock) ----- */
const fttState={hand:'dominant',trialCount:0,counts:[],timer:null,running:false,count:0};
function lockScroll(){document.body.style.overflow='hidden';document.body.style.position='fixed';document.body.style.width='100%';}
function unlockScroll(){document.body.style.overflow='';document.body.style.position='';document.body.style.width='';}
function startFtt(){if(fttState.running)return; fttState.hand=el('#fttHand').value; fttState.count=0; fttState.running=true; lockScroll();
  const t=el('#fttTimer'); const tap=el('#fttTapArea'); tap.textContent='Tap fast!'; if(navigator.vibrate)navigator.vibrate(40);
  let left=10; t.textContent=left+' s';
  fttState.timer=setInterval(()=>{left--; t.textContent= left>0 ? (left+' s') : 'Stop'; if(left<=0){clearInterval(fttState.timer); endFtt();}},1000);
}
function onTap(e){ if(fttState.running){ e.preventDefault(); fttState.count++; el('#fttTapArea').textContent = fttState.count; } }
function endFtt(){ fttState.running=false; unlockScroll();
  fttState.counts.push(fttState.count); fttState.trialCount++;
  const r=el('#fttResults'); r.innerHTML=`Trial ${fttState.trialCount}: ${fttState.count} taps`;
  if(navigator.vibrate)navigator.vibrate([60,40,60]);
  if(fttState.trialCount<3){ r.innerHTML += '<br>Rest 30–60 s, then start the next trial.'; }
  else { const avg=mean(fttState.counts); const date=new Date().toISOString().slice(0,10);
    DB.ftt.push({id:uuid(),date,hand:fttState.hand,trialSeconds:10,trial1:fttState.counts[0],trial2:fttState.counts[1],trial3:fttState.counts[2],avg,device:navigator.userAgent,notes:''}); save();
    r.innerHTML += `<br><strong>Average for ${fttState.hand}:</strong> ${avg.toFixed(1)} taps/10s.`;
    fttState.trialCount=0; fttState.counts=[]; updateKpisAndCharts();
  }
}

/* ----- Export / Import ----- */
function arrayToCsv(arr){ if(!arr.length) return ''; const keys=Array.from(new Set(arr.reduce((acc,o)=>acc.concat(Object.keys(o)),[]))); const lines=[keys.join(',')]; arr.forEach(o=>{const row=keys.map(k=>{const v=o[k]; if(v==null) return ''; const s=String(v); return (s.includes(',')||s.includes('\"')||s.includes('\n'))? '\"'+s.replace(/\"/g,'\"\"')+'\"': s;}); lines.push(row.join(','));}); return lines.join('\n'); }
function exportJson(){const json=JSON.stringify(DB,null,2); const blob=new Blob([json],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='microdose-data.json'; a.click();}
function exportCsvs(){const files={baseline:DB.baseline?[DB.baseline]:[],doses:DB.doses,daily:DB.daily,weekly:DB.weekly,ftt:DB.ftt,pvt:DB.pvt}; Object.entries(files).forEach(([name,arr])=>{ if(!arr.length) return; const csv=arrayToCsv(arr); const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.csv'; a.click(); });}
function showData(){el('#exportOutput').textContent=JSON.stringify(DB,null,2);}
function importData(){const t=el('#importData').value.trim(); if(!t){alert('Paste JSON to import.');return;} let obj; try{obj=JSON.parse(t);}catch(e){alert('Invalid JSON');return;} if(!obj.meta||!obj.participant||!obj.daily){alert('Invalid data format.');return;} DB=obj; save(); renderDoseList(); renderDailyList(); renderWeeklyList(); updateKpisAndCharts(); alert('Imported.');}

/* ----- Settings ----- */
function renderPattern(container,pattern){container.innerHTML='';['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((d,i)=>{const L=document.createElement('label'); const c=document.createElement('input'); c.type='checkbox'; c.checked=pattern[i]===1; L.appendChild(c); L.appendChild(document.createTextNode(' '+d)); L.style.display='flex'; L.style.alignItems='center'; L.style.gap='6px'; container.appendChild(L);});}
function initSettings(){
  const prot=el('#settingsProtocol'); const cont=el('#settingsPattern'); prot.value=DB.participant.protocol.type||'fadiman'; renderPattern(cont,DB.participant.protocol.pattern||[1,0,0,1,0,0,1]);
  if(prot.value==='custom') el('#settingsCustomPattern').classList.remove('hidden');
  prot.addEventListener('change',()=>{ if(prot.value==='custom') el('#settingsCustomPattern').classList.remove('hidden'); else el('#settingsCustomPattern').classList.add('hidden'); });
  el('#settingsLargeText').checked=document.body.classList.contains('large-text');
  el('#settingsLargeText').addEventListener('change',e=>document.body.classList.toggle('large-text',e.target.checked));
  const theme=el('#settingsTheme'); theme.value=document.body.classList.contains('light')?'light':'dark'; theme.addEventListener('change',()=>{document.body.classList.toggle('light',theme.value==='light');document.body.classList.toggle('dark',theme.value!=='light');});
  el('#settingsClear').addEventListener('click',()=>{ if(confirm('Delete all local data?')){ localStorage.removeItem(STORAGE_KEY); DB=load(); renderDoseList(); renderDailyList(); renderWeeklyList(); updateKpisAndCharts(); } });
}

/* ----- Navigation & SW ----- */
function show(id){els('main section').forEach(sec=>sec.classList.toggle('active',sec.id===id));}
function initNav(){document.getElementById('bottomNav').addEventListener('click',e=>{if(e.target.tagName==='BUTTON')show(e.target.dataset.target);});}
function registerSW(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{});} }

/* ----- Events ----- */
document.addEventListener('DOMContentLoaded',()=>{
  // Build scale UIs
  createScale(document.getElementById('phq9-questions'),phq9,phqOpts,'phq9q');
  createScale(document.getElementById('gad7-questions'),gad7,gadOpts,'gad7q');
  createScale(document.getElementById('pss10-questions'),pss10,pssOpts,'pss10q');
  createScale(document.getElementById('who5-questions'),who5,whoOpts,'who5q');
  createScale(document.getElementById('weekly-phq9'),phq9,phqOpts,'weeklyPhq');
  createScale(document.getElementById('weekly-gad7'),gad7,gadOpts,'weeklyGad');
  createScale(document.getElementById('weekly-pss10'),pss10,pssOpts,'weeklyPss');
  createScale(document.getElementById('weekly-who5'),who5,whoOpts,'weeklyWho');

  // Adverse toggles
  document.getElementById('doseAdverse').addEventListener('change',e=>{
    document.getElementById('doseAdverseNotesLabel').classList.toggle('hidden',e.target.value!=='true');
  });
  document.getElementById('dailyAdverse').addEventListener('change',e=>{
    document.getElementById('dailyAdverseNotesLabel').classList.toggle('hidden',e.target.value!=='true');
  });

  // Saves
  document.getElementById('saveBaseline').addEventListener('click',handleBaselineSave);
  document.getElementById('saveDose').addEventListener('click',()=>{
    const ts=document.getElementById('doseDate').value;if(!ts){alert('Pick date & time.');return;}
    const amount=parseFloat(document.getElementById('doseAmount').value);if(isNaN(amount)){alert('Enter dose amount.');return;}
    const unit=document.getElementById('doseUnit').value, substance=document.getElementById('doseSubstance').value, strain=document.getElementById('doseStrain').value.trim(), route=document.getElementById('doseRoute').value, withFood=document.getElementById('doseFood').value==='true', context=document.getElementById('doseContext').value.trim(), notes=document.getElementById('doseNotes').value.trim(), adverse=document.getElementById('doseAdverse').value==='true', adverseNotes=adverse?document.getElementById('doseAdverseNotes').value.trim():'';
    DB.doses.push({id:uuid(),ts:ts,doseAmount:amount,doseUnit:unit,substance,form:substance,strain,route,withFood,context,acuteNotes:notes,adverse,adverseNotes}); save(); renderDoseList(); updateKpisAndCharts(); document.getElementById('doseForm').reset(); document.getElementById('doseAdverseNotesLabel').classList.add('hidden');
  });
  document.getElementById('saveDaily').addEventListener('click',handleDailySave);
  document.getElementById('saveWeekly').addEventListener('click',handleWeeklySave);

  // FTT taps
  document.getElementById('fttStart').addEventListener('click',startFtt);
  const tap=document.getElementById('fttTapArea');
  tap.addEventListener('pointerdown',onTap,{passive:false});
  tap.addEventListener('touchmove',e=>{ if(fttState.running){ e.preventDefault(); } },{passive:false});

  // Initial render
  renderDoseList(); renderDailyList(); renderWeeklyList(); updateKpisAndCharts();
  initNav(); initSettings(); registerSW();
});
})();