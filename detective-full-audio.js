/* Fully decoded Greek playback: no streaming position or partial media readiness. */
(function(){
 'use strict';
 let context=null,source=null,request=null,run=0,finish=null,ticker=null;
 const cache=new Map();
 function stop(){
  ++run;request?.abort();request=null;clearInterval(ticker);ticker=null;
  if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null;}
  if(finish){const resolve=finish;finish=null;resolve(false);}
 }
 async function play(text,locale='el-GR'){
  stop();const token=run;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw new Error('Full-phrase audio is unavailable in this browser.');
  if(!context)context=new Context();
  // Resume immediately inside the Listen gesture, before awaiting the network.
  await context.resume();if(token!==run)return false;
  const control=document.activeElement;let status=null;
  if(control?.tagName==='BUTTON'){
   status=control.parentElement.querySelector('[data-full-audio-status]');
   if(!status){status=document.createElement('output');status.setAttribute('data-full-audio-status','');status.setAttribute('aria-live','polite');control.parentElement.append(status);}
   status.textContent='🔊 …';
  }
  const key=locale+'|'+text;let buffer=cache.get(key);
  try{
   if(!buffer){
    const controller=new AbortController();request=controller;
    const timeout=setTimeout(()=>controller.abort(),25000);
    let response;
    try{response=await fetch('/.netlify/functions/google-tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,languageCode:locale,speakingRate:.9}),signal:controller.signal});}
    finally{clearTimeout(timeout);if(request===controller)request=null;}
    if(!response.ok)throw new Error('Greek audio could not be loaded.');
    let bytes;
    if((response.headers.get('content-type')||'').includes('json')){
     const data=await response.json();if(!data.audioContent)throw new Error('Greek audio is empty.');
     const binary=atob(data.audioContent);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;
    }else bytes=await response.arrayBuffer();
    if(token!==run)return false;
    buffer=await context.decodeAudioData(bytes);
    if(!buffer.duration||!buffer.length)throw new Error('Greek audio could not be decoded.');
    if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,buffer);
   }
   if(token!==run)return false;
   await context.resume();if(token!==run)return false;
   // Warm the output device, then schedule the complete buffer from offset zero.
   const warm=context.createBufferSource();warm.buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.5),context.sampleRate);warm.connect(context.destination);warm.onended=()=>warm.disconnect();warm.start();
   const current=context.createBufferSource();current.buffer=buffer;current.connect(context.destination);source=current;
   const starts=context.currentTime+.5;
   if(status)status.textContent='🔊 0.0 / '+buffer.duration.toFixed(1)+' s';
   return await new Promise(resolve=>{
    finish=resolve;
    ticker=setInterval(()=>{if(status)status.textContent='🔊 '+Math.min(buffer.duration,Math.max(0,context.currentTime-starts)).toFixed(1)+' / '+buffer.duration.toFixed(1)+' s';},250);
    current.onended=()=>{clearInterval(ticker);ticker=null;current.disconnect();if(source===current)source=null;finish=null;if(status)status.textContent='✓ '+buffer.duration.toFixed(1)+' / '+buffer.duration.toFixed(1)+' s';resolve(true);};
    current.start(starts,0);
   });
  }catch(error){if(token!==run)return false;if(status)status.textContent='⚠ 🔊';throw error;}
 }
 window.LingoDetectiveAudio={play,stop};
 window.addEventListener('pagehide',stop);
})();
