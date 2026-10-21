'use strict';
(async()=>{
 const params=new URLSearchParams(location.search),code=params.get('group'),id=params.get('reading');if(!code||!id)return;
 const status=document.getElementById('chooseStatus');status.textContent='Opening your group’s reading…';
 try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);let r;try{r=await fetch('/.netlify/functions/wizpoem-english-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read',code}),signal:controller.signal});}finally{clearTimeout(timer);}
 const d=await r.json();if(!r.ok)throw Error(d.error||'The group reading could not be opened.');const p=d.group.readings.find(x=>x.id===id);if(!p)throw Error('This reading was removed. Return to My group for the latest material.');
 const expected=location.pathname.includes('theatre')?'drama':'poetry';if(p.genre!==expected){location.replace('/wizpoem-english-'+(p.genre==='drama'?'theatre':'poetry')+'.html?'+params);return;}
 if(!window.wizEnglishChoose({...p,tip:p.guidance||'Read at your own pace. Try one change each time you practise.',extent:'Group reading · '+d.group.name,colour:'#c6b1ff'}))throw Error('Finish your current recording before opening this text.');
 status.textContent='';document.getElementById('changePoem').textContent='Choose another reading';document.getElementById('changePoem').onclick=()=>location.assign('/wizpoem-english-learners.html?group='+encodeURIComponent(code));
 document.querySelector('header a.source').href='/wizpoem-english-learners.html?group='+encodeURIComponent(code);
 }catch(e){status.textContent=e.name==='AbortError'?'The group took too long to respond. Reload this page to try again.':e.message;}
})();
