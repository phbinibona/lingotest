const LOCALES = {
  English: "en-GB",
  Catalan: "ca-ES",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Portuguese: "pt-PT",
  Basque: "eu-ES",
  Japanese: "ja-JP",
  Arabic: "ar-SA",
  Welsh: "cy-GB",
  Gaelic: "ga-IE",
  en: "en-GB",
  ca: "ca-ES",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  eu: "eu-ES",
  ja: "ja-JP",
  ar: "ar-SA",
  cy: "cy-GB",
  gd: "ga-IE"
};

function response(statusCode, body, requestId) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-LingoTotal-Request-Id": requestId
    },
    body: JSON.stringify(body)
  };
}

function score(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round(Math.min(100, Math.max(0, number)))
    : null;
}

function assessmentOf(value) {
  return value?.PronunciationAssessment || value?.pronunciationAssessment || {};
}

exports.handler = async function (event) {
  const requestId = `lt-speech-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed." }, requestId);
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = String(process.env.AZURE_SPEECH_REGION || "")
    .trim()
    .toLowerCase();

  if (!key || !region) {
    return response(
      503,
      {
        error: "Speaking assessment is not configured yet.",
        code: "NOT_CONFIGURED"
      },
      requestId
    );
  }

  if (!/^[a-z0-9-]+$/.test(region)) {
    console.error(`[${requestId}] Invalid Azure Speech region.`);
    return response(500, { error: "Invalid speech-service configuration." }, requestId);
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid request." }, requestId);
  }

  const referenceText = String(input.referenceText || "").trim();
  const locale = LOCALES[input.language] || LOCALES[input.locale] || "";
  const audioBase64 = String(input.audioBase64 || "")
    .replace(/^data:audio\/[^;]+;base64,/, "")
    .trim();

  if (!referenceText || referenceText.length > 500) {
    return response(400, { error: "A short reference phrase is required." }, requestId);
  }
  if (!locale) {
    return response(
      400,
      { error: "Speaking assessment is not available for this language." },
      requestId
    );
  }
  if (!audioBase64 || audioBase64.length > 2800000) {
    return response(413, { error: "The recording is missing or too long." }, requestId);
  }

  let audio;
  try {
    audio = Buffer.from(audioBase64, "base64");
  } catch {
    return response(400, { error: "The recording could not be read." }, requestId);
  }

  if (
    audio.length < 48 ||
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return response(400, { error: "The recording is not valid WAV audio." }, requestId);
  }

  const pronunciationConfig = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true
    })
  ).toString("base64");

  const endpoint =
    `https://${region}.stt.speech.microsoft.com/` +
    "speech/recognition/conversation/cognitiveservices/v1" +
    `?language=${encodeURIComponent(locale)}&format=detailed`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const azureResponse = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Pronunciation-Assessment": pronunciationConfig,
        Accept: "application/json"
      },
      body: audio
    });

    clearTimeout(timeout);
    const raw = await azureResponse.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!azureResponse.ok) {
      const detail =
        data?.error?.message ||
        data?.message ||
        data?.DisplayText ||
        `Azure Speech error ${azureResponse.status}`;
      console.warn(`[${requestId}] ${detail}`);
      return response(
        azureResponse.status === 401 || azureResponse.status === 403 ? 503 : 502,
        {
          error:
            azureResponse.status === 401 || azureResponse.status === 403
              ? "Speaking assessment is not configured correctly."
              : "The recording could not be assessed. Please try again."
        },
        requestId
      );
    }

    const recognitionStatus = data?.RecognitionStatus || data?.recognitionStatus;
    if (recognitionStatus && recognitionStatus !== "Success") {
      return response(
        422,
        { error: "No clear speech was detected. Please record the phrase again." },
        requestId
      );
    }

    const best = data?.NBest?.[0] || data?.nBest?.[0] || {};
    const overall = assessmentOf(best);
    const wordResults = Array.isArray(best.Words)
      ? best.Words
      : Array.isArray(best.words)
        ? best.words
        : [];

    const words = wordResults.map(word => {
      const itemAssessment = assessmentOf(word);
      return {
        word: String(word.Word || word.word || "").trim(),
        accuracy: score(
          itemAssessment.AccuracyScore ??
            itemAssessment.accuracyScore ??
            word.AccuracyScore
        ),
        errorType: String(
          itemAssessment.ErrorType ??
            itemAssessment.errorType ??
            word.ErrorType ??
            "None"
        )
      };
    });

    return response(
      200,
      {
        recognizedText: String(
          best.Display || best.DisplayText || data.DisplayText || ""
        ).trim(),
        accuracy: score(overall.AccuracyScore ?? best.AccuracyScore),
        fluency: score(overall.FluencyScore ?? best.FluencyScore),
        completeness: score(overall.CompletenessScore ?? best.CompletenessScore),
        pronunciation: score(overall.PronScore ?? best.PronScore),
        words,
        locale
      },
      requestId
    );
  } catch (error) {
    clearTimeout(timeout);
    console.warn(`[${requestId}] Azure Speech request failed: ${error?.message}`);
    return response(
      error?.name === "AbortError" ? 504 : 502,
      {
        error:
          error?.name === "AbortError"
            ? "Speaking assessment took too long. Please try again."
            : "Speaking assessment is temporarily unavailable."
      },
      requestId
    );
  }
};
