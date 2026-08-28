const crypto = require("node:crypto");

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
  arabic:"ar-XA", ar:"ar-XA", "ar-xa":"ar-XA", "ar-sa":"ar-XA"
};

function normaliseLanguageCode(value){
  const raw = String(value || "").trim();
  if(!raw) return "en-GB";
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return LANGUAGE_LOCALES[key] || raw;
}

function b64url(value){
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g,"-")
    .replace(/\//g,"_")
    .replace(/=+$/g,"");
}

async function serviceAccountToken(){
  if(cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;

  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if(!raw) throw new Error("No Google TTS credentials configured.");

  const credentials = JSON.parse(raw);
  if(!credentials.client_email || !credentials.private_key){
    throw new Error("GOOGLE_TTS_CREDENTIALS is incomplete.");
  }

  const now = Math.floor(Date.now()/1000);
  const header = b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claim = b64url(JSON.stringify({
    iss: credentials.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));

  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256")
    .update(unsigned)
    .end()
    .sign(credentials.private_key,"base64")
    .replace(/\+/g,"-")
    .replace(/\//g,"_")
    .replace(/=+$/g,"");

  const jwt = `${unsigned}.${signature}`;

  const response = await fetch(TOKEN_URL,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      grant_type:"urn:ietf:params:oauth2:grant-type:jwt-bearer",
      assertion:jwt
    })
  });

  const data = await response.json();
  if(!response.ok || !data.access_token){
    throw new Error(data?.error_description || "Could not obtain Google access token.");
  }

  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function synthesize(text, languageCode, speakingRate){
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  let url = TTS_URL;
  const headers = {"Content-Type":"application/json"};

  if(apiKey){
    url += `?key=${encodeURIComponent(apiKey)}`;
  } else {
    headers.Authorization = `Bearer ${await serviceAccountToken()}`;
  }

  const response = await fetch(url,{
    method:"POST",
    headers,
    body:JSON.stringify({
      input:{text},
      voice:{languageCode},
      audioConfig:{
        audioEncoding:"MP3",
        speakingRate
      }
    })
  });

  const data = await response.json();

  if(!response.ok || !data.audioContent){
    throw new Error(data?.error?.message || `Google TTS HTTP ${response.status}`);
  }

  return data.audioContent;
}


exports.handler = async function(event){
  const headers = {
    "Content-Type":"application/json",
    "Cache-Control":"no-store",
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Allow-Methods":"POST, OPTIONS"
  };

  if(event.httpMethod === "OPTIONS"){
    return {statusCode:204, headers, body:""};
  }

  if(event.httpMethod !== "POST"){
    return {statusCode:405, headers, body:JSON.stringify({error:"Method not allowed"})};
  }

  try{
    const body = JSON.parse(event.body || "{}");
    const text = String(body.text || "").trim();
    const languageCode = normaliseLanguageCode(
      body.languageCode || body.language || body.targetLanguage || "en-GB"
    );

    const requestedRate = Number(body.speakingRate);
    const speakingRate = Number.isFinite(requestedRate)
      ? Math.min(1.2, Math.max(0.75, requestedRate))
      : 0.92;

    if(!text){
      return {statusCode:400, headers, body:JSON.stringify({error:"No text supplied."})};
    }

    const audioContent = await synthesize(text,languageCode,speakingRate);

    return {
      statusCode:200,
      headers:{
        ...headers,
        "X-LingoTotal-Language":languageCode
      },
      body:JSON.stringify({
        audioContent,
        mimeType:"audio/mpeg",
        languageCode
      })
    };

  }catch(error){
    console.error("tts error:",error);
    return {
      statusCode:500,
      headers,
      body:JSON.stringify({error:error?.message || "TTS error"})
    };
  }
};
