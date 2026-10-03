const auth=require('./lib/julien-auth');
const generate=require('./gemini').handler;
const transcribe=require('./gemini-transcribe').handler;
const tts=require('./tts').handler;
exports.handler=async (event,context)=>{
 if(!auth.authorized(event))return auth.denied();
 if(event.httpMethod!=='POST')return {statusCode:405,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Method not allowed'})};
 const handlers={generate,transcribe,tts};
 const action=event.queryStringParameters?.action;
 if(!Object.prototype.hasOwnProperty.call(handlers,action))return {statusCode:400,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Invalid action'})};
 if(action==='generate'){try{const input=JSON.parse(event.body||'{}');event={...event,body:JSON.stringify({...input,responseMimeType:'application/json',thinkingBudget:0})}}catch{return {statusCode:400,body:JSON.stringify({error:'Invalid request'})}}}
 return handlers[action](event,context);
};