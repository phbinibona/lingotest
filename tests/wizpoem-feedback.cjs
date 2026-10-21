const vm=require('vm'),fs=require('fs'),assert=require('assert');
for(const lang of ['en','ca','es','fr','de'])for(const reduced of [true,false]){
 const nodes={};class N{constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.previousElementSibling={};this.parentElement={after(){}};}set id(v){nodes[v]=this}append(...v){this.children.push(...v)}replaceChildren(...v){this.children=v}setAttribute(k,v){this[k]=v}addEventListener(k,fn){this.listener=fn}}
 for(const id of ['totalScore','scoreBadge','comparison','scoreBars','strength','nextStep','interpretation','practiceTask','improve','recordStatus','recordHint'])nodes[id]=new N();
 const summary=new N(),details=new N();details.querySelector=()=>summary;
 const document={documentElement:{lang},getElementById:id=>nodes[id],createElement:tag=>new N(tag),querySelector:()=>details,querySelectorAll:()=>nodes.scoreBars.children.map(x=>x.children[1])};
 let frame;const window={matchMedia:()=>({matches:reduced})};const ctx=vm.createContext({document,window,performance:{now:()=>0},requestAnimationFrame:fn=>(frame=fn,1),cancelAnimationFrame(){}});
 vm.runInContext(fs.readFileSync('wizpoem-feedback.js','utf8'),ctx);
 const result={total:4,clarity:1.5,rhythm:1,expression:.5,accuracy:1,nextStep:'Pause after line 2.',practiceTask:'Read lines 1–2 twice, then record again.'};
 for(const prior of [[],[{total:3}],[{total:4}],[{total:6},{total:5}]]){
 window.wizFeedback(result,prior);if(!reduced)frame(700);
 assert.equal(nodes.totalScore.textContent,'4');assert(details.open);assert.equal(nodes.practiceTask.textContent,result.practiceTask);assert(nodes.comparison.textContent.includes(String(prior.length+1)));assert.equal(nodes.scoreBars.children.length,4);assert.equal(nodes.scoreBars.children[2].children[1].value,.5);nodes.improve.listener();assert.equal(nodes.recordStatus.textContent,result.practiceTask);
 }
 window.wizFeedback({...result,practiceTask:undefined},[]);assert.equal(nodes.practiceTask.textContent,result.nextStep);
 console.log('PASS feedback '+lang+' reducedMotion='+reduced+': first/retry/higher/equal/lower, task, bars and reduced motion');
}
