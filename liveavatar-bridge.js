import { Room, RoomEvent } from 'livekit-client';

// The microphone and transcript remain under LingoChat's control. LiveAvatar
// receives only the audio generated for the partner's statements and feedback.
const video = document.getElementById('liveVideo');
const startButton = document.getElementById('liveStart');
const stopButton = document.getElementById('liveStop');
const status = document.getElementById('liveStatus');
let room, socket, timer, active = false, generation = 0;
const language = (new URLSearchParams(location.search).get('ui') ||
  new URLSearchParams(location.search).get('interface') ||
  localStorage.getItem('lingototal_ui_language') ||
  localStorage.getItem('interfaceLanguage') || 'en').toLowerCase().split('-')[0];
const labels = {
  en: ['Try live avatar', 'End avatar', 'Connecting…', 'Live avatar ready', 'Avatar unavailable; ordinary audio remains available'],
  ca: ['Prova l’avatar en directe', 'Atura l’avatar', 'Connectant…', 'Avatar preparat', 'Avatar no disponible; pots escoltar l’àudio'],
  es: ['Probar avatar en directo', 'Detener avatar', 'Conectando…', 'Avatar preparado', 'Avatar no disponible; puedes escuchar el audio'],
  fr: ['Essayer l’avatar', 'Arrêter l’avatar', 'Connexion…', 'Avatar prêt', 'Avatar indisponible ; l’audio reste disponible'],
  de: ['Live-Avatar testen', 'Avatar beenden', 'Verbindung…', 'Avatar bereit', 'Avatar nicht verfügbar; Audio bleibt verfügbar'],
  it: ['Prova avatar dal vivo', 'Ferma avatar', 'Connessione…', 'Avatar pronto', 'Avatar non disponibile; l’audio è disponibile'],
  pt: ['Experimentar avatar ao vivo', 'Parar avatar', 'A ligar…', 'Avatar pronto', 'Avatar indisponível; o áudio continua disponível'],
  ar: ['تجربة الصورة الرمزية المباشرة', 'إيقاف الصورة الرمزية', 'جارٍ الاتصال…', 'الصورة الرمزية جاهزة', 'الصورة الرمزية غير متاحة؛ الصوت متاح'],
  ja: ['ライブアバターを試す', 'アバターを終了', '接続中…', 'アバターの準備完了', 'アバターは利用できません。音声は利用できます'],
  eu: ['Probatu zuzeneko avatarra', 'Gelditu avatarra', 'Konektatzen…', 'Avatarra prest', 'Avatarra ez dago erabilgarri; audioa erabil dezakezu'],
  cy: ['Profi’r avatar byw', 'Stopio’r avatar', 'Wrthi’n cysylltu…', 'Avatar yn barod', 'Avatar ddim ar gael; mae sain ar gael'],
  gd: ['Feuch an t-avatar beò', 'Cuir stad air an avatar', 'A’ ceangal…', 'Avatar deiseil', 'Chan eil avatar ri fhaighinn; tha fuaim ri fhaighinn']
};
const label = labels[language] || labels.en;
const soundHelp = {
  en: 'Click the video once to enable avatar sound.', ca: 'Fes clic al vídeo per activar el so de l’avatar.',
  es: 'Haz clic en el vídeo para activar el sonido del avatar.', fr: 'Cliquez sur la vidéo pour activer le son.',
  de: 'Klicken Sie auf das Video, um den Ton zu aktivieren.', it: 'Fai clic sul video per attivare l’audio.',
  pt: 'Clique no vídeo para ativar o som.', ar: 'انقر على الفيديو لتشغيل الصوت.',
  ja: '動画をクリックして音声を有効にしてください。', eu: 'Egin klik bideoan soinua aktibatzeko.',
  cy: 'Cliciwch y fideo i droi’r sain ymlaen.', gd: 'Briog air a’ bhidio gus fuaim a chur air.'
};
startButton.textContent = label[0]; stopButton.textContent = label[1];
const setStatus = message => { status.textContent = message; };
function move(panelId) {
  if (!active) return;
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const host = panel.querySelector('.model-box, .avatar-feedback') || panel;
  host.prepend(video);
  video.after(status);
}
function cleanup() {
  generation++; active = false;
  document.body.classList.remove('live-on');
  clearInterval(timer); timer = null;
  if (socket) { socket.close(); socket = null; }
  if (room) { room.disconnect(); room = null; }
  document.querySelectorAll('.lingo-live-audio').forEach(element => element.remove());
  video.pause(); video.srcObject = null; video.hidden = true;
  startButton.disabled = false; stopButton.hidden = true;
}
function connected(ws) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Avatar connection timed out')), 12000);
    ws.addEventListener('message', function onMessage(event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'session.state_updated' && message.state === 'connected') {
          clearTimeout(timeout); ws.removeEventListener('message', onMessage); resolve();
        }
      } catch { /* Ignore unrelated events. */ }
    });
    ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Avatar connection failed')); }, { once: true });
  });
}
async function start() {
  if (active || startButton.disabled) return;
  startButton.disabled = true; setStatus(label[2]);
  const current = generation;
  try {
    const response = await fetch('/.netlify/functions/liveavatar-session', { method: 'POST' });
    const details = await response.json();
    if (!response.ok) throw new Error(details.error || 'LiveAvatar session failed');
    if (current !== generation) return;
    room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (participant.identity !== 'heygen') return;
      if (track.kind === 'video') {
        video.srcObject = new MediaStream([track.mediaStreamTrack]);
        video.hidden = false;
        video.play().catch(() => {});
      } else if (track.kind === 'audio') {
        const audio = track.attach(); audio.className = 'lingo-live-audio';
        audio.autoplay = true;
        document.body.append(audio);
        audio.play().catch(() => {
          setStatus(soundHelp[language] || soundHelp.en);
        });
      }
    });
    await room.connect(details.livekitUrl, details.livekitToken);
    socket = new WebSocket(details.wsUrl);
    await connected(socket);
    active = true; document.body.classList.add('live-on'); stopButton.hidden = false; setStatus(label[3]);
    socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'agent.speak_started') setStatus(`${label[3]} · 🔊`);
        if (message.type === 'agent.speak_ended') setStatus(label[3]);
        if (message.type === 'error') {
          console.warn('LiveAvatar speech:', message.error?.type);
          setStatus(label[4]);
        }
      } catch { /* Ignore unrelated events. */ }
    });
    const activePanel = document.querySelector('.step-panel.active:not(.hidden)');
    if (activePanel && activePanel.id !== 'setup') {
      move(activePanel.id);
      const currentStatement = document.getElementById('statement')?.textContent?.trim();
      if (activePanel.id === 'promptPanel' && currentStatement) speak(currentStatement, window.LingoChatTargetLocale || 'en-GB');
      if (activePanel.id === 'retryPanel') {
        const feedback = document.getElementById('firstFeedback')?.textContent?.trim();
        if (feedback) speak(feedback, window.LingoChatInterfaceLocale || 'en-GB');
      }
    }
    timer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'session.keep_alive' }));
    }, 60000);
  } catch (error) {
    console.warn('LiveAvatar setup:', error);
    cleanup(); setStatus(`${label[4]} (${error.message})`);
  }
}
function base64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
async function pcm24k(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.ceil(decoded.duration * 24000);
    const offline = new OfflineAudioContext(1, frames, 24000);
    const source = offline.createBufferSource(); source.buffer = decoded;
    source.connect(offline.destination); source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const output = new Uint8Array(samples.length * 2), view = new DataView(output.buffer);
    for (let i = 0; i < samples.length; i++) {
      const value = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, value < 0 ? value * 32768 : value * 32767, true);
    }
    return output;
  } finally { await ctx.close(); }
}
async function speak(text, locale) {
  if (!active || socket?.readyState !== WebSocket.OPEN) return false;
  const current = generation;
  try {
    const response = await fetch('/.netlify/functions/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, languageCode: locale, locale, voiceGender: 'MALE' })
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || 'Speech unavailable');
    }
    let blob;
    if ((response.headers.get('content-type') || '').startsWith('audio/')) blob = await response.blob();
    else {
      const data = await response.json();
      const encoded = data.audioContent || data.audio || data.data;
      if (!encoded) throw new Error('Speech unavailable');
      const binary = atob(encoded), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      blob = new Blob([bytes], { type: 'audio/mpeg' });
    }
    const samples = await pcm24k(blob);
    if (!active || current !== generation) return true;
    setStatus(`${label[3]} · 🔊`);
    socket.send(JSON.stringify({ type: 'agent.interrupt', event_id: crypto.randomUUID() }));
    const id = crypto.randomUUID(), chunkSize = 24000 * 2;
    for (let offset = 0; offset < samples.length; offset += chunkSize) {
      socket.send(JSON.stringify({ type: 'agent.speak', event_id: offset ? crypto.randomUUID() : id,
        audio: base64(samples.subarray(offset, offset + chunkSize)) }));
    }
    socket.send(JSON.stringify({ type: 'agent.speak_end', event_id: crypto.randomUUID() }));
    await new Promise(resolve => {
      const timeout = setTimeout(done, 25000);
      function done() { clearTimeout(timeout); socket?.removeEventListener('message', onMessage); resolve(); }
      function onMessage(event) {
        try {
          const message = JSON.parse(event.data);
          if (message.source_event_id === id &&
              ['agent.speak_ended', 'agent.speak_interrupted', 'error'].includes(message.type)) done();
        } catch { /* Ignore unrelated events. */ }
      }
      socket.addEventListener('message', onMessage);
    });
    return true;
  } catch (error) {
    console.warn('Avatar speech failed:', error);
    setStatus(`${label[4]} (${error.message})`); return false;
  }
}
startButton.addEventListener('click', start);
video.addEventListener('click', () => {
  document.querySelectorAll('.lingo-live-audio').forEach(element => {
    element.play().then(() => setStatus(label[3])).catch(() => setStatus(label[4]));
  });
});
stopButton.addEventListener('click', () => { cleanup(); setStatus(''); });
window.addEventListener('pagehide', cleanup);
window.LingoLiveAvatar = { speak, move, get active() { return active; } };
