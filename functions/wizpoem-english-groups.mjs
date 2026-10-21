import c from './verse-lib/core.mjs';
import access from './wizpoem-auth.mjs';
import {getStore} from '@netlify/blobs';
const fail=c.fail;
function reading(p){
 if(!p||!Array.isArray(p.lines)||!['poetry','drama'].includes(p.genre))throw fail(400,'Choose poetry or theatre and enter the reading.');
 const lines=p.lines.map(x=>typeof x==='string'?x.trim():'').filter(Boolean);
 const title=c.text(p.title,140),poet=c.text(p.poet,100);
 if(!title||!poet||!lines.length||lines.length>60||lines.join('\n').length>4000)throw fail(400,'Enter a title, author and 1–60 lines (up to 4,000 characters).');
 return {id:c.crypto.randomUUID(),title,poet,lines,genre:p.genre,guidance:c.text(p.guidance,400)};
}
function visible(g){return {code:g.code,name:g.name,readings:g.readings,closed:g.closed,revision:g.revision,expires:g.expires};}
export default async function(request){try{
 const check=await access(new Request(request.url,{method:'POST',headers:{cookie:request.headers.get('cookie')||''},body:JSON.stringify({action:'check'})}));
 if(!check.ok)throw fail(401,'Open WizPoem and enter the site password first.');
 const b=c.input({httpMethod:request.method,body:await request.text()},10000),store=getStore({name:'wizpoem-english-materials-v1',consistency:'strong'});
 if(b.action==='create'){
  const name=c.text(b.name,60);if(!name)throw fail(400,'Enter a group name.');
  const teacherKey=c.crypto.randomBytes(24).toString('hex'),code=c.crypto.randomBytes(6).toString('hex');
  const g={code,name,teacherHash:c.hash(teacherKey),readings:[],closed:false,revision:1,expires:Date.now()+180*86400000};
  const result=await store.setJSON('group/'+code,g,{onlyIfNew:true});if(!result.modified)throw fail(409,'Please try creating the group again.');
  return Response.json({group:visible(g),teacherKey},{headers:{'Cache-Control':'no-store'}});
 }
 const code=String(b.code||'').trim().toLowerCase();if(!/^[a-f0-9]{12}$/.test(code))throw fail(404,'Check the group code and try again.');
 const entry=await store.getWithMetadata('group/'+code,{type:'json'}),g=entry?.data;
 if(!g||g.deleted)throw fail(404,'This group is no longer available.');if(g.expires<Date.now())throw fail(410,'This group has expired. Ask your teacher for a new group.');
 const teacher=!!b.teacherKey&&c.hash(b.teacherKey)===g.teacherHash;
 if(b.action==='read'){
  if(b.teacherKey&&!teacher)throw fail(403,'The teacher key was not recognised.');
  if(g.closed&&!teacher)throw fail(403,'Your teacher has paused access to this group.');
  return Response.json({group:visible(g),teacher},{headers:{'Cache-Control':'no-store'}});
 }
 if(!teacher)throw fail(403,'Your private teacher key is required to change this group.');
 if(b.revision!==g.revision)throw fail(409,'This group changed in another tab. Refresh it before saving again.');
 if(b.action==='save'){
  const p=reading(b.reading),old=g.readings.findIndex(x=>x.id===b.readingId);
  if(b.readingId&&old<0)throw fail(404,'That reading was removed. Refresh the group.');
  if(old>=0){p.id=b.readingId;g.readings[old]=p;}else{if(g.readings.length>=20)throw fail(400,'A group can hold up to 20 readings. Remove one before adding another.');g.readings.push(p);}
 }else if(b.action==='remove'){
  if(!g.readings.some(x=>x.id===b.readingId))throw fail(404,'That reading was not found.');g.readings=g.readings.filter(x=>x.id!==b.readingId);
 }else if(b.action==='rename'){const name=c.text(b.name,60);if(!name)throw fail(400,'Enter a group name.');g.name=name;
 }else if(b.action==='close')g.closed=!g.closed;
 else if(b.action==='delete'){g.deleted=true;g.readings=[];g.teacherHash='';}
 else throw fail(400,'Unknown group action.');
 g.revision++;const saved=await store.setJSON('group/'+code,g,{onlyIfMatch:entry.etag});if(!saved.modified)throw fail(409,'This group changed while saving. Refresh it and try again.');
 return Response.json(g.deleted?{deleted:true}:{group:visible(g)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e.status?e.message:'The group service is temporarily unavailable. Please try again.'},{status:e.status||503,headers:{'Cache-Control':'no-store'}});}
};
