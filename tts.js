
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
  const key = raw.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return LANGUAGE_LOCALES[key] || raw;
}

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const API_KEY = process.env.GOOGLE_TTS_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "GOOGLE_TTS_API_KEY is not configured in Netlify."
        })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const text = String(body.text || "").trim();
    const languageCode = normaliseLanguageCode(body.languageCode || body.language || body.targetLanguage || "en-GB");

    if (!text) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No text supplied." })
      };
    }

    // Keep requests modest and predictable.
    if (text.length > 5000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Text is too long for this audio request." })
      };
    }

    const allowedLanguages = new Set([
      "en-GB",
      "ca-ES",
      "es-ES",
      "fr-FR",
      "de-DE",
      "it-IT",
      "pt-PT",
      "eu-ES",
      "ja-JP",
      "ar-SA"
    ]);

    if (!allowedLanguages.has(languageCode)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Unsupported language code." })
      };
    }

    const requestedRate = Number(body.speakingRate);
    const speakingRate = Number.isFinite(requestedRate)
      ? Math.min(1.0, Math.max(0.9, requestedRate))
      : 0.9;

    const googleResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate
          }
        })
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      const googleMessage =
        data?.error?.message ||
        `Google TTS returned HTTP ${googleResponse.status}`;

      console.error("Google TTS error:", data);

      return {
        statusCode: googleResponse.status,
        headers,
        body: JSON.stringify({ error: googleMessage })
      };
    }

    if (!data?.audioContent) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Google TTS returned no audio." })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        audioContent: data.audioContent,
        mimeType: "audio/mpeg"
      })
    };

  } catch (error) {
    console.error("TTS function error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Unexpected TTS server error."
      })
    };
  }
}
