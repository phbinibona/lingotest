// Start the saved Julien persona with a dedicated private Anam API key.
const PERSONA_ID='7604c4ea-a3c4-594b-92d6-3b7f8ac636d3';
const response=(statusCode,data)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(data)});
exports.handler=async event=>{
  if(!require('./lib/julien-auth').authorized(event))return require('./lib/julien-auth').denied();
  if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});
  const key=process.env.ANAM_JULIEN_API_KEY || process.env.ANAM_MATEO_API_KEY || process.env.ANAM_API_KEY;
  if(!key)return response(503,{error:'Julien needs ANAM_JULIEN_API_KEY in the site configuration.'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
    const result=await fetch('https://api.anam.ai/v1/auth/session-token',{method:'POST',signal:controller.signal,headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({personaConfig:{personaId:PERSONA_ID,skipGreeting:true}})});
    const data=await result.json();
    if(!result.ok||!data.sessionToken){console.error('Julien session status:',result.status,data.error||data.message);return response(502,{error:result.status===400 && /persona not found or unavailable/i.test(String(data.message||data.error))?'Julien is unavailable to this Anam API key. Set ANAM_JULIEN_API_KEY from the account that owns Julien, then redeploy.':'Anam could not start Julien (HTTP '+result.status+'): '+String(data.message||data.error||'Invalid persona configuration').slice(0,160)})}
    return response(200,{sessionToken:data.sessionToken});
  }catch(error){console.error('Julien session:',error);return response(502,{error:error.name==='AbortError'?'Julien took too long to connect.':'Could not connect to Julien. Please try again.'})}
  finally{clearTimeout(timer)}
};

