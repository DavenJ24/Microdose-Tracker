(function(){
const STORAGE_KEY='echoMicrodoseData';
let DB=load();

function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return JSON.parse(raw)}catch{}return {daily:[],doses:[],weekly:[],ftt:[]};}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(DB));}

function uuid(){return Math.random().toString(36).slice(2);}
function updateSummary(){document.getElementById('statsSummary').innerHTML=`Entries: ${DB.daily.length}`;}

function show(id){document.querySelectorAll('main section').forEach(s=>s.classList.toggle('active',s.id===id));}

document.getElementById('saveDaily').onclick=()=>{const date=document.getElementById('dailyDate').value,mood=+document.getElementById('dailyMood').value;if(!date)return;DB.daily.push({id:uuid(),date,mood});save();updateSummary();};
document.getElementById('saveDose').onclick=()=>{const d=document.getElementById('doseDate').value,a=+document.getElementById('doseAmount').value;if(!d||!a)return;DB.doses.push({id:uuid(),ts:d,amount:a});save();};
document.getElementById('saveWeekly').onclick=()=>{const w=document.getElementById('weeklyDate').value;if(!w)return;DB.weekly.push({id:uuid(),weekStart:w});save();};

// FTT
let fttRunning=false,count=0,timer=null;
document.getElementById('fttStart').onclick=()=>{if(fttRunning)return;fttRunning=true;count=0;document.body.style.overflow='hidden';let left=10;document.getElementById('fttTimer').textContent=left+'s';timer=setInterval(()=>{left--;if(left<=0){clearInterval(timer);fttRunning=false;document.body.style.overflow='';document.getElementById('fttResults').textContent='Taps: '+count;DB.ftt.push({id:uuid(),date:new Date().toISOString().slice(0,10),count});save();updateSummary();}else{document.getElementById('fttTimer').textContent=left+'s';}},1000);};
document.getElementById('fttTapArea').addEventListener('pointerdown',e=>{if(fttRunning){e.preventDefault();count++;document.getElementById('fttTapArea').textContent=count;}});

// Export/Import
document.getElementById('exportJson').onclick=()=>{const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='data.json';a.click();};
document.getElementById('showData').onclick=()=>{document.getElementById('exportOutput').textContent=JSON.stringify(DB,null,2);};
document.getElementById('importJson').onclick=()=>{try{DB=JSON.parse(document.getElementById('importData').value);save();updateSummary();alert('Imported');}catch{alert('Bad JSON');}};
document.getElementById('settingsClear').onclick=()=>{if(confirm('Clear all data?')){DB={daily:[],doses:[],weekly:[],ftt:[]};save();updateSummary();}};

document.getElementById('bottomNav').onclick=e=>{if(e.target.tagName==='BUTTON')show(e.target.dataset.target);};

updateSummary();
})();