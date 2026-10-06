(() => {
  const supported = ['en', 'es', 'fr', 'ca'];
  const names = {greek:'el','ελληνικά':'el',english:'en',spanish:'es',french:'fr',catalan:'ca','español':'es','français':'fr','català':'ca'};
  const params = new URLSearchParams(location.search);
  const code = (value, fallback) => {
    const key = String(value || '').trim().toLowerCase();
    return key==='el'||key==='el-gr'?'el':supported.includes(key) ? key : names[key] || fallback;
  };
  const interfaceChoice = document.getElementById('interfaceChoice');
  const targetChoice = document.getElementById('targetChoice');
  interfaceChoice.value = code(params.get('ui') || params.get('interface') || localStorage.getItem('lingototal_ui_language'), 'en');
  targetChoice.value = code(params.get('target') || localStorage.getItem('lingototal_target_language') || localStorage.getItem('targetLanguage'), 'es');
  if(!supported.includes(interfaceChoice.value))interfaceChoice.value='en';
  const option=document.createElement('option');option.value='el';option.textContent='Ελληνικά / Greek';targetChoice.append(option);targetChoice.value=code(params.get('target')||localStorage.getItem('lingototal_target_language'),'es');
  const labels = {en:['Interface language','Language to learn'],es:['Idioma de la interfaz','Idioma que aprendes'],fr:['Langue de l’interface','Langue étudiée'],ca:['Llengua de la interfície','Llengua que aprens']};
  document.getElementById('interfaceChoiceLabel').textContent = labels[interfaceChoice.value][0];
  document.getElementById('targetChoiceLabel').textContent = labels[interfaceChoice.value][1];
  for (const select of [interfaceChoice,targetChoice]) select.addEventListener('change', () => {
    const next = new URL(location.href);
    next.searchParams.set('ui',interfaceChoice.value);
    next.searchParams.set('target',targetChoice.value);
    location.assign(next.href);
  });
})();

