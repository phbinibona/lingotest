const auth=require('./lib/julien-auth');
const reply=(statusCode,body,headers={})=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers},body:JSON.stringify(body)});
exports.handler=async event=>{
 if(event.httpMethod==='GET')return reply(200,{authorized:auth.authorized(event)});
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 if(!auth.configured())return reply(503,{error:'Access is not configured yet.'});
 let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Invalid request'})}
 if(!auth.validCode(body.code))return reply(401,{error:'Invalid access code.'});
 return reply(200,{authorized:true},{'Set-Cookie':auth.cookie()});
};
