'use strict';
(()=>{
const labels={"en": ["What worked", "One thing to try next", "What your voice communicated", "Your next attempt", "Have another go →", "Your practice score · just for fun", "Attempt", "Personal best", "Previous attempt", "First marker: try the task below and listen for a change.", "New personal best!", "You matched your best. Explore another way to say it.", "Every take is practice. Focus on the task below.", "AI scores are approximate; small changes may vary between assessments.", "Clear words", "Pace, pauses & phrasing", "Expression & meaning", "Text accuracy", "Change from last attempt", "Try the advice, then record a fresh take."], "ca": ["Què ha funcionat", "Una cosa a millorar", "Què ha comunicat la teva veu", "El teu pròxim intent", "Torna-ho a provar →", "La teva puntuació de pràctica · per divertir-te", "Intent", "Millor puntuació", "Intent anterior", "Primer punt de referència: prova la tasca i escolta què canvia.", "Nova millor puntuació!", "Has igualat la teva millor puntuació. Explora una altra manera de dir-ho.", "Cada intent és pràctica. Centra’t en la tasca següent.", "Les puntuacions de la IA són aproximades; petites diferències poden variar entre avaluacions.", "Paraules clares", "Ritme, pauses i fraseig", "Expressió i sentit", "Fidelitat al text", "Canvi respecte de l’últim intent", "Prova el consell i fes una nova gravació."], "es": ["Qué ha funcionado", "Una cosa que mejorar", "Qué ha comunicado tu voz", "Tu próximo intento", "Vuelve a intentarlo →", "Tu puntuación de práctica · por diversión", "Intento", "Mejor puntuación", "Intento anterior", "Tu primera referencia: prueba la tarea y escucha qué cambia.", "¡Nueva mejor puntuación!", "Has igualado tu mejor puntuación. Explora otra forma de decirlo.", "Cada intento es práctica. Céntrate en la tarea siguiente.", "Las puntuaciones de la IA son aproximadas; pequeñas diferencias pueden variar entre evaluaciones.", "Palabras claras", "Ritmo, pausas y fraseo", "Expresión y sentido", "Fidelidad al texto", "Cambio desde el último intento", "Prueba el consejo y haz una nueva grabación."], "fr": ["Ce qui a bien fonctionné", "Une chose à améliorer", "Ce que ta voix a communiqué", "Ton prochain essai", "Essaie encore →", "Ton score de pratique · pour le plaisir", "Essai", "Meilleur score", "Essai précédent", "Ton premier repère : essaie la tâche et écoute ce qui change.", "Nouveau meilleur score !", "Tu as égalé ton meilleur score. Explore une autre façon de le dire.", "Chaque essai compte. Concentre-toi sur la tâche ci-dessous.", "Les scores de l’IA sont approximatifs ; de petits écarts peuvent varier entre les évaluations.", "Des mots clairs", "Rythme, pauses et phrasé", "Expression et sens", "Fidélité au texte", "Écart avec le dernier essai", "Essaie le conseil, puis fais un nouvel enregistrement."], "de": ["Was gut gelungen ist", "Eine Sache zum Verbessern", "Was deine Stimme vermittelt hat", "Dein nächster Versuch", "Noch einmal versuchen →", "Deine Übungspunktzahl · nur zum Spaß", "Versuch", "Deine Bestleistung", "Vorheriger Versuch", "Dein erster Anhaltspunkt: Probiere die Aufgabe und höre, was sich verändert.", "Neue persönliche Bestleistung!", "Du hast deine Bestleistung erreicht. Probiere eine andere Sprechweise.", "Jeder Versuch ist Übung. Konzentriere dich auf die nächste Aufgabe.", "KI-Punktzahlen sind ungefähr; kleine Unterschiede können bei jeder Bewertung anders ausfallen.", "Klare Wörter", "Tempo, Pausen und Phrasierung", "Ausdruck und Bedeutung", "Textgenauigkeit", "Änderung zum letzten Versuch", "Probiere den Tipp und nimm dich erneut auf."]};
const $=id=>document.getElementById(id);
const t=labels[document.documentElement.lang]||labels.en;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let animation=0;
window.wizFeedback=(d,prior=[])=>{
 const previous=prior.filter(x=>Number.isFinite(x.total));
 const last=previous.at(-1),best=Math.max(d.total,...previous.map(x=>x.total));
 const oldBest=previous.length?Math.max(...previous.map(x=>x.total)):null;
 const number=n=>Number(n).toFixed(1).replace(/\.0$/,'');
 const score=$('totalScore'),details=document.querySelector('.practice-score');
 details.open=true;details.querySelector('summary').textContent=t[5];
 $('scoreBadge').textContent=oldBest===null?t[9]:d.total>oldBest?t[10]:d.total===oldBest?t[11]:t[12];
 const facts=[t[6]+' '+(prior.length+1),t[7]+': '+number(best)+'/10'];
 if(last){facts.push(t[8]+': '+number(last.total)+'/10');const delta=Math.round((d.total-last.total)*10)/10;facts.push(t[18]+': '+(delta>0?'+':'')+number(delta));}
 $('comparison').textContent=facts.join(' · ');
 $('scoreBars').replaceChildren(...[['clarity',3],['rhythm',3],['expression',3],['accuracy',1]].map(([key,max],i)=>{
 const box=el('div',undefined,'score-bar'),row=el('div'),bar=el('progress');row.append(el('span',t[14+i]),el('strong',number(d[key])+' / '+max));bar.max=max;bar.value=0;bar.setAttribute('aria-label',t[14+i]+': '+number(d[key])+' / '+max);bar.dataset.score=d[key];box.append(row,bar);return box;
 }));
 ['strength','nextStep','interpretation'].forEach((id,i)=>{$(id).previousElementSibling.textContent=t[i];});
 let task=$('practiceTask');if(!task){const box=el('div',undefined,'feedback-box next-attempt');box.append(el('h3',t[3]));task=el('p');task.id='practiceTask';box.append(task);$('interpretation').parentElement.after(box);}
 task.textContent=d.practiceTask||d.nextStep;
 $('improve').textContent=t[4];
 $('improve').addEventListener('click',()=>{ $('recordStatus').textContent=task.textContent;$('recordHint').textContent=t[19];},{once:true});
 let note=$('scoreGuidance');if(!note){note=el('p',t[13],'mini');note.id='scoreGuidance';details.append(note);}
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const finish=()=>{score.textContent=number(d.total);document.querySelectorAll('#scoreBars progress').forEach(bar=>bar.value=Number(bar.dataset.score));};
 cancelAnimationFrame(animation);
 if(reduced){finish();return;}
 score.setAttribute('aria-label',number(d.total)+' / 10');
 const started=performance.now();
 const frame=now=>{const fraction=Math.min(1,(now-started)/650),ease=1-Math.pow(1-fraction,3);score.textContent=number(d.total*ease);document.querySelectorAll('#scoreBars progress').forEach(bar=>bar.value=Number(bar.dataset.score)*ease);if(fraction<1)animation=requestAnimationFrame(frame);else finish();};
 animation=requestAnimationFrame(frame);
};
})();
