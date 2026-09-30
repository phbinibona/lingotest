// Read-only portrait lookup. This never creates a paid avatar session.
exports.handler=async event=>{
 const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':statusCode===200?'public, max-age=300':'no-store'},body:JSON.stringify(body)});
 if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed'});
 const key=process.env.ANAM_JULIEN_API_KEY||process.env.ANAM_MATEO_API_KEY||process.env.ANAM_API_KEY;
 if(!key)return reply(503,{error:'Julien is not configured.'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('https://api.anam.ai/v1/personas/7604c4ea-a3c4-594b-92d6-3b7f8ac636d3',{headers:{Authorization:'Bearer '+key},signal:controller.signal});
  const persona=await response.json(),imageUrl=persona.avatar?.imageUrl;
  if(!response.ok||typeof imageUrl!=='string'||!imageUrl.startsWith('https://'))return reply(502,{error:'Julien’s portrait is unavailable.'});
  return reply(200,{imageUrl});
 }catch{return reply(502,{error:'Julien’s portrait could not load.'})}finally{clearTimeout(timer)}
};
