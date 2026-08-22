import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cachedToken = "";
let tokenExpiresAt = 0;

/* ---------------------------------------------------------
   Helper: convert values to Base64 URL format
--------------------------------------------------------- */
function base64url(value) {
  const buffer =
    typeof value === "string"
      ? Buffer.from(value, "utf8")
      : Buffer.from(value);

  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/* ---------------------------------------------------------
   Read Google service account credentials from Netlify
--------------------------------------------------------- */
function getCredentials() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;

  if (!raw) {
    throw new Error(
      "GOOGLE_TTS_CREDENTIALS environment variable is missing."
    );
  }

  let credentials;

  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error(
      "GOOGLE_TTS_CREDENTIALS is not valid JSON."
    );
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      "Google credentials are missing client_email or private_key."
    );
  }

  return credentials;
}

/* ---------------------------------------------------------
   Create signed JWT for Google OAuth
--------------------------------------------------------- */
function createJWT(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken =
    `${base64url(JSON.stringify(header))}.` +
    `${base64url(JSON.stringify(payload))}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(
    credentials.private_key.replace(/\\n/g, "\n")
  );

  return `${unsignedToken}.${base64url(signature)}`;
}

/* ---------------------------------------------------------
   Get Google OAuth access token
--------------------------------------------------------- */
async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const credentials = getCredentials();
  const assertion = createJWT(credentials);

  const response = await fetch(TOKEN_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },

    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Google OAuth error:", data);

    throw new Error(
      data?.error_description ||
        data?.error ||
        "Unable to obtain Google access token."
    );
  }

  cachedToken = data.access_token;

  tokenExpiresAt =
    Date.now() + (data.expires_in || 3600) * 1000;

  return cachedToken;
}

/* ---------------------------------------------------------
   Language configuration

   We deliberately use native Google voices for each
   language instead of letting the browser choose a voice.
--------------------------------------------------------- */

const LANGUAGE_CONFIG = {
  en: {
    languageCode: "en-GB",
    voiceName: "en-GB-Neural2-B",
  },

  ca: {
    languageCode: "ca-ES",
  },

  es: {
    languageCode: "es-ES",
    voiceName: "es-ES-Neural2-B",
  },

  fr: {
    languageCode: "fr-FR",
    voiceName: "fr-FR-Neural2-B",
  },

  de: {
    languageCode: "de-DE",
    voiceName: "de-DE-Neural2-B",
  },

  it: {
    languageCode: "it-IT",
    voiceName: "it-IT-Neural2-C",
  },

  pt: {
    languageCode: "pt-PT",
  },

  sv: {
    languageCode: "sv-SE",
  },

  eu: {
    languageCode: "eu-ES",
  },

  cy: {
    languageCode: "cy-GB",
  },

  gd: {
    languageCode: "en-GB",
  },

  ja: {
    languageCode: "ja-JP",
    voiceName: "ja-JP-Neural2-B",
  },

  ar: {
    languageCode: "ar-XA",
    voiceName: "ar-XA-Wavenet-B",
  },
};

/* ---------------------------------------------------------
   Find suitable language configuration
--------------------------------------------------------- */
function getLanguageConfig(language) {
  if (!language) {
    return LANGUAGE_CONFIG.en;
  }

  const normalized = String(language)
    .trim()
    .toLowerCase()
    .replace("_", "-");

  const shortCode = normalized.split("-")[0];

  if (LANGUAGE_CONFIG[normalized]) {
    return LANGUAGE_CONFIG[normalized];
  }

  if (LANGUAGE_CONFIG[shortCode]) {
    return LANGUAGE_CONFIG[shortCode];
  }

  return {
    languageCode: normalized,
  };
}

/* ---------------------------------------------------------
   Netlify function
--------------------------------------------------------- */
export async function handler(event) {
  /* ---------- CORS ---------- */

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Method not allowed. Use POST.",
      }),
    };
  }

  try {
    /* ---------- Parse request ---------- */

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Invalid JSON request.",
        }),
      };
    }

    const text = String(body.text || "").trim();
    const language =
      body.language ||
      body.lang ||
      body.targetLanguage ||
      "en";

    let speakingRate = Number(body.speakingRate ?? 1);

    /* ---------- Validate ---------- */

    if (!text) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "No text supplied.",
        }),
      };
    }

    /*
      Protect the function from accidentally receiving
      extremely long prompts.
    */
    if (text.length > 5000) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Text is too long for one audio request.",
        }),
      };
    }

    /*
      Google accepts a much wider range, but keeping
      LingoTotal roughly between 0.8 and 1.1 gives
      natural learner-friendly speech.
    */
    if (!Number.isFinite(speakingRate)) {
      speakingRate = 1;
    }

    speakingRate = Math.max(
      0.8,
      Math.min(1.1, speakingRate)
    );

    const config = getLanguageConfig(language);

    /* ---------- Obtain access token ---------- */

    const accessToken = await getAccessToken();

    /* ---------- Build Google TTS request ---------- */

    const voice = {
      languageCode: config.languageCode,
    };

    if (config.voiceName) {
      voice.name = config.voiceName;
    }

    const requestBody = {
      input: {
        text,
      },

      voice,

      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
      },
    };

    /* ---------- Call Google ---------- */

    const response = await fetch(TTS_URL, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Google Text-to-Speech error:",
        JSON.stringify(data)
      );

      return {
        statusCode: response.status || 500,

        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          error:
            data?.error?.message ||
            "Google Text-to-Speech request failed.",
        }),
      };
    }

    if (!data.audioContent) {
      throw new Error(
        "Google returned no audioContent."
      );
    }

    /* ---------- Return MP3 ---------- */

    return {
      statusCode: 200,

      isBase64Encoded: true,

      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },

      body: data.audioContent,
    };
  } catch (error) {
    console.error("google-tts function error:", error);

    return {
      statusCode: 500,

      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        error:
          error?.message ||
          "Text-to-speech generation failed.",
      }),
    };
  }
}