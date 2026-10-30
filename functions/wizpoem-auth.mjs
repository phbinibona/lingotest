import crypto from 'node:crypto';
const SALT='wizpoem-private-access-2026-10-20';
const PASSWORD_HASH='58937bd5497ae334ebedd56ee93b46d473e1e1e9e9e996480e24a2d07e26534b9e2f8a837d5ba1392a8599769cab3af1b05630b992b83e50e43aa012018ab22f';
const COOKIE='__Host-wizpoem_session';
const HOURS=8;
const attempts=new Map();
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
function signingKey(){const secret=process.env.WIZPOEM_SESSION_SECRET||process.env.GEMINI_API_KEY;if(!secret)throw Error('No session secret');return crypto.createHmac('sha256',secret).update('wizpoem-private-site:v1').digest()}
function sign(data){return crypto.createHmac('sha256',signingKey()).update(data).digest('base64url')}
function valid(token){try{const [data,sig,...rest]=String(token||'').split('.');if(rest.length||!data||!sig)return false;const expected=Buffer.from(sign(data)),actual=Buffer.from(sig);if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return false;const d=JSON.parse(Buffer.from(data,'base64url'));return d.scope==='wizpoem-site'&&d.expires>Date.now()&&d.expires<=Date.now()+HOURS*3600000+60000}catch{return false}}
function cookieValue(request){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export default async function(request,context={}){
 if(request.method!=='POST')return reply(405,{ok:false});
 const raw=await request.text();if(raw.length>4096)return reply(413,{ok:false});let b;try{b=JSON.parse(raw)}catch{return reply(400,{ok:false})}
 if(b.action==='check'){const ok=valid(b.sessionToken||cookieValue(request));return reply(ok?200:401,{ok});}
 if(b.action!=='login')return reply(400,{ok:false});
 const ip=context.ip||'unknown',now=Date.now();let count=attempts.get(ip);if(!count||count.until<now)count={n:0,until:now+300000};if(count.n>=10)return reply(429,{ok:false});
 count.n++;attempts.set(ip,count);if(attempts.size>1000)for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
 const supplied=String(b.password||'').toUpperCase();if(supplied.length>128)return reply(401,{ok:false});
 const hash=await new Promise((resolve,reject)=>crypto.scrypt(supplied,SALT,64,(e,k)=>e?reject(e):resolve(k)));
 if(!crypto.timingSafeEqual(hash,Buffer.from(PASSWORD_HASH,'hex')))return reply(401,{ok:false});
 try{const data=Buffer.from(JSON.stringify({scope:'wizpoem-site',expires:now+HOURS*3600000,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');const token=data+'.'+sign(data);attempts.delete(ip);return reply(200,{ok:true},{'Set-Cookie':COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+HOURS*3600})}catch{return reply(503,{ok:false})}
}
