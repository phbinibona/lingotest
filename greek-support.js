/* Greek reading aid. Latin display is CSS-generated; original answers stay intact. */
(function(){
 'use strict';
 const hasGreek=s=>/[\u0370-\u03ff\u1f00-\u1fff]/u.test(String(s||''));
 const isGreek=v=>/^(el(?:-gr)?|greek|ελληνικά|ελληνικα)$/i.test(String(v||'').trim());
 const isGreekTarget=()=>isGreek(new URLSearchParams(location.search).get('target')||localStorage.getItem('lingototal_target_language')||localStorage.getItem('targetLang'));
 const letters={α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o'};
 function transliterate(text){
  const chars=Array.from(String(text).normalize('NFC'));let out='';
  for(let i=0;i<chars.length;i++){
   const raw=chars[i],nfd=raw.normalize('NFD'),base=nfd[0].toLowerCase(),next=(chars[i+1]||'').normalize('NFD'),pair=base+(next[0]||'').toLowerCase();let value=letters[base];let accent=nfd.includes('\u0301');
   if(value&&next&&!next.includes('\u0308')){
    const pairs={αι:'ai',ει:'ei',οι:'oi',ου:'ou',υι:'yi',γγ:'ng',γκ:'gk',γχ:'nch',γξ:'nx',μπ:'mp',ντ:'nt'};
    if(pairs[pair]){value=pairs[pair];accent=accent||next.includes('\u0301');i++;}
    else if(['αυ','ευ','ηυ'].includes(pair)){const following=(chars[i+2]||'').normalize('NFD')[0]?.toLowerCase();value=letters[base]+(/[κπστφχθξψ]/u.test(following||'')?'f':'v');accent=accent||next.includes('\u0301');i++;}
   }
   if(!value){out+=raw;continue;}
   if(accent)value=value.replace(/[aeiouy]/,v=>(v+'\u0301').normalize('NFC'));
   if(raw===raw.toUpperCase())value=value[0].toUpperCase()+value.slice(1);
   out+=value;
  }
  return out;
 }
 async function play(text){
  if(window.LingoAudio)return window.LingoAudio.play(text,'el-GR',.9);
  const response=await fetch('/.netlify/functions/google-tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,languageCode:'el-GR'})});
  if(!response.ok)throw new Error('Greek audio is unavailable. Please try again.');
  const data=await response.json();if(!data.audioContent)throw new Error('Greek audio is unavailable. Please try again.');
  const audio=new Audio('data:audio/mpeg;base64,'+data.audioContent);await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=reject;audio.play().catch(reject);});return true;
 }
 window.LingoGreek={transliterate,isGreekTarget,hasGreek,play};
 const originalFetch=window.fetch.bind(window);
 window.fetch=function(input,options){
  const url=typeof input==='string'?input:input?.url||'';
  if(options&&typeof options.body==='string'&&/\/\.netlify\/functions\/(?:gemini|google-tts|tts)(?:\?|$)/.test(url)){
   try{const data=JSON.parse(options.body);
    if(/\/(?:google-tts|tts)(?:\?|$)/.test(url)&&hasGreek(data.text)){data.languageCode='el-GR';data.locale='el-GR';data.lang='el-GR';data.language='Greek';}
    if(/\/gemini(?:\?|$)/.test(url)&&isGreekTarget()&&typeof data.prompt==='string')data.prompt+='\nTarget language: Modern Greek. Write target sentences and answer fields in Greek script. Preserve the requested JSON schema. Do not add Latin transliteration to answer fields; the website displays it separately.';
    options={...options,body:JSON.stringify(data)};
   }catch(e){}
  }
  return originalFetch(input,options);
 };
 const isGreekInterface=()=>{const q=new URLSearchParams(location.search);return isGreek(q.get('ui')||q.get('interface')||localStorage.getItem('lingototal_ui_language'));};
 function init(){
  let enabled=!isGreekInterface()&&new URLSearchParams(location.search).get('transliteration')!=='native'&&localStorage.getItem('lingototal_latin_transliteration')!=='false';
  const style=document.createElement('style');style.textContent='body.lt-greek-latin [data-lt-latin]::after{content:attr(data-lt-latin);display:block;font-size:.82em;font-weight:400;line-height:1.5;opacity:.8;direction:ltr;white-space:pre-wrap;margin-top:.2em}.lt-greek-control{padding:.65rem 1rem;margin:.5rem auto;max-width:1100px;font:inherit}.lt-greek-control input{margin-right:.5rem}';document.head.append(style);
  const labels={en:'Show Greek in Latin letters',ca:'Mostra el grec amb lletres llatines',es:'Mostrar el griego con letras latinas',fr:'Afficher le grec en lettres latines',de:'Griechisch mit lateinischen Buchstaben anzeigen',it:'Mostra il greco in lettere latine',pt:'Mostrar grego em letras latinas'};
  if(isGreekTarget()&&!isGreekInterface()){
   const panel=document.createElement('div');panel.className='lt-greek-control';const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=enabled;label.append(check,document.createTextNode(labels[new URLSearchParams(location.search).get('ui')]||labels.en));panel.append(label);(document.querySelector('main')||document.body).prepend(panel);
   check.addEventListener('change',()=>{enabled=check.checked;localStorage.setItem('lingototal_latin_transliteration',String(enabled));document.body.classList.toggle('lt-greek-latin',enabled);});
  }
  document.body.classList.toggle('lt-greek-latin',enabled);
  const skip='script,style,textarea,input,select,option,[contenteditable="true"],.lt-greek-control';
  function scan(){
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),items=new Map();let node;
   while(node=walker.nextNode()){const parent=node.parentElement;if(!parent||parent.closest(skip)||!hasGreek(node.nodeValue))continue;items.set(parent,(items.get(parent)||'')+node.nodeValue);}
   document.querySelectorAll('[data-lt-latin]').forEach(el=>{if(!items.has(el))el.removeAttribute('data-lt-latin');});
   items.forEach((value,el)=>{const latin=transliterate(value.trim());if(el.getAttribute('data-lt-latin')!==latin)el.setAttribute('data-lt-latin',latin);});
  }
  let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;scan();});}}).observe(document.body,{subtree:true,childList:true,characterData:true});scan();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
