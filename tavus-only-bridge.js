// Tavus Echo mode renders LingoChat's existing Gemini text. The learner's
// microphone and transcript remain in LingoChat, outside the Tavus room.
(() => {
  'use strict';
  const startButton = document.getElementById('tavusStart');
  const stopButton = document.getElementById('tavusStop');
  const status = document.getElementById('tavusStatus');
  const host = document.getElementById('tavusHost');
  const native = {active:false,move(){},speak(){return Promise.resolve(false)}};
  let call = null, conversationId = '', active = false, generation = 0;
  const remoteVideo = document.createElement('video');
  const remoteAudio = document.createElement('audio');
  remoteVideo.autoplay = true; remoteVideo.playsInline = true; remoteVideo.muted = true;
  remoteVideo.setAttribute('aria-label', 'Tavus teacher video');
  remoteAudio.autoplay = true;
  let pendingSpeech = null;
  const ui = (new URLSearchParams(location.search).get('ui') ||
    localStorage.getItem('lingototal_ui_language') || 'en').slice(0, 2).toLowerCase();
  const labels = { en: ['Meet your teacher Peter', 'End Tavus', 'Connecting to Tavus…', 'Tavus teacher ready'],
    es: ['Conoce a tu profesor Peter', 'Terminar Tavus', 'Conectando con Tavus…', 'Profesor Tavus preparado'],
    ca: ['Coneix el teu professor Peter', 'Atura Tavus', 'Connectant amb Tavus…', 'Professor Tavus preparat'],
    fr: ['Rencontrez votre professeur Peter', 'Arrêter Tavus', 'Connexion à Tavus…', 'Professeur Tavus prêt'] }[ui] ||
    ['Meet your teacher Peter', 'End Tavus', 'Connecting to Tavus…', 'Tavus teacher ready'];
  startButton.textContent = labels[0]; stopButton.textContent = labels[1];
  const setStatus = message => { status.textContent = message; };

  function move(panelId) {
    if (!active) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const target = panel.querySelector('.model-box, .avatar-feedback') || panel;
    target.prepend(host);
    host.after(status);
  }
  function stop() {
    generation++;
    active = false;
    if (pendingSpeech) { pendingSpeech(); pendingSpeech = null; }
    if (call) { const old = call; call = null; Promise.resolve(old.leave()).catch(() => {}).finally(() => old.destroy()); }
    conversationId = '';
    remoteVideo.pause(); remoteVideo.srcObject = null;
    remoteAudio.pause(); remoteAudio.srcObject = null;
    host.replaceChildren(); host.hidden = true;
    document.body.classList.remove('tavus-on', 'live-on');
    startButton.disabled = false; stopButton.hidden = true;
    document.querySelector('.hero').append(host);
    document.querySelector('.live-controls').append(status);
  }
  function loadDaily() {
    if (window.Daily?.createCallObject) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@daily-co/daily-js'; script.crossOrigin = 'anonymous';
      script.onload = () => window.Daily?.createCallObject ? resolve() : reject(Error('Daily could not load'));
      script.onerror = () => reject(Error('Video library could not load'));
      document.head.append(script);
    });
  }
  function attachRemoteMedia() {
    if (!call) return;
    const participants = Object.values(call.participants() || {}).filter(participant =>
      !participant.local && participant.user_id !== 'local');
    for (const participant of participants) {
      const videoTrack = participant.tracks?.video?.persistentTrack || participant.tracks?.video?.track;
      const audioTrack = participant.tracks?.audio?.persistentTrack || participant.tracks?.audio?.track;
      if (videoTrack && videoTrack.readyState === 'live') {
        if (remoteVideo.srcObject?.getVideoTracks()[0] !== videoTrack)
          remoteVideo.srcObject = new MediaStream([videoTrack]);
        remoteVideo.play().catch(() => {});
      }
      if (audioTrack && audioTrack.readyState === 'live') {
        if (remoteAudio.srcObject?.getAudioTracks()[0] !== audioTrack)
          remoteAudio.srcObject = new MediaStream([audioTrack]);
        remoteAudio.play().catch(() => setStatus('Tap the avatar to enable Tavus sound.'));
      }
    }
  }
  remoteVideo.addEventListener('click', () => remoteAudio.play().catch(() => {}));
  async function speak(text) {
    if (!active || !call || !text?.trim()) return false;
    if (pendingSpeech) { pendingSpeech(); pendingSpeech = null; }
    return new Promise(resolve => {
      const timer = setTimeout(done, 25000);
      function done() { clearTimeout(timer); if (pendingSpeech === done) pendingSpeech = null; resolve(true); }
      pendingSpeech = done;
      try {
        call.sendAppMessage({ message_type: 'conversation', event_type: 'conversation.echo',
          conversation_id: conversationId,
          properties: { modality: 'text', text: text.trim(), done: true } }, '*');
        // A speaking event follows when Tavus starts rendering. End is handled below.
      } catch (error) { console.warn('Tavus echo:', error); done(); resolve(false); }
    });
  }
  async function start() {
    const token = ++generation;
    startButton.disabled = true; setStatus(labels[2]);
    try {
      const response = await fetch('/.netlify/functions/tavus-session', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Tavus is unavailable');
      await loadDaily();
      if (token !== generation) return;
      conversationId = data.conversationId;
      // A call object renders ONLY the remote face. A Daily iframe opens a
      // meeting-room camera preview, which is inappropriate for this lesson.
      call = window.Daily.createCallObject({ audioSource: false, videoSource: false });
      for (const event of ['participant-joined', 'participant-updated', 'track-started'])
        call.on(event, attachRemoteMedia);
      call.on('app-message', event => {
        const message = event.data || {};
        if (message.event_type === 'conversation.stopped_speaking' &&
            message.properties?.role === 'pal' && pendingSpeech) pendingSpeech();
      });
      host.replaceChildren(remoteVideo, remoteAudio); host.hidden = false;
      await call.join({ url: data.conversationUrl });
      if (token !== generation) return;
      attachRemoteMedia();
      active = true; document.body.classList.add('tavus-on', 'live-on');
      stopButton.hidden = false;
      setStatus(labels[3]);
      await window.LingoPeterWelcome?.();
      const panel = document.querySelector('.step-panel.active:not(.hidden)');
      if (panel?.id === 'promptPanel') {
        move('promptPanel');
        const phrase = document.getElementById('statement')?.textContent;
        if (phrase) await window.LingoPeterTurn?.();
      } else if (panel?.id === 'retryPanel') move('retryPanel');
    } catch (error) { console.warn('Tavus connection:', error); stop(); setStatus(error.message); }
  }
  startButton.addEventListener('click', start);
  stopButton.addEventListener('click', () => { stop(); setStatus(''); });
  window.addEventListener('pagehide', stop);
  window.LingoTavusAvatar = { get active() { return active; }, move, speak, stop };
  window.LingoLiveAvatar = {
    get active() { return native.active || active; },
    move(panel) { if (active) move(panel); else native.move(panel); },
    speak(text, locale) { return active ? speak(text) : native.speak(text, locale); }
  };
})();
