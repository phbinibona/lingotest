/* Fully decoded phrase playback with accessible transport controls. */
(function(){
 'use strict';
 let context=null,source=null,request=null,run=0,finish=null,ticker=null,clip=null,panel=null,started=0,offset=0,state='empty',generation=0;
 const cache=new Map();
 const labels={en:['Pause','Resume','Stop','Rewind 5 seconds','Replay','Audio position','Loading audio…'],ca:['Pausa','Continua','Atura','Retrocedeix 5 segons','Torna a escoltar','Posició de l’àudio','Carregant àudio…'],es:['Pausar','Continuar','Detener','Retroceder 5 segundos','Volver a escuchar','Posición del audio','Cargando audio…'],fr:['Pause','Reprendre','Arrêter','Reculer de 5 secondes','Réécouter','Position audio','Chargement audio…'],de:['Pause','Fortsetzen','Stoppen','5 Sekunden zurück','Erneut abspielen','Audioposition','Audio wird geladen…'],it:['Pausa','Riprendi','Ferma','Indietro di 5 secondi','Riascolta','Posizione audio','Caricamento audio…'],pt:['Pausa','Continuar','Parar','Recuar 5 segundos','Ouvir novamente','Posição do áudio','A carregar áudio…'],eu:['Pausatu','Jarraitu','Gelditu','5 segundo atzera','Berriz entzun','Audioaren posizioa','Audioa kargatzen…'],ja:['一時停止','再開','停止','5秒戻る','もう一度再生','再生位置','音声を読み込み中…'],ar:['إيقاف مؤقت','متابعة','إيقاف','رجوع 5 ثوانٍ','إعادة التشغيل','موضع الصوت','جارٍ تحميل الصوت…'],el:['Παύση','Συνέχεια','Διακοπή','Πίσω 5 δευτερόλεπτα','Επανάληψη','Θέση ήχου','Φόρτωση ήχου…']};
 let words=labels.en;
 function position(){return !clip?0:state==='playing'?Math.min(clip.duration,offset+Math.max(0,context.currentTime-started)):offset;}
 function halt(){++generation;clearInterval(ticker);ticker=null;if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null;}}
 function settle(value){if(finish){const done=finish;finish=null;done(value);}}
 function draw(){if(!panel)return;const pos=position();panel.querySelector('[data-time]').textContent=state==='loading'?words[6]:(state==='ended'?'✓ ':'')+pos.toFixed(1)+' / '+(clip?.duration||0).toFixed(1)+' s';const seek=panel.querySelector('input');seek.max=String(clip?.duration||0);seek.value=String(pos);seek.disabled=!clip;panel.querySelector('[data-pause]').textContent=state==='playing'?words[0]:words[1];panel.querySelector('[data-pause]').disabled=!clip||state==='ended';panel.querySelector('[data-stop]').disabled=state==='empty'||state==='stopped';panel.querySelector('[data-rewind]').disabled=!clip;panel.querySelector('[data-replay]').disabled=!clip;}
 function mount(control){
  const ui=new URLSearchParams(location.search).get('ui')||localStorage.getItem('lingototal_ui_language')||'en';words=labels[ui]||labels.en;
  if(!panel){
   const style=document.createElement('style');style.textContent='.lt-audio-controls{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;width:100%;padding:.75rem 0;box-sizing:border-box}.lt-audio-controls button{font:inherit;padding:.5rem .75rem;border-radius:8px;border:1px solid currentColor;cursor:pointer}.lt-audio-controls input{flex:1 1 140px;min-width:100px;max-width:350px}.lt-audio-controls output{font-size:.85em;font-variant-numeric:tabular-nums}.lt-audio-controls button:disabled{opacity:.5;cursor:default}';document.head.append(style);
   panel=document.createElement('div');panel.className='lt-audio-controls';panel.setAttribute('role','group');panel.setAttribute('aria-label','Audio');
   for(const [key,action] of [['pause',pause],['stop',stop],['rewind',rewind],['replay',replay]]){const button=document.createElement('button');button.type='button';button.setAttribute('data-'+key,'');button.className='small-btn';button.onclick=()=>Promise.resolve(action()).catch(error=>{console.error(error);stop();});panel.append(button);}
   const seek=document.createElement('input');seek.type='range';seek.min='0';seek.step='.1';seek.onchange=()=>seekTo(Number(seek.value));panel.append(seek);const time=document.createElement('output');time.setAttribute('data-time','');panel.append(time);
  }
  panel.querySelector('[data-stop]').textContent=words[2];panel.querySelector('[data-rewind]').textContent=words[3];panel.querySelector('[data-replay]').textContent=words[4];panel.querySelector('input').setAttribute('aria-label',words[5]);
  const parent=control?.isConnected&&control.tagName==='BUTTON'?control.parentElement:(document.querySelector('main')||document.body);parent.append(panel);draw();
 }
 function stop(){++run;request?.abort();request=null;halt();offset=0;state=clip?'stopped':'empty';settle(false);draw();}
 async function startAt(value){
  halt();offset=Math.max(0,Math.min(value,clip.duration));state='paused';const token=run,version=generation;await context.resume();if(token!==run||version!==generation)return;
  const warm=context.createBufferSource();warm.buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.5),context.sampleRate);warm.connect(context.destination);warm.onended=()=>warm.disconnect();warm.start();
  const current=context.createBufferSource();current.buffer=clip;current.connect(context.destination);source=current;started=context.currentTime+.5;state='playing';
  current.onended=()=>{if(source!==current)return;current.disconnect();source=null;clearInterval(ticker);ticker=null;offset=clip.duration;state='ended';draw();settle(true);};
  current.start(started,offset);ticker=setInterval(draw,250);draw();
 }
 function pause(){if(!clip)return;if(state==='playing'){offset=position();halt();state='paused';draw();return;}return startAt(offset);}
 function rewind(){return seekTo(Math.max(0,position()-5));}
 function seekTo(value){if(!clip)return;const wasPlaying=state==='playing';halt();offset=Math.max(0,Math.min(value,clip.duration));state='paused';draw();if(wasPlaying)return startAt(offset);}
 function replay(){if(clip)return startAt(0);}
 async function play(text,locale='el-GR'){
  stop();clip=null;offset=0;state='loading';const token=run;const control=document.activeElement;mount(control);
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){state='empty';draw();throw new Error('Audio is unavailable in this browser.');}
  if(!context)context=new Context();
  try{
   await context.resume();if(token!==run)return false;
   const key=locale+'|'+text;let buffer=cache.get(key);
   if(!buffer){
    const controller=new AbortController();request=controller;const timeout=setTimeout(()=>controller.abort(),25000);let response;
    try{response=await fetch('/.netlify/functions/google-tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,languageCode:locale,speakingRate:.9}),signal:controller.signal});}finally{clearTimeout(timeout);if(request===controller)request=null;}
    if(!response.ok)throw new Error('Audio could not be loaded.');let bytes;
    if((response.headers.get('content-type')||'').includes('json')){const data=await response.json();if(!data.audioContent)throw new Error('Audio is empty.');const binary=atob(data.audioContent);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;}else bytes=await response.arrayBuffer();
    if(token!==run)return false;buffer=await context.decodeAudioData(bytes);if(!buffer.duration||!buffer.length)throw new Error('Audio could not be decoded.');if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,buffer);
   }
   if(token!==run)return false;clip=buffer;
   const completion=new Promise(resolve=>{finish=resolve;});await startAt(0);return await completion;
  }catch(error){if(token!==run)return false;state='empty';clip=null;halt();settle(false);draw();throw error;}
 }
 window.LingoDetectiveAudio={play,stop,pause,rewind,replay,seek:seekTo};
 window.addEventListener('pagehide',stop);
})();
