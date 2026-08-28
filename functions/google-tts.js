const API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

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

function normaliseLanguageCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "en-GB";
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return LANGUAGE_LOCALES[key] || raw;
}

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const API_KEY = process.env.GOOGLE_TTS_API_KEY;
    if (!API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({error:"GOOGLE_TTS_API_KEY is not configured."}) };
    }

    const body = JSON.parse(event.body || "{}");
    const text = String(body.text || "").trim();
    const languageCode = normaliseLanguageCode(
      body.languageCode || body.language || body.targetLanguage || "en-GB"
    );
    const requestedRate = Number(body.speakingRate);
    const speakingRate = Number.isFinite(requestedRate)
      ? Math.min(1.2, Math.max(0.75, requestedRate))
      : 0.92;

    if (!text) return { statusCode: 400, headers, body: JSON.stringify({error:"No text supplied."}) };
    if (text.length > 5000) return { statusCode: 400, headers, body: JSON.stringify({error:"Text is too long for one audio request."}) };

    const response = await fetch(`${API_URL}?key=${encodeURIComponent(API_KEY)}`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        input: {text},
        voice: {languageCode},
        audioConfig: {audioEncoding:"MP3", speakingRate}
      })
    });

    const data = await response.json();
    if (!response.ok || !data.audioContent) {
      return {
        statusCode: response.status || 502,
        headers,
        body: JSON.stringify({error:data?.error?.message || "Google TTS returned no audio."})
      };
    }

    return {
      statusCode: 200,
      headers: {...headers, "Content-Type":"audio/mpeg"},
      isBase64Encoded: true,
      body: data.audioContent
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({error:error?.message || "Unexpected TTS server error."})
    };
  }
};
