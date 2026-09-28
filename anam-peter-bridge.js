// Anam renders Peter; Gemini controls his exact words. No camera or Anam microphone input.
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const button=$('anamStart'),end=$('anamStop'),status=$('anamStatus'),host=$('anamHost');
  const video=document.createElement('video');video.id='anamVideo';video.autoplay=true;video.playsInline=true;
  video.setAttribute('aria-label','Peter, your conversation teacher');
  let client=null,active=false,serial=Promise.resolve();
  const ui=(new URLSearchParams(location.search).get('ui')||localStorage.getItem('lingototal_ui_language')||'en').slice(0,2);
  const labels={en:['Meet your teacher Peter','End session','Connecting to Peter…','Peter is ready'],es:['Conoce a tu profesor Peter','Terminar sesión','Conectando con Peter…','Peter está listo'],fr:['Rencontrez votre professeur Peter','Terminer la séance','Connexion à Peter…','Peter est prêt'],ca:['Coneix el teu professor Peter','Acaba la sessió','Connectant amb Peter…','En Peter està a punt']}[ui]||['Meet your teacher Peter','End session','Connecting to Peter…','Peter is ready'];
  button.textContent=labels[0];end.textContent=labels[1];
  const setStatus=value=>{status.textContent=value};
  function move(id){if(!active)return;const panel=$(id);if(!panel)return;(panel.querySelector('.model-box,.avatar-feedback')||panel).prepend(host)}
  async function stop(){active=false;document.body.classList.remove('anam-on');end.hidden=true;button.disabled=false;host.hidden=true;document.querySelector('.hero').append(host);if(client){const old=client;client=null;try{await old.stopStreaming()}catch(error){console.warn('Anam stop:',error)}}}
  function speak(value){if(!active||!client||!String(value||'').trim())return Promise.resolve(false);
    serial=serial.catch(()=>{}).then(async()=>{if(!active||!client)return false;await client.talk(String(value));return true});return serial}
  async function start(){button.disabled=true;setStatus(labels[2]);try{
    const response=await fetch('/.netlify/functions/anam-session',{method:'POST'}),data=await response.json();
    if(!response.ok)throw Error(data.error||'Anam is unavailable.');
    const {createClient,AnamEvent}=await import('https://esm.sh/@anam-ai/js-sdk@4.26.0');
    client=createClient(data.sessionToken,{disableInputAudio:true});
    client.addListener(AnamEvent.CONNECTION_CLOSED,()=>{if(active){stop();setStatus('Peter disconnected. You can try again.')}});
    host.replaceChildren(video);host.hidden=false;
    await client.streamToVideoElement('anamVideo');
    active=true;document.body.classList.add('anam-on');end.hidden=false;setStatus(labels[3]);
    await window.LingoPeterWelcome?.();
    const panel=document.querySelector('.step-panel.active:not(.hidden)');
    if(panel?.id==='promptPanel')await window.LingoPeterTurn?.();
    else if(panel?.id==='retryPanel')move('retryPanel');
  }catch(error){console.error('Anam:',error);await stop();setStatus(error.message)}}
  button.addEventListener('click',start);
  end.addEventListener('click',()=>{stop();setStatus('')});
  window.addEventListener('pagehide',()=>{stop()});
  window.LingoLiveAvatar={get active(){return active},move,speak,stop};
})();
