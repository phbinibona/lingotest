import {LANGUAGES,TRANSLATIONS,resolveLanguage,setLanguage} from './julien-languages.js?v=20261004multi';
(()=>{
const $=id=>document.getElementById(id),lang=resolveLanguage(new URLSearchParams(location.search),localStorage),dictionary=TRANSLATIONS[lang],copy=dictionary.access;
document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.title=dictionary.copy[0];$('accessGate').querySelector('h1').textContent=$('title').textContent=dictionary.copy[0];
const languageLabel=document.createElement('label');languageLabel.htmlFor='accessLanguage';languageLabel.textContent=dictionary.languageLabel;
const languageSelect=document.createElement('select');languageSelect.id='accessLanguage';
for(const [code,info] of Object.entries(LANGUAGES)){const option=document.createElement('option');option.value=code;option.textContent=info[1];languageSelect.append(option)}languageSelect.value=lang;languageSelect.onchange=()=>setLanguage(languageSelect.value);
$('accessGate').insertBefore(languageLabel,$('accessIntro'));$('accessGate').insertBefore(languageSelect,$('accessIntro'));
['accessIntro','accessLabel','accessSubmit'].forEach((id,i)=>$(id).textContent=copy[i]);
let loaded=false;
async function unlock(){if(loaded)return;await import('./lingojulienchat.js?v=20261004multi');loaded=true;$('accessCode').value='';$('accessGate').hidden=true;$('julienActivity').hidden=false}
$('accessForm').onsubmit=async event=>{event.preventDefault();$('accessSubmit').disabled=true;$('accessStatus').textContent=copy[3];try{const r=await fetch('/.netlify/functions/verify-julien-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('accessCode').value})});if(r.ok){await unlock()}else{$('accessStatus').textContent=copy[r.status===503?5:4]}}catch{$('accessStatus').textContent=copy[6]}finally{$('accessSubmit').disabled=false}};
fetch('/.netlify/functions/verify-julien-code').then(r=>r.json()).then(d=>{if(d.authorized)return unlock()}).catch(()=>{});
})();
