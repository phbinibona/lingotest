const vm=require('vm'),fs=require('fs'),assert=require('assert'),crypto=require('node:crypto'),path=require('path');
(async()=>{
 const records=new Map();let serial=0;
 const store={getWithMetadata:async k=>records.has(k)?structuredClone(records.get(k)):null,setJSON:async(k,data,opts)=>{const old=records.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&opts.onlyIfMatch!==old?.etag)return {modified:false};records.set(k,{data:structuredClone(data),etag:String(++serial)});return {modified:true};}};
 const c={fail:(status,message)=>Object.assign(Error(message),{status}),text:(v,n)=>String(v||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,n),hash:v=>crypto.createHash('sha256').update(String(v)).digest('hex'),crypto,input:e=>{if(e.httpMethod!=='POST')throw Object.assign(Error('POST only'),{status:405});return JSON.parse(e.body)}};
 const context=vm.createContext({Request,Response,Date,JSON,Error,String,Array,Number});
 const module=new vm.SourceTextModule(fs.readFileSync('functions/wizpoem-english-groups.mjs','utf8'),{context});
 await module.link(async name=>{let exports;if(name==='./verse-lib/core.mjs')exports={default:c};else if(name==='./wizpoem-auth.mjs')exports={default:async r=>new Response('',{status:r.headers.get('cookie')==='valid-session'?200:401})};else if(name==='@netlify/blobs')exports={getStore:()=>store};else throw Error(name);const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context});await m.link(()=>{});return m;});await module.evaluate();
 async function call(b,cookie='valid-session'){const r=await module.namespace.default(new Request('https://wizpoem.com/.netlify/functions/wizpoem-english-groups',{method:'POST',headers:{cookie},body:JSON.stringify(b)}));return {status:r.status,body:await r.json()};}
 assert.equal((await call({action:'create',name:'Class'},'')).status,401);
 const a=await call({action:'create',name:'Year 8 English'});assert.equal(a.status,200);let group=a.body.group;const key=a.body.teacherKey;assert.equal(group.readings.length,0);assert.match(group.code,/^[A-HJ-NP-Z2-9]{6}$/);assert.match(key,/^[A-HJ-NP-Z2-9]{8}$/);assert(!JSON.stringify(group).includes(key));
 const relaxed=await call({action:'read',code:group.code.slice(0,3).toLowerCase()+'-'+group.code.slice(3).toLowerCase(),teacherKey:key.slice(0,4).toLowerCase()+' '+key.slice(4).toLowerCase()});assert.equal(relaxed.status,200);assert.equal(relaxed.body.teacher,true);
 const legacy='abcdef123456',legacyKey='abc123'.repeat(8);records.set('group/'+legacy,{data:{...structuredClone(group),code:legacy,teacherHash:c.hash(legacyKey)},etag:'legacy'});assert.equal((await call({action:'read',code:legacy.toUpperCase(),teacherKey:legacyKey.toUpperCase()})).body.teacher,true);
 const b=await call({action:'create',name:'Other group'});const credentials=()=>({code:group.code,teacherKey:key,revision:group.revision});
 assert.equal((await call({action:'read',code:group.code,teacherKey:'wrong'})).status,403);
 assert.equal((await call({action:'save',code:group.code,revision:1})).status,403);
 const reading={genre:'poetry',title:'Wind',poet:'Author',lines:['First line','Second line'],guidance:'Leave a pause.'};
 let r=await call({action:'save',...credentials(),reading});assert.equal(r.status,200);group=r.body.group;assert.equal(group.readings.length,1);const id=group.readings[0].id;
 let view=await call({action:'read',code:group.code});assert.equal(view.status,200);assert.equal(view.body.teacher,false);assert.equal(view.body.group.readings[0].lines[1],'Second line');assert(!('teacherHash' in view.body.group));assert(!('players' in view.body.group));
 assert.equal((await call({action:'save',...credentials(),teacherKey:b.body.teacherKey,reading})).status,403);
 assert.equal((await call({action:'save',...credentials(),revision:1,reading})).status,409);
 assert.equal((await call({action:'save',...credentials(),reading:{...reading,lines:[]}})).status,400);
 assert.equal((await call({action:'save',...credentials(),reading:{...reading,lines:Array(61).fill('x')}})).status,400);
 assert.equal((await call({action:'save',...credentials(),reading:{...reading,lines:['x'.repeat(4001)]}})).status,400);
 r=await call({action:'save',...credentials(),readingId:id,reading:{...reading,genre:'drama',title:'Updated speech'}});group=r.body.group;assert.equal(group.readings.length,1);assert.equal(group.readings[0].id,id);assert.equal(group.readings[0].genre,'drama');
 r=await call({action:'rename',...credentials(),name:'Year 8 B'});group=r.body.group;assert.equal(group.name,'Year 8 B');
 r=await call({action:'close',...credentials()});group=r.body.group;assert.equal((await call({action:'read',code:group.code})).status,403);assert.equal((await call({action:'read',...credentials()})).status,200);
 r=await call({action:'close',...credentials()});group=r.body.group;assert.equal((await call({action:'read',code:group.code})).status,200);
 r=await call({action:'remove',...credentials(),readingId:id});group=r.body.group;assert.equal(group.readings.length,0);
 assert.equal((await call({action:'delete',...credentials()})).body.deleted,true);assert.equal((await call({action:'read',code:group.code})).status,404);
 console.log('PASS English groups: session gate, create/return, teacher-only edits, learner reads, group isolation, invalid text, stale revisions, update/remove, rename/pause/reopen/delete.');
 // The English pages retain feedback scripts, have no route to other language editions, and link back to their own entrance.
 for(const kind of ['poetry','theatre']){const html=fs.readFileSync('wizpoem-english-'+kind+'.html','utf8');assert(html.includes('wizpoem-feedback.js'));assert(html.includes('wizpoem-english-'+kind+'.js'));assert(html.includes('wizpoem-english-reading.js'));assert(html.includes('href="/wizpoem-english.html"'));assert(!/href="\/Wiz(?:Poem|Drama)/.test(html));}
 assert(fs.readFileSync('wizpoem-home.html','utf8').includes('href="/wizpoem-english.html"'));console.log('PASS English-only routes and homepage discovery.');
})().catch(e=>{console.error(e);process.exit(1)});
