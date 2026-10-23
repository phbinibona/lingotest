const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// A selected language must survive every entry point and its shared activity code.
const index=read('index.html');
for(const id of ['uiLanguage','targetLanguage']){
 const select=index.match(new RegExp('<select[^>]*id="'+id+'"[^>]*>[\\s\\S]*?</select>'))[0];
 assert.match(select,new RegExp('value="'+(id==='uiLanguage'?'sv':'Swedish')+'"[^>]*>Svenska'));
}
const activities=[...new Set([...index.matchAll(/(?:data-page|page)[:=]\s*["']([^"']+\.html)/g)].map(m=>m[1]))];
for(const file of activities){
 const html=read(file),sources=[html,...[...html.matchAll(/<script[^>]+src=["']([^"'?]+)/g)].map(m=>m[1]).filter(f=>fs.existsSync(path.join(root,f))).map(read)];
 assert(sources.some(s=>/(?:"sv"|'sv'|\bsv:)/.test(s)),file+' has no Swedish language mapping');
}
const context={URLSearchParams};vm.createContext(context);
vm.runInContext(read('julien-languages.js').replace(/export\s+/g,'')+'\nglobalThis.api={LANGUAGES,TRANSLATIONS,resolveLanguage,resolveInterfaceLanguage};',context);
const {LANGUAGES,TRANSLATIONS,resolveLanguage,resolveInterfaceLanguage}=context.api;
assert.deepEqual(Array.from(LANGUAGES.sv),['Swedish','Svenska','sv-SE']);
for(const name of ['sv','sv-SE','Swedish','Svenska'])assert.equal(resolveLanguage(new URLSearchParams({target:name})),'sv');
assert.equal(resolveInterfaceLanguage(new URLSearchParams({ui:'sv',target:'Spanish'})),'sv');
function shape(a,b,label){if(Array.isArray(a)){assert.equal(b.length,a.length,label);a.forEach((v,i)=>shape(v,b[i],label+'['+i+']'));}else if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),label);Object.keys(a).forEach(k=>shape(a[k],b[k],label+'.'+k));}else assert.equal(typeof b,typeof a,label)}
shape(TRANSLATIONS.en,TRANSLATIONS.sv,'conversation copy');

// Both speech endpoints must forward sv-SE to the provider rather than use English.
(async()=>{
 const previousFetch=global.fetch,previousKey=process.env.GOOGLE_TTS_API_KEY;
 process.env.GOOGLE_TTS_API_KEY='test-key';let calls=[];
 global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({audioContent:'test-audio'})}};
 try{
  const tts=require('../functions/google-tts.js');
  for(const language of ['Swedish','Svenska','sv','sv-SE']){
   const result=await tts.handler({httpMethod:'POST',body:JSON.stringify({text:'Hej! Hur mår du?',languageCode:language})});
   assert.equal(result.statusCode,200);assert.equal(calls.at(-1).body.voice.languageCode,'sv-SE');
  }
  const shared=read('functions/tts.js');assert.match(shared,/ALLOWED_LOCALES[\s\S]*?'sv-SE'/);
  assert.match(read('functions/azure-pronunciation.js'),/Swedish:\s*"sv-SE"/);
  console.log('Swedish selectors, '+activities.length+' activity entries, conversation copy and speech routing passed.');
 }finally{global.fetch=previousFetch;if(previousKey===undefined)delete process.env.GOOGLE_TTS_API_KEY;else process.env.GOOGLE_TTS_API_KEY=previousKey;}
})().catch(e=>{console.error(e);process.exitCode=1});
