import crypto from 'node:crypto';
import {getStore} from '@netlify/blobs';
const SALT='wizpoem-private-access-2026-10-20';
const PASSWORD_HASH='58937bd5497ae334ebedd56ee93b46d473e1e1e9e9e996480e24a2d07e26534b9e2f8a837d5ba1392a8599769cab3af1b05630b992b83e50e43aa012018ab22f';
const COOKIE='__Host-wizpoem_session';
const HOURS=8;
const attempts=new Map();
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
// Preview sessions use a private server-side store rather than an AI API key.
const sessionStore=()=>getStore({name:'wizpoem-prototype-sessions-v1',consistency:'strong'});
const sessionKey=token=>'session/'+crypto.createHash('sha256').update(token).digest('hex');
async function valid(token){if(!/^[A-Za-z0-9_-]{43}$/.test(String(token||'')))return false;const entry=await sessionStore().get(sessionKey(token),{type:'json'});return entry?.scope==='wizpoem-prototype'&&Number.isFinite(entry.expires)&&entry.expires>Date.now()&&entry.expires<=Date.now()+HOURS*3600000+60000;}
async function issueSession(now){const token=crypto.randomBytes(32).toString('base64url');await sessionStore().setJSON(sessionKey(token),{scope:'wizpoem-prototype',expires:now+HOURS*3600000},{onlyIfNew:true});return token;}

function cookieValue(request){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export default async function(request,context={}){
 if(request.method!=='POST')return reply(405,{ok:false});
 const raw=await request.text();if(raw.length>4096)return reply(413,{ok:false});let b;try{b=JSON.parse(raw)}catch{return reply(400,{ok:false})}
 if(b.action==='check'){try{const ok=await valid(b.sessionToken||cookieValue(request));return reply(ok?200:401,{ok});}catch{return reply(503,{ok:false,error:'Access is temporarily unavailable. Please try again.'});}}
 if(b.action!=='login')return reply(400,{ok:false});
 const ip=context.ip||'unknown',now=Date.now();let count=attempts.get(ip);if(!count||count.until<now)count={n:0,until:now+300000};if(count.n>=10)return reply(429,{ok:false});
 count.n++;attempts.set(ip,count);if(attempts.size>1000)for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
 const supplied=String(b.password||'').trim().toUpperCase();if(supplied.length>128)return reply(401,{ok:false});
 const hash=await new Promise((resolve,reject)=>crypto.scrypt(supplied,SALT,64,(e,k)=>e?reject(e):resolve(k)));
 if(!crypto.timingSafeEqual(hash,Buffer.from(PASSWORD_HASH,'hex')))return reply(401,{ok:false});
 try{const token=await issueSession(now);attempts.delete(ip);return reply(200,{ok:true},{'Set-Cookie':COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+HOURS*3600})}catch{return reply(503,{ok:false})}
}
