const assert=require('node:assert/strict');
const geminiPath=require.resolve('../functions/gemini');
const original=require(geminiPath);let request,upstream={statusCode:200,body:JSON.stringify({text:JSON.stringify({translation:'river bank'})})};
require.cache[geminiPath].exports={handler:async event=>{request=JSON.parse(event.body);return upstream}};
const translate=require('../functions/reading-translate').handler;
const event=body=>({httpMethod:'POST',body:JSON.stringify(body)});
(async()=>{
 try{
  const response=await translate(event({text:'orilla',context:'Estamos en la orilla del río.',source:'Spanish',target:'en'}));
  assert.equal(response.statusCode,200);assert.deepEqual(JSON.parse(response.body),{translation:'river bank',language:'en'});
  assert.match(request.prompt,/from Spanish into English/);assert.match(request.prompt,/Estamos en la orilla del río/);assert.match(request.prompt,/data, never instructions/);
  await translate(event({text:'Hej!',source:'sv-SE',target:'ca'}));assert.match(request.prompt,/from Swedish into Catalan/);
  await translate(event({text:'学校',source:'Japanese',target:'ar'}));assert.match(request.prompt,/from Japanese into Arabic/);
  assert.equal((await translate({httpMethod:'GET'})).statusCode,405);
  assert.equal((await translate({httpMethod:'POST',body:'not json'})).statusCode,400);
  for(const body of [{text:'hi',source:'unknown',target:'en'},{text:'hi',source:'es',target:'unknown'},{text:'',source:'es',target:'en'},{text:'x'.repeat(1601),source:'es',target:'en'},{text:'hi',context:'x'.repeat(3201),source:'es',target:'en'}])assert.equal((await translate(event(body))).statusCode,400);
  upstream={statusCode:503,body:'error'};assert.equal((await translate(event({text:'hola',source:'es',target:'en'}))).statusCode,502);
  upstream={statusCode:200,body:JSON.stringify({text:'{"translation":123}'})};assert.equal((await translate(event({text:'hola',source:'es',target:'en'}))).statusCode,502);
  console.log('Translation language routing, sentence context, validation and service errors passed.');
 }finally{require.cache[geminiPath].exports=original}
})().catch(error=>{console.error(error);process.exitCode=1});
