
(function(){
  'use strict';
  const STORAGE_KEY = 'echoMicrodoseData';
  let DB = load(); save(); // ensure structure

  // apply settings
  if(DB.settings.theme === 'light') document.body.classList.remove('dark');
  if(DB.settings.largeText) document.body.classList.add('large-text');
  document.getElementById('themeSelect').value = DB.settings.theme;
  document.getElementById('toggleLargeText').checked = DB.settings.largeText;

  // helpers
  function load(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return {
      meta:{ appVersion:'1.4.0', createdAt: new Date().toISOString(), updatedAt:null },
      participant:{ initials:'', age:null, sexOrGender:'', handDominance:'Right', heightCm:null, weightKg:null, goals:[], protocol:{type:'', pattern:[]} },
      baseline:{ date:'', phq9:{total:0}, gad7:{total:0}, pss10:{total:0}, who5:{total:0} },
      doses:[], daily:[], weekly:[], ftt:[],
      settings:{ theme:'dark', largeText:false }
    };
  }
  function save(){ DB.meta.updatedAt = new Date().toISOString(); localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }
  function mean(arr){ return arr.length ? arr.reduce((a,b)=>a+Number(b),0)/arr.length : 0; }
  function fmtDate(d){ return new Date(d).toISOString().slice(0,10); }
  function id(){ return Math.random().toString(36).slice(2,9); }
  function byId(id){ return document.getElementById(id); }

  // dynamic show/hide
  byId('doseSubstance').addEventListener('change', e=>{
    byId('otherSubstanceField').style.display = (e.target.value==='other')?'block':'none';
  });
  document.querySelectorAll('.goalChk').forEach(chk=>{
    chk.addEventListener('change', ()=>{
      const otherChecked = Array.from(document.querySelectorAll('.goalChk')).some(c=>c.value==='other' && c.checked);
      byId('goalOtherField').style.display = otherChecked ? 'block' : 'none';
    });
  });
  document.getElementsByName('protocol').forEach(r=>{
    r.addEventListener('change', e=> byId('customPatternBuilder').style.display = (e.target.value==='custom')?'block':'none');
  });
  byId('dailyAdverse').addEventListener('change', e=> byId('dailyAdverseNotesField').style.display = e.target.checked?'block':'none');
  byId('doseAdverse').addEventListener('change', e=> byId('doseAdverseNotesField').style.display = e.target.checked?'block':'none');
  byId('toggleDailyMore').addEventListener('click', ()=>{
    const more = byId('dailyMore'); const showing = more.style.display!=='none';
    more.style.display = showing ? 'none' : 'block';
    byId('toggleDailyMore').textContent = showing ? 'Show More Fields' : 'Hide Extra Fields';
  });

  // theme + text size
  byId('themeSelect').addEventListener('change', e=>{
    DB.settings.theme = e.target.value;
    if(DB.settings.theme==='light') document.body.classList.remove('dark'); else document.body.classList.add('dark');
    save();
  });
  byId('toggleLargeText').addEventListener('change', e=>{
    DB.settings.largeText = e.target.checked;
    document.body.classList.toggle('large-text', DB.settings.largeText);
    save();
  });

  // nav switching
  byId('bottomNav').addEventListener('click', e=>{
    if(e.target.tagName!=='BUTTON') return;
    const targetId = e.target.getAttribute('data-target');
    document.querySelectorAll('main section').forEach(sec=> sec.classList.toggle('active', sec.id===targetId));
    document.querySelectorAll('#bottomNav button').forEach(btn=> btn.classList.toggle('active-tab', btn.getAttribute('data-target')===targetId));
  });

  // Save Baseline
  byId('saveBaseline').addEventListener('click', ()=>{
    DB.participant.initials = byId('partInitials').value.trim();
    DB.participant.age = Number(byId('partAge').value)||null;
    DB.participant.sexOrGender = byId('partGender').value.trim();
    DB.participant.handDominance = byId('partHand').value;
    DB.participant.heightCm = Number(byId('partHeight').value)||null;
    DB.participant.weightKg = Number(byId('partWeight').value)||null;

    const goals = Array.from(document.querySelectorAll('.goalChk')).filter(c=>c.checked).map(c=>c.value);
    if(goals.includes('other')){
      const other = byId('goalOtherInput').value.trim(); 
      DB.participant.goals = goals.filter(g=>g!=='other'); 
      if(other) DB.participant.goals.push(other);
    } else DB.participant.goals = goals;

    const protocolType = document.querySelector('input[name="protocol"]:checked')?.value || '';
    DB.participant.protocol.type = protocolType;
    if(protocolType==='custom'){
      DB.participant.protocol.pattern = Array.from(document.querySelectorAll('#customPatternBuilder .patternDay:checked')).map(c=>Number(c.value));
    } else if(protocolType==='fadiman'){ DB.participant.protocol.pattern = [0,3,6]; } // example Mon/Thu/Sun rolling
      else if(protocolType==='stamets'){ DB.participant.protocol.pattern = [0,1,2,3]; } // Mon-Thu

    DB.baseline = {
      date: new Date().toISOString(),
      phq9:{ total: Number(byId('b_phq9_total').value)||0 },
      gad7:{ total: Number(byId('b_gad7_total').value)||0 },
      pss10:{ total: Number(byId('b_pss10_total').value)||0 },
      who5:{ total: Number(byId('b_who5_total').value)||0 },
    };
    save(); renderKPIs(); renderInsights();
    alert('Baseline saved.');
  });

  // Add Dose
  byId('addDose').addEventListener('click', ()=>{
    const sub = byId('doseSubstance').value==='other' ? (byId('otherSubstanceInput').value.trim()||'other') : byId('doseSubstance').value;
    const rec = {
      id: id(),
      ts: byId('doseDatetime').value || new Date().toISOString(),
      amount: Number(byId('doseAmount').value)||0,
      unit: byId('doseUnit').value,
      substance: sub,
      strain: byId('doseStrain').value.trim(),
      route: byId('doseRoute').value,
      withFood: byId('doseWithFood').checked,
      context: byId('doseContext').value.trim(),
      notes: byId('doseNotes').value.trim(),
      adverse: byId('doseAdverse').checked,
      adverseNotes: byId('doseAdverseNotes').value.trim()
    };
    DB.doses.unshift(rec); save(); renderDoseList();
    alert('Dose added.'); 
  });

  function renderDoseList(){
    const ul = byId('doseList'); ul.innerHTML='';
    DB.doses.slice(0,100).forEach(d=>{
      const li = document.createElement('li');
      li.textContent = `${fmtDate(d.ts)} • ${d.amount}${d.unit} ${d.substance}${d.strain?(' ('+d.strain+')'):''}${d.adverse?' ⚠':''}`;
      ul.appendChild(li);
    });
  }

  // Daily Save
  byId('saveDaily').addEventListener('click', ()=>{
    const rec = {
      id:id(), date: new Date().toISOString(),
      isDoseDay: byId('dailyIsDoseDay').checked,
      mood:Number(byId('dailyMood').value)||null,
      anxiety:Number(byId('dailyAnxiety').value)||null,
      focus:Number(byId('dailyFocus').value)||null,
      energy:Number(byId('dailyEnergy').value)||null,
      sleepHours:Number(byId('dailySleepHours').value)||null,
      sleepQuality:Number(byId('dailySleepQuality').value)||null,
      rested:Number(byId('dailyRested').value)||null,
      stress:Number(byId('dailyStress').value)||null,
      productivity:Number(byId('dailyProductivity').value)||null,
      social:Number(byId('dailySocial').value)||null,
      libido:Number(byId('dailyLibido').value)||null,
      gi: byId('dailyGINotes').value.trim(),
      other: byId('dailyOtherNotes').value.trim(),
      adverse: byId('dailyAdverse').checked,
      adverseNotes: byId('dailyAdverseNotes').value.trim()
    };
    DB.daily.push(rec); save(); renderKPIs(); drawCharts(); renderInsights();
    alert('Daily entry saved.');
  });

  // Weekly Save
  byId('saveWeekly').addEventListener('click', ()=>{
    const rec = {
      id:id(), weekEnding: new Date().toISOString(),
      phq9:{ total:Number(byId('w_phq9_total').value)||0 },
      gad7:{ total:Number(byId('w_gad7_total').value)||0 },
      pss10:{ total:Number(byId('w_pss10_total').value)||0 },
      who5:{ total:Number(byId('w_who5_total').value)||0 },
      notes: byId('weeklyNotes').value.trim()
    };
    DB.weekly.push(rec); save(); drawCharts(); renderInsights();
    byId('weeklyResult').textContent = `Saved. PHQ‑9 ${rec.phq9.total}, GAD‑7 ${rec.gad7.total}, PSS‑10 ${rec.pss10.total}, WHO‑5 ${rec.who5.total}`;
  });

  // FTT
  let fttRunning=false, fttCount=0, fttTimer=null, fttStartAt=0;
  byId('fttTapArea').addEventListener('click', ()=>{ if(fttRunning) fttCount++; });
  byId('fttStart').addEventListener('click', ()=>{
    if(fttRunning) return;
    fttRunning=true; fttCount=0; fttStartAt=Date.now();
    byId('fttTimer').textContent='10.0s';
    fttTimer=setInterval(()=>{
      const left = 10000 - (Date.now()-fttStartAt);
      if(left <= 0){
        clearInterval(fttTimer); fttRunning=false;
        const hand = byId('fttHand').value;
        const rec = { id:id(), ts:new Date().toISOString(), hand, taps: fttCount };
        DB.ftt.push(rec); save(); drawCharts(); renderInsights();
        byId('fttResults').textContent = `Trial saved: ${hand} hand — ${fttCount} taps / 10s`;
        byId('fttTimer').textContent='Done';
      }else{
        byId('fttTimer').textContent=(left/1000).toFixed(1)+'s';
      }
    }, 50);
  });

  // Export / Import
  function toCSV(rows, headers){
    const cols = headers;
    const lines = [cols.join(',')];
    rows.forEach(r=>{
      const line = cols.map(c=>JSON.stringify(r[c] ?? '')).join(',');
      lines.push(line);
    });
    return lines.join('\n');
  }
  function downloadFile(name, text, mime='text/plain'){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type:mime}));
    a.download = name; a.click();
  }
  byId('copyJSON').addEventListener('click', ()=>{
    navigator.clipboard.writeText(JSON.stringify(DB, null, 2));
    alert('JSON copied to clipboard.');
  });
  byId('downloadJSON').addEventListener('click', ()=> downloadFile('echo_microdose.json', JSON.stringify(DB, null, 2), 'application/json') );
  document.querySelectorAll('.copyCsvBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const which = btn.dataset.csv;
      const csv = csvFor(which);
      navigator.clipboard.writeText(csv);
      alert(which+'.csv copied.');
    });
  });
  document.querySelectorAll('.downloadCsvBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const which = btn.dataset.csv;
      const csv = csvFor(which);
      downloadFile(which+'.csv', csv, 'text/csv');
    });
  });
  function csvFor(which){
    if(which==='baseline'){
      const b = DB.baseline;
      return ['date,phq9_total,gad7_total,pss10_total,who5_total',
              [b.date, b.phq9.total, b.gad7.total, b.pss10.total, b.who5.total].join(',')].join('\n');
    }
    if(which==='doses'){
      const headers=['ts','amount','unit','substance','strain','route','withFood','context','notes','adverse','adverseNotes'];
      return toCSV(DB.doses, headers);
    }
    if(which==='daily'){
      const headers=['date','isDoseDay','mood','anxiety','focus','energy','sleepHours','sleepQuality','rested','stress','productivity','social','libido','gi','other','adverse','adverseNotes'];
      return toCSV(DB.daily, headers);
    }
    if(which==='weekly'){
      const rows = DB.weekly.map(w=>({
        weekEnding:w.weekEnding, phq9_total:w.phq9.total, gad7_total:w.gad7.total, pss10_total:w.pss10.total, who5_total:w.who5.total, notes:w.notes
      }));
      return toCSV(rows, ['weekEnding','phq9_total','gad7_total','pss10_total','who5_total','notes']);
    }
    if(which==='ftt'){
      const headers=['ts','hand','taps'];
      return toCSV(DB.ftt, headers);
    }
    return '';
  }
  byId('importJSON').addEventListener('click', ()=>{
    try{
      const parsed = JSON.parse(byId('importData').value);
      DB = parsed; save(); renderDoseList(); drawCharts(); renderKPIs(); renderInsights();
      alert('Import complete.');
    }catch(e){ alert('Invalid JSON'); }
  });

  // KPIs + Insights
  function renderKPIs(){
    const k = byId('kpis'); k.innerHTML='';
    const last7 = DB.daily.slice(-7);
    const avgMood = mean(last7.map(d=>d.mood||0)).toFixed(1);
    const avgAnx = mean(last7.map(d=>d.anxiety||0)).toFixed(1);
    const avgStress = mean(last7.map(d=>d.stress||0)).toFixed(1);
    const avgSleep = mean(last7.map(d=>d.sleepHours||0)).toFixed(1);
    const bestFTT = Math.max(0, ...DB.ftt.map(f=>f.taps||0));
    const items = [
      ['7‑day Mood', avgMood],
      ['7‑day Anxiety', avgAnx],
      ['7‑day Stress', avgStress],
      ['7‑day Sleep h', avgSleep],
      ['Best FTT', bestFTT]
    ];
    items.forEach(([label,val])=>{
      const div = document.createElement('div'); div.className='kpi';
      div.innerHTML = `<div>${label}</div><div style="font-size:1.4em">${val}</div>`;
      k.appendChild(div);
    });
  }

  function renderInsights(){
    const div = byId('insights'); div.innerHTML='';
    if(DB.weekly.length>=2){
      const last = DB.weekly[DB.weekly.length-1];
      const prev = DB.weekly[DB.weekly.length-2];
      const dPhq = last.phq9.total - prev.phq9.total;
      const dGad = last.gad7.total - prev.gad7.total;
      const dPss = last.pss10.total - prev.pss10.total;
      const dWho = last.who5.total - prev.who5.total;
      const p = document.createElement('p');
      p.className='muted';
      p.textContent = `Week-over-week: PHQ‑9 ${sign(dPhq)}, GAD‑7 ${sign(dGad)}, PSS‑10 ${sign(dPss)}, WHO‑5 ${sign(dWho)}.`;
      div.appendChild(p);
    }else{
      const p = document.createElement('p'); p.className='muted';
      p.textContent = 'Log a few daily entries and at least two weekly check‑ins to see insights here.';
      div.appendChild(p);
    }
    function sign(x){ return (x>0?'+':'')+x; }
  }

  // Charts
  let charts = {};
  function drawCharts(){
    const labels = DB.daily.map(d=>fmtDate(d.date));
    const mood = DB.daily.map(d=>d.mood);
    const anx = DB.daily.map(d=>d.anxiety);
    const stress = DB.daily.map(d=>d.stress);
    const sleep = DB.daily.map(d=>d.sleepHours);
    const ftt = DB.ftt.map(f=>f.taps);
    const fttLabels = DB.ftt.map(f=>fmtDate(f.ts));

    charts.chartMood = drawLine('chartMood', labels, mood, 'Mood (1–10)');
    charts.chartAnxiety = drawLine('chartAnxiety', labels, anx, 'Anxiety (0–10)');
    charts.chartStress = drawLine('chartStress', labels, stress, 'Stress (0–10)');
    charts.chartSleep = drawLine('chartSleep', labels, sleep, 'Sleep Hours');
    charts.chartFTT = drawLine('chartFTT', fttLabels, ftt, 'FTT Taps (per 10s)');
  }
  function drawLine(canvasId, labels, data, label){
    const ctx = document.getElementById(canvasId);
    if(!ctx) return null;
    if(ctx._chart){ ctx._chart.destroy(); }
    const c = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ label, data, fill:false, tension:0.25 }] },
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
    ctx._chart = c; return c;
  }

  // settings save
  byId('saveProtocol').addEventListener('click', ()=>{
    const type = document.querySelector('input[name="setProtocol"]:checked')?.value || DB.participant.protocol.type || 'custom';
    DB.participant.protocol.type = type;
    if(type==='custom'){
      byId('settingsCustomPattern').style.display='block';
      DB.participant.protocol.pattern = Array.from(document.querySelectorAll('#settingsForm .patternDay:checked')).map(c=>Number(c.value));
    }else{
      byId('settingsCustomPattern').style.display='none';
      if(type==='fadiman') DB.participant.protocol.pattern=[0,3,6];
      if(type==='stamets') DB.participant.protocol.pattern=[0,1,2,3];
    }
    save(); alert('Protocol saved.');
  });

  // clear all data
  byId('clearData').addEventListener('click', ()=>{
    if(confirm('Erase ALL data and reset the app?')){
      localStorage.removeItem(STORAGE_KEY);
      DB = load(); save();
      location.reload();
    }
  });

  // initial renders
  renderDoseList(); renderKPIs(); drawCharts(); renderInsights();
})();
