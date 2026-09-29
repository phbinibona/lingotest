// Start the saved Mateo persona with a dedicated private Anam API key.
const PERSONA_ID='c757f529-3bf8-4861-bf2c-a73ced750dc2';
const response=(statusCode,data)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(data)});
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});
  const key=process.env.ANAM_MATEO_API_KEY || process.env.ANAM_API_KEY;
  if(!key)return response(503,{error:'Mateo needs ANAM_MATEO_API_KEY in the site configuration.'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
    const result=await fetch('https://api.anam.ai/v1/auth/session-token',{method:'POST',signal:controller.signal,headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({personaConfig:{personaId:PERSONA_ID,skipGreeting:true}})});
    const data=await result.json();
    if(!result.ok||!data.sessionToken){console.error('Mateo session status:',result.status,data.error||data.message);return response(502,{error:result.status===400 && /persona not found or unavailable/i.test(String(data.message||data.error))?'Mateo is unavailable to this Anam API key. Set ANAM_MATEO_API_KEY from the account that owns Mateo, then redeploy.':'Anam could not start Mateo (HTTP '+result.status+'): '+String(data.message||data.error||'Invalid persona configuration').slice(0,160)})}
    return response(200,{sessionToken:data.sessionToken});
  }catch(error){console.error('Mateo session:',error);return response(502,{error:error.name==='AbortError'?'Mateo took too long to connect.':'Could not connect to Mateo. Please try again.'})}
  finally{clearTimeout(timer)}
};
