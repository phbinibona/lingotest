import c from './verse-lib/core.mjs';
import {cleanReading,readingFor,readingKey,resetTaskScores} from './verse-lib/tasks.mjs';
const passwordOK=p=>typeof p==='string'&&p.length>=12&&p.length<=128;
const derive=(p,s)=>new Promise((resolve,reject)=>c.crypto.scrypt(p,s,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(e,k)=>e?reject(e):resolve(k.toString('hex'))));
const equal=(a,b)=>{const x=Buffer.from(a||'','hex'),y=Buffer.from(b||'','hex');return x.length===y.length&&x.length>0&&c.crypto.timingSafeEqual(x,y);};
const username=x=>String(x||'').trim().toLowerCase();
const accountKey=id=>'teacher/account/'+id;
async function edit(store,key,fn){for(let i=0;i<6;i++){const e=await store.getWithMetadata(key,{type:'json'});const data=e?e.data:{};const result=await fn(data);const r=await store.setJSON(key,data,e?{onlyIfMatch:e.etag}:{onlyIfNew:true});if(r.modified)return result;}throw c.fail(409,'BUSY');}
async function rate(store,id,max,period){await edit(store,'teacher/rate/'+c.hash(id),r=>{if(!r.until||r.until<Date.now()){r.n=0;r.until=Date.now()+period;}if(r.n>=max)throw c.fail(429,'TOO_MANY');r.n++;});}
async function issue(store,a){const token=c.crypto.randomBytes(32).toString('hex');await store.setJSON('teacher/session/'+c.hash(token),{id:a.id,version:a.version,expires:Date.now()+8*3600000},{onlyIfNew:true});return {session:token,username:a.id};}
async function authenticate(store,token){if(!/^[a-f0-9]{64}$/.test(token||''))throw c.fail(401,'LOGIN_REQUIRED');const s=await store.getWithMetadata('teacher/session/'+c.hash(token),{type:'json'});if(!s||s.data.expires<Date.now())throw c.fail(401,'LOGIN_REQUIRED');const a=await store.getWithMetadata(accountKey(s.data.id),{type:'json'});if(!a||a.data.version!==s.data.version)throw c.fail(401,'LOGIN_REQUIRED');return a.data;}
async function handle(request,context={}){try{
 const b=c.input({httpMethod:request.method,body:await request.text()},16000),store=c.storeFor(),id=username(b.username),ip=context.ip||'unknown';
 if(['register','login','recover'].includes(b.action)){
  if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(id))throw c.fail(400,'USERNAME');
  await rate(store,'auth-ip/'+ip,60,15*60000);
  if(b.action==='register'){
   await rate(store,'register/'+ip,5,86400000);if(!passwordOK(b.password))throw c.fail(400,'PASSWORD');
   const salt=c.crypto.randomBytes(16).toString('hex'),recovery=c.crypto.randomBytes(24).toString('hex');
   const a={id,salt,passwordHash:await derive(b.password,salt),recoveryHash:c.hash(recovery),version:1,groups:[],created:Date.now()};
   const r=await store.setJSON(accountKey(id),a,{onlyIfNew:true});if(!r.modified)throw c.fail(409,'USERNAME_TAKEN');
   return c.reply(200,{...await issue(store,a),recovery});
  }
  await rate(store,'auth-user/'+id,10,15*60000);
  const entry=await store.getWithMetadata(accountKey(id),{type:'json'}),a=entry?.data;
  if(b.action==='recover'){
   if(!a||!equal(c.hash(String(b.recovery||'')),a.recoveryHash))throw c.fail(403,'INVALID_LOGIN');
   if(!passwordOK(b.password))throw c.fail(400,'PASSWORD');
   const salt=c.crypto.randomBytes(16).toString('hex'),passwordHash=await derive(b.password,salt),recovery=c.crypto.randomBytes(24).toString('hex');
   const next=await edit(store,accountKey(id),r=>{if(r.recoveryHash!==a.recoveryHash)throw c.fail(403,'INVALID_LOGIN');r.salt=salt;r.passwordHash=passwordHash;r.recoveryHash=c.hash(recovery);r.version++;return r;});
   return c.reply(200,{...await issue(store,next),recovery});
  }
  const candidate=await derive(typeof b.password==='string'&&b.password.length<=128?b.password:'',a?.salt||'00000000000000000000000000000000');
  if(!a||!equal(candidate,a.passwordHash))throw c.fail(403,'INVALID_LOGIN');
  return c.reply(200,await issue(store,a));
 }
 const a=await authenticate(store,b.session);
 if(b.action==='logout'){await store.delete('teacher/session/'+c.hash(b.session));return c.reply(200,{ok:true});}
 if(b.action==='password'){
  await rate(store,'change/'+a.id,10,15*60000);
  if(!passwordOK(b.newPassword))throw c.fail(400,'PASSWORD');
  if(!equal(await derive(String(b.currentPassword||'').slice(0,129),a.salt),a.passwordHash))throw c.fail(403,'INVALID_LOGIN');
  const salt=c.crypto.randomBytes(16).toString('hex'),passwordHash=await derive(b.newPassword,salt);
  const next=await edit(store,accountKey(a.id),r=>{if(r.version!==a.version)throw c.fail(401,'LOGIN_REQUIRED');r.salt=salt;r.passwordHash=passwordHash;r.version++;return r;});
  return c.reply(200,await issue(store,next));
 }
 if(b.action==='list'){
  const groups=(await Promise.all((a.groups||[]).map(code=>c.load(store,code).then(e=>e.data.ownerTeacherId===a.id?{code,name:e.data.name,language:e.data.language,closed:e.data.closed}:null).catch(()=>null)))).filter(Boolean);
  return c.reply(200,{username:a.id,groups});
 }
 if(b.action==='create'){
  const poem=cleanReading(c,b.poem),name=c.text(b.name,60),language=['en','ca','fr','de','es'].includes(b.language)?b.language:'en';if(!name)throw c.fail(400,'GROUP_NAME');
  await rate(store,'create/'+a.id,20,86400000);
  const code=c.crypto.randomBytes(6).toString('hex'),g={code,name,language,ownerTeacherId:a.id,teacherHash:c.hash(c.crypto.randomBytes(32).toString('hex')),players:[],created:Date.now(),expires:Date.now()+30*86400000,closed:false,poem,poemKey:readingKey(c,poem)};
  const r=await store.setJSON('group/'+code,g,{onlyIfNew:true});if(!r.modified)throw c.fail(409,'BUSY');
  try{await edit(store,accountKey(a.id),r=>{if(r.version!==a.version)throw c.fail(401,'LOGIN_REQUIRED');r.groups=[...new Set([...(r.groups||[]),code])].slice(-200);});}catch(e){await store.delete('group/'+code);throw e;}
  return c.reply(200,{group:c.visible(g,{teacher:true})});
 }
 const code=String(b.code||'').trim().toLowerCase();
 if(b.action==='claim'){
  await rate(store,'claim/'+a.id,10,15*60000);
  const group=await c.mutate(store,code,g=>{if(g.ownerTeacherId&&g.ownerTeacherId!==a.id)throw c.fail(403,'NOT_YOURS');if(!g.ownerTeacherId){c.auth(g,String(b.teacherKey||''),true);g.ownerTeacherId=a.id;g.teacherHash=c.hash(c.crypto.randomBytes(32).toString('hex'));}return c.visible(g,{teacher:true});});
  await edit(store,accountKey(a.id),r=>{if(r.version!==a.version)throw c.fail(401,'LOGIN_REQUIRED');r.groups=[...new Set([...(r.groups||[]),code])].slice(-200);});return c.reply(200,{group});
 }
 const owned=g=>{if(g.ownerTeacherId!==a.id)throw c.fail(403,'NOT_YOURS');};
 if(b.action==='read'){const e=await c.load(store,code);owned(e.data);return c.reply(200,{group:c.visible(e.data,{teacher:true})});}
 if(!['assign','adjust','remove','close','delete'].includes(b.action))throw c.fail(400,'UNKNOWN_ACTION');
 const group=await c.mutate(store,code,g=>{
  owned(g);
  if(b.action==='assign'){
   if(g.closed)throw c.fail(403,'CLOSED');const p=g.players.find(p=>p.id===b.playerId);if(!p)throw c.fail(404,'LEARNER');const task=b.useDefault?null:cleanReading(c,b.poem),previous=readingFor(g,p),next=task||g.poem,changed=readingKey(c,previous)!==readingKey(c,next);
   if(changed&&p.attempts&&!b.confirmReset)throw c.fail(409,'CONFIRM_RESET');if(changed){resetTaskScores(p);p.taskRevision=(p.taskRevision||0)+1;}if(task)p.assignment=task;else delete p.assignment;
  }
  if(b.action==='adjust'){if(!Number.isFinite(b.score)||b.score<0||b.score>10)throw c.fail(400,'SCORE');const p=g.players.find(p=>p.id===b.playerId);if(!p||p.first==null)throw c.fail(404,'LEARNER');p.best=Math.round(b.score*10)/10;p.teacherAdjusted=true;}
  if(b.action==='remove')g.players=g.players.filter(p=>p.id!==b.playerId);
  if(b.action==='close')g.closed=!g.closed;
  if(b.action==='delete'){g.deleted=true;g.players=[];g.teacherHash='';return null;}
  return c.visible(g,{teacher:true});
 });return c.reply(200,b.action==='delete'?{deleted:true}:{group});
}catch(e){return c.reply(e.status||503,{error:e.status?e.message:'UNAVAILABLE'});}}
export default async function(request,context){const r=await handle(request,context);return new Response(r.body,{status:r.statusCode,headers:r.headers});}
