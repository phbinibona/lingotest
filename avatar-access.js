(()=>{
const $=id=>document.getElementById(id),raw=new URLSearchParams(location.search).get('ui')||localStorage.getItem('lingototal_ui_language')||'en',lang=raw.startsWith('ca')?'ca':raw.startsWith('es')?'es':raw.startsWith('fr')?'fr':'en';
const text={en:['Avatar activities','Enter the access code you have been given.','Access code','Unlock activity','Checking…','This code was not accepted. Please try again.','Access has not been configured yet. Please contact your tutor.','Could not check access. Please try again.'],ca:['Activitats amb avatars','Introdueix el codi d’accés que t’han donat.','Codi d’accés','Accedeix a l’activitat','Comprovant…','El codi no és vàlid. Torna-ho a provar.','L’accés encara no està configurat. Contacta amb el tutor.','No s’ha pogut comprovar l’accés. Torna-ho a provar.'],es:['Actividades con avatares','Introduce el código de acceso que te han dado.','Código de acceso','Acceder a la actividad','Comprobando…','Código no válido. Inténtalo de nuevo.','El acceso todavía no está configurado. Contacta con tu tutor.','No se pudo comprobar el acceso. Inténtalo de nuevo.'],fr:['Activités avec avatars','Saisis le code d’accès qui t’a été donné.','Code d’accès','Accéder à l’activité','Vérification…','Code non valide. Réessaie.','L’accès n’est pas encore configuré. Contacte ton tuteur.','Impossible de vérifier l’accès. Réessaie.']}[lang];
['avatarAccessTitle','avatarAccessIntro','avatarAccessLabel','avatarAccessSubmit'].forEach((id,i)=>$(id).textContent=text[i]);
let loaded=false;
async function unlock(){
 if(loaded)return;
 for(const pending of document.querySelectorAll('script[data-avatar-script]')){
  const script=document.createElement('script');script.type=pending.dataset.avatarType;script.async=false;
  if(pending.hasAttribute('src'))script.src=pending.getAttribute('src');else script.textContent=pending.textContent;
  const ready=script.src||script.type==='module'?new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Activity could not load'))}):Promise.resolve();
  document.body.append(script);await ready;
 }
 loaded=true;$('avatarAccessCode').value='';$('avatarAccessGate').hidden=true;$('avatarProtectedActivity').hidden=false;
}
$('avatarAccessForm').onsubmit=async e=>{e.preventDefault();$('avatarAccessSubmit').disabled=true;$('avatarAccessStatus').textContent=text[4];try{const r=await fetch('/.netlify/functions/verify-julien-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('avatarAccessCode').value})});if(r.ok)await unlock();else $('avatarAccessStatus').textContent=text[r.status===503?6:5]}catch{$('avatarAccessStatus').textContent=text[7]}finally{$('avatarAccessSubmit').disabled=false}};
fetch('/.netlify/functions/verify-julien-code').then(r=>r.json()).then(d=>{if(d.authorized)return unlock()}).catch(()=>{$('avatarAccessStatus').textContent=text[7]});
})();
