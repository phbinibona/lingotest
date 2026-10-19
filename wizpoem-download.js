'use strict';
(() => {
  const feedback = document.getElementById('feedbackContent');
  const playback = document.getElementById('playback');
  if (!feedback || !playback) return;
  const copy = {
    en: ['Download my recording', 'Like this recording? You can download it to keep and listen to yourself. It’s entirely optional—you can record as many times as you like without downloading.'],
    ca: ['Descarrega la meva gravació', 'T’agrada aquesta gravació? Si vols, la pots descarregar per conservar-la i escoltar-te. És totalment opcional: pots gravar tantes vegades com vulguis sense descarregar res.'],
    es: ['Descargar mi grabación', '¿Te gusta esta grabación? Si quieres, puedes descargarla para guardarla y escucharte. Es totalmente opcional: puedes grabar tantas veces como quieras sin descargar nada.'],
    fr: ['Télécharger mon enregistrement', 'Cet enregistrement te plaît ? Si tu le souhaites, tu peux le télécharger pour le garder et t’écouter. C’est entièrement facultatif : tu peux t’enregistrer autant de fois que tu le souhaites sans rien télécharger.'],
    de: ['Meine Aufnahme herunterladen', 'Gefällt dir diese Aufnahme? Wenn du möchtest, kannst du sie herunterladen, behalten und dir selbst zuhören. Das ist ganz freiwillig: Du kannst so oft aufnehmen, wie du möchtest, ohne etwas herunterzuladen.']
  };
  const [label, hint] = copy[document.documentElement.lang.split('-')[0]] || copy.en;
  const box = document.createElement('div');
  box.id = 'recordingDownload';
  box.className = 'feedback-box';
  box.hidden = true;
  const link = document.createElement('a');
  link.className = 'primary-link';
  link.textContent = '↓ ' + label;
  const note = document.createElement('p');
  note.className = 'mini';
  note.style.marginTop = '10px';
  note.textContent = hint;
  box.append(link, note);
  feedback.append(box);
  let preparedSource = '', pendingSource = '', extension = '';
  const source = () => playback.getAttribute('src') || '';
  function refresh() {
    const src = source();
    box.hidden = true;
    link.removeAttribute('href');
    if (feedback.hidden || !src.startsWith('blob:')) return;
    if (preparedSource === src) {
      const title = document.getElementById('stageTitle')?.textContent || 'My recording';
      const safeTitle = title.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().slice(0, 100) || 'My recording';
      link.href = src;
      link.download = 'WizPoem - ' + safeTitle + '.' + extension;
      box.hidden = false;
      return;
    }
    if (pendingSource === src) return;
    pendingSource = src;
    // Read the existing in-browser recording only; no server request or conversion.
    fetch(src).then(r => r.blob()).then(blob => {
      if (source() !== src || !blob.size) return;
      const mime = blob.type.toLowerCase().split(';')[0];
      extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : mime.includes('mpeg') ? 'mp3' : 'webm';
      preparedSource = src;
    }).catch(() => {}).finally(() => {
      if (pendingSource === src) pendingSource = '';
      if (preparedSource === source()) refresh();
    });
  }
  const observer = new MutationObserver(refresh);
  observer.observe(feedback, {attributes: true, attributeFilter: ['hidden']});
  observer.observe(playback, {attributes: true, attributeFilter: ['src']});
  refresh();
})();
