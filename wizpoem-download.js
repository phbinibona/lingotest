'use strict';
(() => {
  const feedback = document.getElementById('feedbackContent');
  const playback = document.getElementById('playback');
  if (!feedback || !playback) return;
  const copy = {
    en: ['Download my recording', 'Keep this reading on your device. Download it before recording again or closing this page.'],
    ca: ['Descarrega la meva gravació', 'Desa aquesta lectura al teu dispositiu. Descarrega-la abans de tornar a gravar o de tancar la pàgina.'],
    es: ['Descargar mi grabación', 'Guarda esta lectura en tu dispositivo. Descárgala antes de volver a grabar o cerrar la página.'],
    fr: ['Télécharger mon enregistrement', 'Garde cette lecture sur ton appareil. Télécharge-la avant de recommencer un enregistrement ou de fermer la page.'],
    de: ['Meine Aufnahme herunterladen', 'Speichere diese Lesung auf deinem Gerät. Lade sie herunter, bevor du erneut aufnimmst oder die Seite schließt.']
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
