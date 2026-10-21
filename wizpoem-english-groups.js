'use strict';
(()=>{
const $=id=>document.getElementById(id),teacher=!!$('createForm');
let group=null,teacherKey='',editingId='',busy=false;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function status(text){$('status').textContent=text||'';}
async function api(payload){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);try{const r=await fetch('/.netlify/functions/wizpoem-english-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});let d;try{d=await r.json()}catch{throw Error('The group service could not respond. Please try again.');}if(!r.ok)throw Error(d.error||'Please try again.');return d;}catch(e){if(e.name==='AbortError')throw Error('The group service took too long. Please try again.');throw e;}finally{clearTimeout(timer);}}
async function run(fn){if(busy)return;busy=true;status('');const buttons=[...document.querySelectorAll('button')].map(b=>[b,b.disabled]);buttons.forEach(([b])=>b.disabled=true);try{await fn();}catch(e){status(e.message);}finally{busy=false;buttons.forEach(([b,disabled])=>b.disabled=disabled);}}
function remember(){try{sessionStorage.setItem('wizpoem-english-teacher',JSON.stringify({code:group.code,teacherKey}));}catch{}}
function learnerURL(g){const url=new URL('/wizpoem-english-learners.html',location.origin);url.searchParams.set('group',g.code);return url.href;}
function render(){
 const holder=$('readings');holder.replaceChildren();$('groupName').textContent=group.name;$('groupEmpty').hidden=!!group.readings.length;
 for(const reading of group.readings){const box=el('article',undefined,'reading');box.append(el('div',reading.genre==='drama'?'THEATRE':'POETRY','eyebrow'),el('h3',reading.title),el('p',reading.poet+' · '+reading.lines.length+' lines'));if(reading.guidance)box.append(el('p',reading.guidance));
 const detail=el('details'),summary=el('summary','Read the text'),preview=el('div',reading.lines.join('\n'),'preview');detail.append(summary,preview);box.append(detail);
 const actions=el('div',undefined,'row');
 if(teacher){const edit=el('button','Edit reading','secondary');edit.type='button';edit.onclick=()=>fill(reading);const remove=el('button','Remove reading','secondary');remove.type='button';remove.onclick=()=>{if(!confirm('Remove “'+reading.title+'” from this group?'))return;run(async()=>{const d=await api({action:'remove',...credentials(),readingId:reading.id});group=d.group;if(editingId===reading.id)clearEditor();render();status('Reading removed.');});};actions.append(edit,remove);}
 else{const link=el('a','Practise this reading →','button');link.href='/wizpoem-english-'+(reading.genre==='drama'?'theatre':'poetry')+'.html?'+new URLSearchParams({group:group.code,reading:reading.id});actions.append(link);}
 box.append(actions);holder.append(box);
 }
 if(!teacher){$('groupContent').hidden=false;return;}
 $('teacherEntry').hidden=true;$('dashboard').hidden=false;$('shareCode').textContent=group.code;$('shareLink').value=learnerURL(group);$('learnerLink').href=learnerURL(group);$('keyValue').textContent=teacherKey.length===8?teacherKey.slice(0,4)+'-'+teacherKey.slice(4):teacherKey;$('renameGroup').value=group.name;$('closeGroup').textContent=group.closed?'Reopen learner access':'Pause learner access';$('availability').textContent=(group.closed?'Learner access is paused.':'Learner access is open.')+' Readings available until '+new Date(group.expires).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+'.';remember();
}
function credentials(){return {code:group.code,teacherKey,revision:group.revision};}
async function refresh(){const d=await api(teacher?{action:'read',code:group.code,teacherKey}:{action:'read',code:group.code});group=d.group;render();status('Group refreshed.');}
$('refreshGroup').onclick=()=>run(refresh);
if(!teacher){
 $('joinForm').onsubmit=e=>{e.preventDefault();run(async()=>{const d=await api({action:'read',code:$('groupCode').value.trim()});group=d.group;render();status('Your group’s readings are ready.');});};
 const code=new URLSearchParams(location.search).get('group');if(code){$('groupCode').value=code;$('joinForm').requestSubmit();}return;
}
const library=window.WIZ_ENGLISH_LIBRARY||[];
$('libraryChoice').replaceChildren(...library.map((p,i)=>{const o=el('option',(p.genre==='drama'?'Theatre':'Poetry')+(p.year?' · '+p.year:'')+' · '+p.title+' — '+p.poet);o.value=String(i);return o;}));
function fill(p){editingId=p.id||'';$('readingGenre').value=p.genre||'poetry';$('readingTitle').value=p.title||'';$('readingAuthor').value=p.poet||'';$('readingText').value=(p.lines||[]).join('\n');$('readingGuidance').value=(p.guidance||p.tip||'').slice(0,400);$('editorHeading').textContent=editingId?'Edit reading':'Add a reading';$('readingPreview').hidden=true;$('readingTitle').focus();}
function clearEditor(){fill({});editingId='';}
$('useLibrary').onclick=()=>{const p=library[Number($('libraryChoice').value)];if(p)fill({...p,id:''});};$('cancelEdit').onclick=clearEditor;
$('previewReading').onclick=()=>{$('readingPreview').textContent=$('readingTitle').value+'\n'+$('readingAuthor').value+'\n\n'+$('readingText').value;$('readingPreview').hidden=false;};
$('createForm').onsubmit=e=>{e.preventDefault();run(async()=>{const d=await api({action:'create',name:$('newGroupName').value});group=d.group;teacherKey=d.teacherKey;render();$('keyDetails').open=true;status('Group created. Keep your private teacher key, then add a reading below.');});};
$('showKey').onchange=()=>{$('teacherKey').type=$('showKey').checked?'text':'password';};
$('openForm').onsubmit=e=>{e.preventDefault();run(async()=>{const key=$('teacherKey').value.trim(),d=await api({action:'read',code:$('teacherCode').value.trim(),teacherKey:key});group=d.group;teacherKey=key;render();status('Your teacher area is ready.');});};
$('readingForm').onsubmit=e=>{e.preventDefault();run(async()=>{const lines=$('readingText').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(lines.length<1||lines.length>60)throw Error('Use between 1 and 60 non-empty lines.');const reading={genre:$('readingGenre').value,title:$('readingTitle').value,poet:$('readingAuthor').value,lines,guidance:$('readingGuidance').value};const d=await api({action:'save',...credentials(),readingId:editingId||undefined,reading});group=d.group;clearEditor();render();status('Reading saved. Learners can now open it using the group link.');});};
$('renameForm').onsubmit=e=>{e.preventDefault();run(async()=>{const d=await api({action:'rename',...credentials(),name:$('renameGroup').value});group=d.group;render();status('Group name saved.');});};
$('closeGroup').onclick=()=>run(async()=>{const d=await api({action:'close',...credentials()});group=d.group;render();status(group.closed?'Learner access paused.':'Learner access reopened.');});
$('deleteGroup').onclick=()=>{if(!confirm('Delete this group and all its reading material? This cannot be undone.'))return;run(async()=>{await api({action:'delete',...credentials()});leave();status('Group deleted.');});};
function leave(){group=null;teacherKey='';editingId='';try{sessionStorage.removeItem('wizpoem-english-teacher');}catch{}$('dashboard').hidden=true;$('teacherEntry').hidden=false;clearEditor();$('teacherKey').value='';$('keyValue').textContent='';}
$('switchGroup').onclick=()=>{leave();status('Create a group or enter its code and private teacher key.');};
async function copy(value,fallback){try{await navigator.clipboard.writeText(value);status('Copied.');}catch{status(fallback);}}
$('copyLink').onclick=()=>copy(learnerURL(group),'Select and copy the learner link above.');$('copyKey').onclick=()=>copy(teacherKey,'Select and copy the teacher key above.');
try{const saved=JSON.parse(sessionStorage.getItem('wizpoem-english-teacher')||'null');if(saved?.code&&saved?.teacherKey){$('teacherCode').value=saved.code;$('teacherKey').value=saved.teacherKey;$('openForm').requestSubmit();}}catch{}
})();
