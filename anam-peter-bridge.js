// Anam renders Olivia; Gemini controls her exact words. No camera or Anam microphone input.
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const button=$('anamStart'),end=$('anamStop'),status=$('anamStatus'),host=$('anamHost');
  const video=document.createElement('video');video.id='anamVideo';video.autoplay=true;video.playsInline=true;
  video.setAttribute('aria-label','Olivia, your conversation teacher');
  let client=null,active=false,serial=Promise.resolve();
  const params=new URLSearchParams(location.search);
  const interfaceValue=(params.get('ui')||params.get('interface')||localStorage.getItem('lingototal_ui_language')||localStorage.getItem('interfaceLanguage')||'en').toLowerCase();
  const ui=({english:'en',español:'es',spanish:'es',français:'fr',french:'fr',català:'ca',catalan:'ca'})[interfaceValue]||interfaceValue.slice(0,2);
  const labels={en:['Meet your teacher Olivia','End session','Connecting to Olivia…','Olivia is ready'],es:['Conoce a tu profesora Olivia','Terminar sesión','Conectando con Olivia…','Olivia está lista'],fr:['Rencontrez votre professeure Olivia','Terminer la séance','Connexion à Olivia…','Olivia est prête'],ca:['Coneix la teva professora Olivia','Acaba la sessió','Connectant amb Olivia…','L’Olivia està a punt']}[ui]||['Meet your teacher Olivia','End session','Connecting to Olivia…','Olivia is ready'];
  button.textContent=labels[0];end.textContent=labels[1];
  const setStatus=value=>{status.textContent=value};
  function move(id){if(!active)return;const panel=$(id);if(!panel)return;(panel.querySelector('.model-box,.avatar-feedback')||panel).prepend(host)}
  async function stop(){active=false;window.LingoOliviaResetWelcome?.();document.body.classList.remove('anam-on');end.hidden=true;button.disabled=false;host.hidden=true;document.querySelector('.hero').append(host);if(client){const old=client;client=null;try{await old.stopStreaming()}catch(error){console.warn('Anam stop:',error)}}}
  function speak(value){if(!active||!client||!String(value||'').trim())return Promise.resolve(false);
    serial=serial.catch(()=>{}).then(async()=>{if(!active||!client)return false;await client.talk(String(value));return true});return serial}
  function speakSequence(feedback,question){
    if(!active||!client)return Promise.resolve(false);
    serial=serial.catch(()=>{}).then(async()=>{
      if(!active||!client)return false;
      const stream=client.createTalkMessageStream();
      await stream.streamMessageChunk(String(feedback),false,crypto.randomUUID());
      await stream.streamMessageChunk(String(question),true,crypto.randomUUID());
      return true;
    });
    return serial;
  }
  async function start(){button.disabled=true;setStatus(labels[2]);try{
    const response=await fetch('/.netlify/functions/anam-session',{method:'POST'}),data=await response.json();
    if(!response.ok)throw Error(data.error||'Anam is unavailable.');
    const {createClient,AnamEvent}=await import('https://esm.sh/@anam-ai/js-sdk@4.26.0');
    client=createClient(data.sessionToken,{disableInputAudio:true});
    // streamToVideoElement can resolve before the peer and persona are ready for talk().
    // Subscribe before streaming because Anam emits startup events during that call.
    let resolveReady;
    const ready=new Promise(resolve=>{resolveReady=resolve});
    client.addListener(AnamEvent.SESSION_READY,()=>resolveReady());
    client.addListener(AnamEvent.CONNECTION_CLOSED,()=>{if(active){stop();setStatus('Olivia disconnected. You can try again.')}});
    host.replaceChildren(video);host.hidden=false;
    await client.streamToVideoElement('anamVideo');
    await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Olivia did not become ready. Please try again.')),25000))]);
    active=true;document.body.classList.add('anam-on');end.hidden=false;setStatus(labels[3]);
    await window.LingoOliviaWelcome?.();
    const panel=document.querySelector('.step-panel.active:not(.hidden)');
    if(panel?.id==='promptPanel')await window.LingoOliviaTurn?.();
    else if(panel?.id==='retryPanel')move('retryPanel');
  }catch(error){console.error('Anam:',error);await stop();setStatus(error.message)}}
  button.addEventListener('click',start);
  end.addEventListener('click',()=>{stop();setStatus('')});
  window.addEventListener('pagehide',()=>{stop()});
  window.LingoLiveAvatar={get active(){return active},move,speak,speakSequence,stop};
})();
