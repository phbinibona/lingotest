/* LingoTotal shared audio layer
   Complete short-phrase playback + queued long-text playback.
   Cloud TTS first; browser speech only as fallback.
*/
(function(){
  'use strict';

  const cache = new Map();
  let currentAudio = null;
  let runId = 0;
  let paused = false;

  const LANGUAGE_LOCALES = {
    english:'en-GB', en:'en-GB', 'en-gb':'en-GB',
    catalan:'ca-ES', catala:'ca-ES', català:'ca-ES', ca:'ca-ES', 'ca-es':'ca-ES',
    spanish:'es-ES', espanol:'es-ES', español:'es-ES', es:'es-ES', 'es-es':'es-ES',
    french:'fr-FR', francais:'fr-FR', français:'fr-FR', fr:'fr-FR', 'fr-fr':'fr-FR',
    german:'de-DE', deutsch:'de-DE', de:'de-DE', 'de-de':'de-DE',
    italian:'it-IT', italiano:'it-IT', it:'it-IT', 'it-it':'it-IT',
    portuguese:'pt-PT', portugues:'pt-PT', português:'pt-PT', pt:'pt-PT', 'pt-pt':'pt-PT',
    basque:'eu-ES', euskara:'eu-ES', eu:'eu-ES', 'eu-es':'eu-ES',
    japanese:'ja-JP', ja:'ja-JP', 'ja-jp':'ja-JP',
    arabic:'ar-SA', ar:'ar-SA', 'ar-sa':'ar-SA', 'ar-xa':'ar-SA'
  };

  function normaliseLanguage(value){
    const raw=String(value||'').trim();
    if(!raw) return 'en-GB';
    const key=raw.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return LANGUAGE_LOCALES[key] || LANGUAGE_LOCALES[raw.toLocaleLowerCase()] || raw;
  }

  function normaliseText(value){
    return String(value || '').replace(/\s+/g,' ').trim();
  }

  function splitSentences(text){
    const clean = normaliseText(text);
    if(!clean) return [];

    // Unicode-aware sentence grouping. Keeps sentence punctuation attached.
    const parts = clean.match(/[^.!?。！？؟]+[.!?。！？؟]+(?:["'»”’)\]]+)?|[^.!?。！？؟]+$/gu) || [clean];
    return parts.map(s=>s.trim()).filter(Boolean);
  }

  function chunkText(text, maxChars=320){
    const clean = normaliseText(text);
    if(!clean) return [];
    if(clean.length <= maxChars) return [clean];

    const sentences = splitSentences(clean);
    const chunks = [];
    let current = '';

    function pushCurrent(){
      if(current.trim()) chunks.push(current.trim());
      current = '';
    }

    for(const sentence of sentences){
      if(sentence.length <= maxChars){
        if(!current){
          current = sentence;
        }else if((current + ' ' + sentence).length <= maxChars){
          current += ' ' + sentence;
        }else{
          pushCurrent();
          current = sentence;
        }
        continue;
      }

      pushCurrent();

      // Very long sentence: split conservatively at commas/semicolons,
      // then words if necessary. Never discard the beginning of a phrase.
      const clauses = sentence.split(/(?<=[,;:،؛])\s+/u);
      let clauseBuffer = '';
      for(const clause of clauses){
        if(clause.length <= maxChars){
          if(!clauseBuffer) clauseBuffer = clause;
          else if((clauseBuffer + ' ' + clause).length <= maxChars) clauseBuffer += ' ' + clause;
          else{
            chunks.push(clauseBuffer.trim());
            clauseBuffer = clause;
          }
        }else{
          if(clauseBuffer.trim()) chunks.push(clauseBuffer.trim());
          clauseBuffer = '';
          const words = clause.split(/\s+/);
          let wordBuffer = '';
          for(const word of words){
            if(!wordBuffer) wordBuffer = word;
            else if((wordBuffer + ' ' + word).length <= maxChars) wordBuffer += ' ' + word;
            else{
              chunks.push(wordBuffer.trim());
              wordBuffer = word;
            }
          }
          if(wordBuffer.trim()) chunks.push(wordBuffer.trim());
        }
      }
      if(clauseBuffer.trim()) chunks.push(clauseBuffer.trim());
    }

    pushCurrent();
    return chunks.filter(Boolean);
  }

  function stop(){
    runId++;
    paused = false;

    if(currentAudio){
      try{
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
      }catch(e){}
      currentAudio = null;
    }
  }

  function dataUrlToBlob(dataUrl){
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, comma);
    const base64 = dataUrl.slice(comma + 1);
    const mime = (meta.match(/^data:([^;]+)/)||[])[1] || 'audio/mpeg';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], {type:mime});
  }

  async function fetchCloudAudio(text, language, speakingRate){
    language = normaliseLanguage(language);
    const key = `${language}|${speakingRate}|${text}`;
    if(cache.has(key)) return cache.get(key);

    // Primary endpoint used by the current LingoTotal pages.
    let response;
    try{
      response = await fetch('/.netlify/functions/google-tts',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text,language,speakingRate})
      });
    }catch(e){
      response = null;
    }

    if(response && response.ok){
      const contentType = String(response.headers.get('content-type')||'').toLowerCase();
      let src;

      if(contentType.includes('application/json')){
        const data = await response.json();
        if(data?.audioContent){
          const mime = data.mimeType || 'audio/mpeg';
          src = `data:${mime};base64,${data.audioContent}`;
        }
      }else{
        const blob = await response.blob();
        if(blob.size) src = URL.createObjectURL(blob);
      }

      if(src){
        cache.set(key,src);
        return src;
      }
    }

    // Compatibility endpoint used by older Quiz/Matching code.
    const legacy = await fetch('/.netlify/functions/tts',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        text,
        languageCode:language,
        speakingRate
      })
    });

    let data;
    try{ data = await legacy.json(); }catch(e){ data = null; }
    if(!legacy.ok || !data?.audioContent){
      throw new Error(data?.error || 'Audio server error');
    }

    const src = `data:${data.mimeType||'audio/mpeg'};base64,${data.audioContent}`;
    cache.set(key,src);
    return src;
  }

  function playAudioSource(src, token){
    return new Promise((resolve,reject)=>{
      if(token !== runId) return resolve(false);

      const audio = new Audio(src);
      currentAudio = audio;

      audio.onended = ()=>{
        if(currentAudio === audio) currentAudio = null;
        resolve(token === runId);
      };
      audio.onerror = ()=>{
        if(currentAudio === audio) currentAudio = null;
        reject(new Error('Audio playback error'));
      };

      audio.play().catch(reject);
    });
  }

  async function play(text, language='en-GB', speakingRate=.92, options={}){
    language = normaliseLanguage(language);
    const clean = normaliseText(text);
    if(!clean) return;

    stop();
    const token = runId;
    const maxChars = Number(options.maxChars) > 80 ? Number(options.maxChars) : 320;
    const chunks = chunkText(clean,maxChars);
    if(!chunks.length) return;

    if(typeof options.onStart === 'function'){
      try{ options.onStart({chunks:chunks.length}); }catch(e){}
    }

    try{
      // Fetch/play each chunk in order. No later chunk is allowed to
      // replace an earlier one because every run has its own token.
      for(let i=0;i<chunks.length;i++){
        if(token !== runId) return;

        const src = await fetchCloudAudio(chunks[i],language,speakingRate);
        if(token !== runId) return;

        const completed = await playAudioSource(src,token);
        if(!completed || token !== runId) return;
      }

      if(token === runId && typeof options.onEnded === 'function'){
        try{ options.onEnded(); }catch(e){}
      }
    }catch(error){
      if(token !== runId) return;
      console.error('Google Cloud TTS playback failed.', error);
      if(typeof options.onError === 'function'){
        try{ options.onError(error); }catch(e){}
      }
      throw error;
    }
  }

  function pauseToggle(){
    if(!currentAudio) return;
    if(currentAudio.paused){
      currentAudio.play().catch(()=>{});
      paused = false;
    }else{
      currentAudio.pause();
      paused = true;
    }
  }

  window.LingoAudio = {play,stop,pauseToggle,chunkText,splitSentences,normaliseLanguage};

  // Backwards-compatible name used by LingoGo, LingoReal and Matching.
  window.LingoTTS = {
    speak:(text,language='en-GB',speakingRate=.95,onEnded=null,onError=null)=>
      play(text,language,speakingRate,{onEnded,onError}),
    stop,
    pauseToggle
  };
})();
