import crypto from "node:crypto";

const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
let cachedToken = "";
let cachedTokenExpiry = 0;

const LANGUAGE_LOCALES = {
  english:"en-GB", en:"en-GB", "en-gb":"en-GB",
  catalan:"ca-ES", catala:"ca-ES", ca:"ca-ES", "ca-es":"ca-ES",
  spanish:"es-ES", espanol:"es-ES", es:"es-ES", "es-es":"es-ES",
  french:"fr-FR", francais:"fr-FR", fr:"fr-FR", "fr-fr":"fr-FR",
  german:"de-DE", deutsch:"de-DE", de:"de-DE", "de-de":"de-DE",
  italian:"it-IT", italiano:"it-IT", it:"it-IT", "it-it":"it-IT",
  portuguese:"pt-PT", portugues:"pt-PT", pt:"pt-PT", "pt-pt":"pt-PT",
  basque:"eu-ES", euskara:"eu-ES", eu:"eu-ES", "eu-es":"eu-ES",
  japanese:"ja-JP", ja:"ja-JP", "ja-jp":"ja-JP",
  arabic:"ar-SA", ar:"ar-SA", "ar-sa":"ar-SA", "ar-xa":"ar-SA"
};

function normaliseLanguageCode(value){
  const raw=String(value||"").trim();
  if(!raw)return "en-GB";
  const key=raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return LANGUAGE_LOCALES[key]||raw;
}

function b64url(value){
  return Buffer.from(value).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

async function serviceAccountToken(){
  if(cachedToken && Date.now()<cachedTokenExpiry-60000)return cachedToken;
  const raw=process.env.GOOGLE_TTS_CREDENTIALS;
  if(!raw)throw new Error("No Google TTS credentials configured.");
  const c=JSON.parse(raw);
  if(!c.client_email||!c.private_key)throw new Error("GOOGLE_TTS_CREDENTIALS is incomplete.");
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claim=b64url(JSON.stringify({iss:c.client_email,scope:SCOPE,aud:TOKEN_URL,iat:now,exp:now+3600}));
  const unsigned=`${header}.${claim}`;
  const sig=crypto.createSign("RSA-SHA256").update(unsigned).end().sign(c.private_key,"base64")
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  const jwt=`${unsigned}.${sig}`;
  const r=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt})});
  const d=await r.json();
  if(!r.ok||!d.access_token)throw new Error(d?.error_description||"Could not obtain Google access token.");
  cachedToken=d.access_token;
  cachedTokenExpiry=Date.now()+(Number(d.expires_in||3600)*1000);
  return cachedToken;
}

async function googleSynthesize(text,languageCode,speakingRate){
  const apiKey=process.env.GOOGLE_TTS_API_KEY;
  let url=TTS_URL;
  const headers={"Content-Type":"application/json"};
  if(apiKey){
    url += `?key=${encodeURIComponent(apiKey)}`;
  }else{
    headers.Authorization=`Bearer ${await serviceAccountToken()}`;
  }
  const r=await fetch(url,{method:"POST",headers,body:JSON.stringify({
    input:{text},
    voice:{languageCode},
    audioConfig:{audioEncoding:"MP3",speakingRate}
  })});
  const d=await r.json();
  if(!r.ok||!d.audioContent)throw new Error(d?.error?.message||`Google TTS HTTP ${r.status}`);
  return d.audioContent;
}

export async function handler(event){
  const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"};
  if(event.httpMethod==="OPTIONS")return{statusCode:204,headers,body:""};
  if(event.httpMethod!=="POST")return{statusCode:405,headers,body:JSON.stringify({error:"Method not allowed"})};
  try{
    const body=JSON.parse(event.body||"{}");
    const text=String(body.text||"").trim();
    const languageCode=normaliseLanguageCode(body.languageCode||body.language||body.targetLanguage||"en-GB");
    const requested=Number(body.speakingRate);
    const speakingRate=Number.isFinite(requested)?Math.min(1.2,Math.max(.75,requested)):.92;
    if(!text)return{statusCode:400,headers,body:JSON.stringify({error:"No text supplied."})};
    if(text.length>5000)return{statusCode:400,headers,body:JSON.stringify({error:"Text is too long for one audio request."})};
    const audioContent=await googleSynthesize(text,languageCode,speakingRate);
    return{statusCode:200,headers:{...headers,"X-LingoTotal-Language":languageCode},body:JSON.stringify({audioContent,mimeType:"audio/mpeg",languageCode})};
  }catch(error){
    console.error("tts error",error);
    return{statusCode:500,headers,body:JSON.stringify({error:error?.message||"TTS error"})};
  }
};
