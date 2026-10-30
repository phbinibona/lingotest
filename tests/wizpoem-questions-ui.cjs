const vm=require('vm'),fs=require('fs'),assert=require('assert');
(async()=>{for(const language of ['en','ca','es','fr','de']){
const nodes={},events={};class N{constructor(){this.children=[];this.value=''}set innerHTML(s){this.html=s;for(const m of s.matchAll(/id="([^"]+)"/g))nodes[m[1]]=new N()}append(...n){this.children.push(...n)}before(){}replaceChildren(){this.children=[]}}
nodes.savedStatus=new N();const calls=[];let fail=false,resolve;
class FR{readAsDataURL(){this.result='data:audio/webm;base64,'+Buffer.alloc(1000).toString('base64');this.onload()}}
const ctx=vm.createContext({document:{documentElement:{lang:language},head:new N(),getElementById:id=>nodes[id],createElement:()=>new N(),createTextNode:t=>t},window:{addEventListener:(name,fn)=>events[name]=fn},FileReader:FR,AbortController,setTimeout,clearTimeout,fetch:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return {ok:!fail,json:async()=>fail?{error:'Retry'}:{answer:'Try a pause.'}}}});
vm.runInContext(fs.readFileSync('wizpoem-questions.js','utf8'),ctx);assert(nodes.qMic.disabled);await nodes.qSend.onclick();assert.equal(calls.length,0);
events['wiz-performance-result']({detail:{result:{scorable:true,total:4},reading:{title:'Test',lines:['One line']},blob:{type:'audio/webm'}}});nodes.qScore.onclick();assert(nodes.coachQuestion.value);await nodes.qSend.onclick();assert.equal(calls[0].body.language,language);assert.equal(calls[0].body.history.length,0);assert.equal(nodes.qHistory.children.length,2);
nodes.qPractice.onclick();fail=true;const question=nodes.coachQuestion.value;await nodes.qSend.onclick();assert.equal(nodes.coachQuestion.value,question);assert.equal(nodes.qHistory.children.length,2);fail=false;await nodes.qSend.onclick();assert.equal(calls.at(-1).body.history.length,1);
for(let n=0;n<4;n++){nodes.qScore.onclick();await nodes.qSend.onclick()}const count=calls.length;nodes.qScore.onclick();await nodes.qSend.onclick();assert.equal(calls.length,count);
events['wiz-performance-reset']();assert.equal(nodes.qHistory.children.length,0);nodes.qScore.onclick();await nodes.qSend.onclick();assert.equal(calls.length,count);console.log('PASS '+language+': question context, localized prompts, history, retry, six-question limit and reset.');
}})().catch(e=>{console.error(e);process.exit(1)});
