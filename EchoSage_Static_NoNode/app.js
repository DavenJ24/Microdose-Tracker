(function(){'use strict';
const STORAGE_KEY='echoMicrodoseData'; let DB=load(); save();
function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return JSON.parse(raw);}catch(e){} return {daily:[],ftt:[]};}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(DB));}
function mean(a){return a.length?a.reduce((x,y)=>x+(+y||0),0)/a.length:0}
function lastN(a,n){return a.slice(Math.max(0,a.length-n))}
function updateUI(){const wrap=document.getElementById('kpis'); const last7=lastN(DB.daily,7); wrap.innerHTML=`<div class="kpi">Entries (7d): ${last7.length}</div>`;}
document.addEventListener('DOMContentLoaded',()=>{
  updateUI();
  // FTT
  let running=false,count=0,timer=null,left=10;
  const tim=document.getElementById('fttTimer'), box=document.getElementById('fttTapArea');
  document.getElementById('fttStart').addEventListener('click',()=>{ if(running) return; running=true; count=0; left=10; document.body.style.overflow='hidden'; tim.textContent=left+' s'; timer=setInterval(()=>{left--; if(left<=0){clearInterval(timer); running=false; document.body.style.overflow=''; tim.textContent='Stop'; document.getElementById('fttResults').textContent='Taps: '+count;} else tim.textContent=left+' s';},1000); });
  box.addEventListener('pointerdown',e=>{ if(running){ e.preventDefault(); count++; box.textContent=count; } },{passive:false});
  // Nav
  document.getElementById('bottomNav').addEventListener('click',e=>{ if(e.target.tagName==='BUTTON'){ document.querySelectorAll('main section').forEach(s=>s.classList.toggle('active', s.id===e.target.dataset.target)); } });
});})();