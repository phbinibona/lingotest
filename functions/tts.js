const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const ALLOWED_LOCALES = new Set([
  'en-GB',
  'ca-ES',
  'es-ES',
  'fr-FR',
  'de-DE',
  'it-IT',
  'pt-PT',
  'ar-SA',
  'ja-JP','el-GR',
  'eu-ES'
]);

let cachedToken = '';
let cachedTokenExpiry = 0;
const maleVoices = new Map();

async function getMaleVoice(locale, accessToken) {
  if (!maleVoices.has(locale)) {
    const lookup = (async () => {
      const endpoint = 'https://texttospeech.googleapis.com/v1/voices?languageCode=' + encodeURIComponent(locale);
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error('Unable to check available male voices');
      const data = await response.json();
      const matches = (data.voices || []).filter(voice =>
        voice.ssmlGender === 'MALE' && voice.languageCodes?.includes(locale));
      const priority = voice => /-Standard-/.test(voice.name) ? 0 :
        /-Wavenet-/.test(voice.name) ? 1 : /-Neural2-/.test(voice.name) ? 2 : 3;
      matches.sort((a, b) => priority(a) - priority(b));
      if (!matches.length) throw new Error('No male voice is available for ' + locale);
      return matches[0].name;
    })().catch(error => { maleVoices.delete(locale); throw error; });
    maleVoices.set(locale, lookup);
  }
  return maleVoices.get(locale);
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8'
};

function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}

function base64url(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(value);

  return input.toString('base64url');
}

function readCredentials() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;

  if (!raw) {
    throw new Error(
      'GOOGLE_TTS_CREDENTIALS is not configured'
    );
  }

  let credentials;

  try {
    credentials = JSON.parse(raw);

    if (typeof credentials === 'string') {
      credentials = JSON.parse(credentials);
    }
  } catch {
    throw new Error(
      'GOOGLE_TTS_CREDENTIALS is not valid JSON'
    );
  }

  if (
    credentials.type !== 'service_account' ||
    !credentials.client_email ||
    !credentials.private_key
  ) {
    throw new Error(
      'GOOGLE_TTS_CREDENTIALS must contain a complete service-account JSON key'
    );
  }

  credentials.private_key =
    credentials.private_key.replace(/\\n/g, '\n');

  return credentials;
}

async function getAccessToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    cachedToken &&
    Date.now() < cachedTokenExpiry - 60000
  ) {
    return cachedToken;
  }

  const credentials = readCredentials();

  const jwtHeader = base64url(
    JSON.stringify({
      alg: 'RS256',
      typ: 'JWT'
    })
  );

  const jwtClaims = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600
    })
  );

  const unsignedJwt = `${jwtHeader}.${jwtClaims}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();

  const signature = base64url(
    signer.sign(credentials.private_key)
  );

  const assertion =
    `${unsignedJwt}.${signature}`;

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',

    headers: {
      'Content-Type':
        'application/x-www-form-urlencoded'
    },

    body: new URLSearchParams({
      grant_type:
        'urn:ietf:params:oauth:grant-type:jwt-bearer',

      assertion
    })
  });

  const tokenData = await tokenResponse.json();

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    throw new Error(
      tokenData.error_description ||
      tokenData.error ||
      'Google authentication failed'
    );
  }

  cachedToken = tokenData.access_token;

  cachedTokenExpiry =
    Date.now() +
    Number(tokenData.expires_in || 3600) * 1000;

  return cachedToken;
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return response(405, {
      error: 'Method not allowed'
    });
  }

  try {
    const request =
      JSON.parse(event.body || '{}');

    const text =
      String(request.text || '').trim();

    const requestedLocale = String(
      request.languageCode ||
      request.locale ||
      request.lang ||
      'en-GB'
    );

    const locale =
      ALLOWED_LOCALES.has(requestedLocale)
        ? requestedLocale
        : 'en-GB';
    const maleRequested = request.voiceGender === 'MALE';
    const femaleRequested = request.voiceGender === 'FEMALE';
    if (maleRequested && !ALLOWED_LOCALES.has(requestedLocale)) {
      return response(422, { error: 'No verified male voice is available for this language.' });
    }

    if (!text) {
      return response(400, {
        error: 'Text is required'
      });
    }

    if (text.length > 5000) {
      return response(400, {
        error: 'Text is too long'
      });
    }

    const accessToken =
      await getAccessToken();
    let voiceName;
    if (maleRequested) {
      try { voiceName = await getMaleVoice(locale, accessToken); }
      catch (error) { return response(422, { error: error.message }); }
    }

    const googleResponse =
      await fetch(TTS_URL, {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          'Content-Type':
            'application/json; charset=utf-8'
        },

        body: JSON.stringify({
          input: {
            text
          },

          voice: {
            languageCode: locale,
            ...(voiceName ? { name: voiceName, ssmlGender: 'MALE' } : {}),
            ...(femaleRequested ? { ssmlGender: 'FEMALE' } : {})
          },

          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.92,
            pitch: 0
          }
        })
      });

    const audio =
      await googleResponse.json();

    if (
      !googleResponse.ok ||
      !audio.audioContent
    ) {
      throw new Error(
        audio?.error?.message ||
        'Google Text-to-Speech returned no audio'
      );
    }

    return response(200, {
      audioContent: audio.audioContent,
      mimeType: 'audio/mpeg',
      provider:
        'google-cloud-text-to-speech'
    });
  } catch (error) {
    console.error(
      'TTS function error:',
      error.message
    );

    return response(500, {
      error: error.message
    });
  }
};

