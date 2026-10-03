const auth=require('./lib/julien-auth');
exports.handler=async (event,context)=>{
 if(!auth.authorized(event))return auth.denied();
 if(event.httpMethod!=='POST')return {statusCode:405,body:'Method not allowed'};
 const handlers={generate:'./gemini',transcribe:'./gemini-transcribe',tts:'./tts'};
 const handler=handlers[event.queryStringParameters?.action];
 if(!handler)return {statusCode:400,body:'Invalid action'};
 return require(handler).handler(event,context);
};
