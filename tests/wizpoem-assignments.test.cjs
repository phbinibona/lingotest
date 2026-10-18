const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=require('path').resolve(__dirname,'../functions')+'/';
const values=new Map();let serial=0,modelCalls=0,midflight=null;
const store={async getWithMetadata(k){const x=values.get(k);return x?{data:structuredClone(x.data),etag:x.etag}:null},async setJSON(k,data,opts={}){const old=values.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch)return {modified:false};values.set(k,{data:structuredClone(data),etag:String(++serial)});return {modified:true}}};
const assessment={scorable:true,clarity:2,rhythm:1.5,expression:1.5,accuracy:1,strength:'Clear words.',nextStep:'Pause before the final line.',interpretation:'A calm reading.',heard:'a line'};
const context=vm.createContext({console,Buffer,process:{env:{GEMINI_API_KEY:'fake-test-key'}},Date,Set,Error,JSON,Number,String,Array,Math,AbortController,Response,setTimeout,clearTimeout,fetch:async()=>{modelCalls++;if(midflight){const f=midflight;midflight=null;await f();}return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(assessment)}]}}]})}}});
const modules=new Map();
async function get(path){if(modules.has(path))return modules.get(path);if(path==='node:crypto'){const m=new vm.SyntheticModule(['default'],function(){this.setExport('default',crypto)},{context});modules.set(path,m);return m;}if(path==='@netlify/blobs'){const m=new vm.SyntheticModule(['getStore'],function(){this.setExport('getStore',()=>store)},{context});modules.set(path,m);return m;}const m=new vm.SourceTextModule(fs.readFileSync(path,'utf8'),{context,identifier:path});modules.set(path,m);await m.link((name,ref)=>get(name.startsWith('.')?require('path').resolve(require('path').dirname(ref.identifier),name):name));return m;}
(async()=>{const groups=await get(root+'verse-groups.mjs');await groups.evaluate();const assess=await get(root+'verse-assess.mjs');await assess.evaluate();const core=modules.get(root+'verse-lib/core.mjs').namespace.default;
async function call(mod,body){const r=await mod.namespace.default(new Request('https://example.test',{method:'POST',body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}
const poem={title:'Shared poem',poet:'Poet',lines:Array.from({length:8},(_,i)=>'Shared line '+i)};
const created=await call(groups,{action:'create',name:'Class',poem,language:'en'});assert.equal(created.status,200);const code=created.body.group.code,key=created.body.teacherKey;
const join=alias=>call(groups,{action:'join',code,alias,language:'en'});const alice=(await join('Alice')).body,bob=(await join('Bob')).body;
const read=token=>call(groups,{action:'read',code,token,language:'en'});
const assigned={title:'Different extract',poet:'Poet',lines:['First assigned line','Second assigned line'],intention:'Sound curious'};
const assign=(extra={})=>call(groups,{action:'assign',code,token:key,language:'en',playerId:alice.playerId,poem:assigned,...extra});
assert.equal((await assign({token:alice.token})).status,403,'learner cannot assign');assert.equal((await assign()).status,200);
let a=(await read(alice.token)).body.group,b=(await read(bob.token)).body.group,t=(await read(key)).body.group;
assert.equal(a.myAssignment.title,assigned.title);assert.equal(b.myAssignment.title,poem.title);assert.equal(a.hasIndividualAssignments,true);assert(!a.players.some(p=>p.assignment),'other learners receive no private task bodies');assert.equal(t.players.find(p=>p.id===alice.playerId).assignment.lines.length,2);
const audio='A'.repeat(800),payload={language:'en',code,token:alice.token,title:assigned.title,poet:assigned.poet,lines:assigned.lines,mimeType:'audio/webm',audioBase64:audio};
assert.equal((await call(assess,{...payload,title:poem.title,lines:poem.lines})).status,409,'wrong task rejected');assert.equal(modelCalls,0);
let score=await call(assess,payload);assert.equal(score.status,200);assert.equal(score.body.groupSaved,true);assert.equal(score.body.total,6);
let groupData=values.get('group/'+code).data;assert.equal(groupData.players.find(p=>p.id===alice.playerId).attempts,1);
assert.equal((await assign({useDefault:true})).status,409,'reset needs confirmation');assert.equal((await assign({useDefault:true,confirmReset:true})).status,200);
a=(await read(alice.token)).body.group;assert.equal(a.myAssignment.title,poem.title);assert.equal(a.players.find(p=>p.id===alice.playerId).best,null);
// Rate limit/quota survives task changes, while task score state restarts.
groupData=values.get('group/'+code).data;assert.equal(groupData.players.find(p=>p.id===alice.playerId).requests,1);groupData.players.find(p=>p.id===alice.playerId).lastRequest=0;
await assign();groupData=values.get('group/'+code).data;groupData.players.find(p=>p.id===alice.playerId).lastRequest=0;
midflight=()=>assign({poem:{...assigned,title:'New task'},confirmReset:true});score=await call(assess,payload);assert.equal(score.body.groupSaved,false,'stale result cannot enter new task');
assert.equal((await assign({poem:{...assigned,lines:[]}})).status,400);assert.equal((await assign({poem:{...assigned,lines:Array(61).fill('x')}})).status,400);
await call(groups,{action:'close',code,token:key,language:'en'});assert.equal((await assign()).status,403,'closed group assignment rejected');
// Shared groups still work and task-key rankings distinguish different extracts.
assert.equal(a.hasIndividualAssignments,false);assert.notEqual(t.players.find(p=>p.id===alice.playerId).taskKey,t.players.find(p=>p.id===bob.playerId).taskKey);
console.log('PASS: teacher-only assignments; separate tasks; default fallback; private task visibility; correct-text enforcement; score reset confirmation; stale-result rejection; limits; closed-group rules; quota preservation.');
})().catch(e=>{console.error(e);process.exitCode=1});
