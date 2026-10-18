import c from './verse-lib/core.mjs';
import {cleanReading,readingFor,readingKey,resetTaskScores} from './verse-lib/tasks.mjs';
async function handle(event){try{const b=c.input(event,12000);c.requireAccess(b);const store=c.storeFor(event),code=String(b.code||'').trim().toLowerCase(),token=String(b.token||'');
if(b.action==='create')throw c.fail(403,'Create groups in the password-protected teacher space.');
if(b.action==='join'){const alias=c.text(b.alias,24);if(!alias)throw c.fail(400,'Choose a first name or nickname.');const newToken=c.crypto.randomBytes(24).toString('hex'),id=c.crypto.randomUUID();const group=await c.mutate(store,code,g=>{if((g.language||'en')!==(b.language==='es'?'es':b.language==='fr'?'fr':b.language==='de'?'de':'en'))throw c.fail(400,'Use the matching language edition for this group.');if(g.closed)throw c.fail(403,'Your teacher has closed this group.');if(g.players.length>=60)throw c.fail(409,'This group is full.');if(g.players.some(p=>p.alias.toLowerCase()===alias.toLowerCase()))throw c.fail(409,'That nickname is taken. Choose another or use your saved group login.');g.players.push({id,alias,tokenHash:c.hash(newToken),attempts:0});return c.visible(g,{player:g.players.find(p=>p.id===id)})});return c.reply(200,{token:newToken,playerId:id,group});}
const entry=await c.load(store,code),access=c.auth(entry.data,token);if(entry.data.ownerTeacherId&&access.teacher)throw c.fail(403,'Use your teacher login.');if((entry.data.language||'en')!==(b.language==='es'?'es':b.language==='fr'?'fr':b.language==='de'?'de':'en'))throw c.fail(400,'Use the matching language edition for this group.');
if(b.action==='read')return c.reply(200,{group:c.visible(entry.data,access),teacher:access.teacher});
if(b.action==='assign'){
 c.auth(entry.data,token,true);
 const assignment=b.useDefault?null:cleanReading(c,b.poem);
 const group=await c.mutate(store,code,g=>{c.auth(g,token,true);if(g.closed)throw c.fail(403,'Reopen the group before changing a task.');const p=g.players.find(p=>p.id===b.playerId);if(!p)throw c.fail(404,'Choose a learner who has joined this group.');const previous=readingFor(g,p),next=assignment||g.poem;const changed=readingKey(c,previous)!==readingKey(c,next);if(changed&&p.attempts&&!b.confirmReset)throw c.fail(409,'Changing this reading resets the learner’s group score and improvement. Confirm the change first.');if(changed){resetTaskScores(p);p.taskRevision=(p.taskRevision||0)+1;}if(assignment)p.assignment=assignment;else delete p.assignment;return c.visible(g,{teacher:true})});return c.reply(200,{group});
}
if(b.action==='delete'){c.auth(entry.data,token,true);await c.mutate(store,code,g=>{c.auth(g,token,true);g.deleted=true;g.players=[];g.teacherHash='';return null});return c.reply(200,{deleted:true});}
if(b.action==='close'){const group=await c.mutate(store,code,g=>{c.auth(g,token,true);g.closed=!g.closed;return c.visible(g,{teacher:true})});return c.reply(200,{group});}
if(b.action==='remove'){const group=await c.mutate(store,code,g=>{c.auth(g,token,true);g.players=g.players.filter(p=>p.id!==b.playerId);return c.visible(g,{teacher:true})});return c.reply(200,{group});}
if(b.action==='adjust'){if(!Number.isFinite(b.score)||b.score<0||b.score>10)throw c.fail(400,'Enter a score from 0 to 10.');const group=await c.mutate(store,code,g=>{c.auth(g,token,true);const p=g.players.find(p=>p.id===b.playerId);if(!p||p.first==null)throw c.fail(404,'Choose a learner with an assessed performance.');p.best=Math.round(b.score*10)/10;p.teacherAdjusted=true;return c.visible(g,{teacher:true})});return c.reply(200,{group});}
throw c.fail(400,'Unknown group action.');
}catch(e){return c.reply(e.status||503,{error:e.status?e.message:'The group service is temporarily unavailable. Your recording is still on your device.',code:e.status?undefined:e.name})}}

export default async function(request){const result=await handle({httpMethod:request.method,body:await request.text()});return new Response(result.body,{status:result.statusCode,headers:result.headers});}






