// Create a session for the saved Mateo persona without exposing the Anam key.
const SHARE_TOKEN='uUKOn6VbkLwAKtaeYjlng';
const response=(statusCode,data)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(data)});
let cachedId='',cachedUntil=0;
async function lookupPersona(key,signal){
  if(process.env.ANAM_MATEO_PERSONA_ID)return process.env.ANAM_MATEO_PERSONA_ID;
  if(cachedId&&Date.now()<cachedUntil)return cachedId;
  for(let page=1;page<=5;page++){
    const result=await fetch(`https://api.anam.ai/v1/share-links?page=${page}&perPage=100`,{headers:{authorization:`Bearer ${key}`},signal});
    if(!result.ok)throw Error('Anam could not list the saved share links.');
    const body=await result.json();
    const links=Array.isArray(body.data)?body.data:[];
    const match=links.find(link=>link.token===SHARE_TOKEN || link.url?.endsWith('/'+SHARE_TOKEN));
    if(match?.personaId){cachedId=match.personaId;cachedUntil=Date.now()+600000;return cachedId}
    if(!body.meta?.next)break;
  }
  throw Error('Mateo was not found in the Anam account for this site. Add ANAM_MATEO_PERSONA_ID in Netlify.');
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});
  const key=process.env.ANAM_API_KEY;
  if(!key)return response(503,{error:'Anam is not connected on this site.'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const personaId=await lookupPersona(key,controller.signal);
    const result=await fetch('https://api.anam.ai/v1/auth/session-token',{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({personaConfig:{personaId,skipGreeting:true}})});
    const data=await result.json();
    if(!result.ok||!data.sessionToken)return response(502,{error:'Anam could not start Mateo. Check that his persona belongs to the site’s Anam account.'});
    return response(200,{sessionToken:data.sessionToken});
  }catch(error){console.error('Mateo session:',error);return response(502,{error:error.name==='AbortError'?'Mateo took too long to connect.':error.message})}
  finally{clearTimeout(timer)}
};
