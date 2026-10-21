const fs=require('fs'),assert=require('assert');
(async()=>{
const mod=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('netlify/edge-functions/wizpoem-gate.js','utf8')).toString('base64'));
for(const path of ['/','/index','/index/','/index.html','/wizpoem-home','/wizpoem-home/','/wizpoem-home.html']){
 const u='https://wizpoem.com'+path;assert.equal(mod.protectedRequest(new URL(u)),false,path);const r=await mod.default(new Request(u),{next:()=>new Response('HOMEPAGE')});assert.equal(await r.text(),'HOMEPAGE');
}
for(const path of ['/WizPoem-ca.html','/WizPoem','/WizDrama-fr','/wizpoem-english','/wizpoem-ca.js','/wizpoem-home.html/extra','/.netlify/functions/verse-assess'])assert.equal(mod.protectedRequest(new URL('https://wizpoem.com'+path)),true,path);
const protectedPage=await mod.default(new Request('https://wizpoem.com/WizPoem-ca.html'),{next:()=>{throw Error('Unauthenticated activity must remain protected')}});assert((await protectedPage.text()).includes('name="password"'));
assert.equal(mod.protectedRequest(new URL('https://lingototal.com/')),false);assert.equal(mod.protectedRequest(new URL('https://lingototal.com/wizpoem-home.html')),false);assert.equal(mod.protectedRequest(new URL('https://lingototal.com/WizPoem-ca.html')),true);
const home=fs.readFileSync('wizpoem-home.html','utf8');assert(!home.includes('/wizpoem-english'));assert(!/href=["'][^"']*teacher/.test(home));assert(home.includes('interfaceLanguage'));assert(home.includes('poetryRoute'));assert(home.includes('dramaRoute'));
console.log('PASS homepage accessible without password; activity pages and assets gated; teacher/English-only homepage links removed; existing language and poetry/theatre navigation retained.');
})().catch(e=>{console.error(e);process.exit(1)});
