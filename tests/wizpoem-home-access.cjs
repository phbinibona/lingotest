const fs=require('fs'),assert=require('assert');
(async()=>{
const mod=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('netlify/edge-functions/wizpoem-gate.js','utf8')).toString('base64'));
for(const path of ['/','/index','/index/','/index.html','/wizpoem-home','/wizpoem-home/','/wizpoem-home.html']){
 const u='https://wizpoem.com'+path;assert.equal(mod.protectedRequest(new URL(u)),false,path);const r=await mod.default(new Request(u),{next:()=>new Response('HOMEPAGE')});assert.equal(await r.text(),'HOMEPAGE');
}
for(const path of ['/WizPoem-ca.html','/WizPoem','/WizDrama-fr','/wizpoem-english','/wizpoem-ca.js','/wizpoem-home.html/extra','/.netlify/functions/verse-assess'])assert.equal(mod.protectedRequest(new URL('https://wizpoem.com'+path)),true,path);
const protectedPage=await mod.default(new Request('https://wizpoem.com/WizPoem-ca.html'),{next:()=>{throw Error('Unauthenticated activity must remain protected')}});assert((await protectedPage.text()).includes('name="password"'));
assert.equal(mod.protectedRequest(new URL('https://lingototal.com/')),false);assert.equal(mod.protectedRequest(new URL('https://lingototal.com/wizpoem-home.html')),false);assert.equal(mod.protectedRequest(new URL('https://lingototal.com/WizPoem-ca.html')),true);
for(const path of ['/WizPoem-ca.html','/WizDrama-fr','/wizpoem-home.html','/wizpoem-english']){const r=await mod.default(new Request('https://lingototal.com'+path+'?reading=example'),{next:()=>{throw Error('Old WizPoem page address should redirect')}});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://wizpoem.com'+path+'?reading=example');}
const other=await mod.default(new Request('https://wizpoem.com/lingohealth.html'),{next:()=>{throw Error('LingoTotal page must not appear under WizPoem')}});assert.equal(other.status,404);assert((await other.text()).includes('Return to WizPoem'));
const lingo=await mod.default(new Request('https://lingototal.com/lingohealth.html'),{next:()=>new Response('LINGOTOTAL')});assert.equal(await lingo.text(),'LINGOTOTAL');
for(const file of fs.readdirSync('.').filter(f=>/^Wiz(?:Poem|Drama).*\.html$/.test(f)))assert(!/lingototal/i.test(fs.readFileSync(file,'utf8')),file);
const home=fs.readFileSync('wizpoem-home.html','utf8');assert(!/lingototal/i.test(home));assert(!home.includes('/wizpoem-english'));assert(!/href=["'][^"']*teacher/.test(home));assert(home.includes('interfaceLanguage'));assert(home.includes('poetryRoute'));assert(home.includes('dramaRoute'));
console.log('PASS homepage accessible without password; activity pages and assets gated; teacher/English-only homepage links removed; existing language and poetry/theatre navigation retained.');
})().catch(e=>{console.error(e);process.exit(1)});
