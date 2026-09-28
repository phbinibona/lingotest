// Exchange the private Anam API key for a short-lived browser session token.
const PERSONA_ID = 'ce49cd17-42c2-4570-830d-d25b871b55b6';
const respond = (statusCode, data) => ({statusCode, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(data)});
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return respond(405,{error:'Method not allowed'});
  const key=process.env.ANAM_API_KEY;
  if (!key) return respond(503,{error:'Anam is not connected yet. Add ANAM_API_KEY in the Netlify environment variables.'});
  try {
    const controller = new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    let result;
    try { result=await fetch('https://api.anam.ai/v1/auth/session-token',{
      method:'POST',signal:controller.signal,headers:{authorization:'Bearer '+key,'content-type':'application/json'},
      body:JSON.stringify({personaConfig:{personaId:process.env.ANAM_PETER_PERSONA_ID||PERSONA_ID,skipGreeting:true}})
    }); } finally {clearTimeout(timer)}
    const data=await result.json();
    if(!result.ok || !data.sessionToken) return respond(502,{error:'Anam could not start Olivia (HTTP '+result.status+'). Confirm that the ID is a saved persona ID and belongs to the account holding ANAM_API_KEY. '+String(data.message||data.error||'').slice(0,130)});
    return respond(200,{sessionToken:data.sessionToken});
  } catch(error) {console.error('Anam session:',error);return respond(502,{error:'Could not connect to Anam. Please try again.'})}
};
