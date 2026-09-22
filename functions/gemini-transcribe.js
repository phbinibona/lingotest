const MAX_AUDIO_BYTES = 1_600_000;
const ALLOWED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm"
]);

function requestId() {
  return `lt-stt-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function cleanTranscript(text) {
  let clean = String(text || "")
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("“") && clean.endsWith("”"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}

exports.handler = async function (event) {
  const id = requestId();
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-LingoTotal-Request-Id": id
  };
  const reply = (statusCode, body) => ({
    statusCode,
    headers,
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed", requestId: id });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return reply(500, {
      error: "GEMINI_API_KEY is not configured in Netlify.",
      requestId: id
    });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Invalid JSON request.", requestId: id });
  }

  const audioBase64 = String(input.audioBase64 || "")
    .replace(/^data:audio\/[^;]+;base64,/, "")
    .trim();
  const mimeType = String(input.mimeType || "audio/wav").toLowerCase();
  const language = String(input.language || "the target language")
    .replace(/[\r\n<>]/g, " ")
    .slice(0, 80);
  const locale = String(input.locale || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);

  if (!audioBase64 || !/^[A-Za-z0-9+/=]+$/.test(audioBase64)) {
    return reply(400, { error: "No valid audio was supplied.", requestId: id });
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return reply(415, { error: "Unsupported audio format.", requestId: id });
  }

  const estimatedBytes = Math.floor(audioBase64.length * 0.75);
  if (estimatedBytes > MAX_AUDIO_BYTES) {
    return reply(413, { error: "The recording is too long.", requestId: id });
  }

  const prompt =
    `Transcribe the learner's speech verbatim in ${language}` +
    (locale ? ` (${locale})` : "") +
    ". Return only the words that were actually spoken. " +
    "Do not translate, explain, correct grammar, improve pronunciation, or infer a model sentence. " +
    "Preserve meaningful word errors and omissions. Add ordinary punctuation only when clear. " +
    "If there is no intelligible speech, return exactly [NO_SPEECH].";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 300
        }
      })
    });
    clearTimeout(timeout);

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return reply(502, { error: "Gemini returned an invalid response.", requestId: id });
    }

    if (!response.ok) {
      return reply(response.status, {
        error: data?.error?.message || "Gemini transcription failed.",
        requestId: id
      });
    }

    const transcript = cleanTranscript(extractText(data));
    if (!transcript || transcript === "[NO_SPEECH]") {
      return reply(422, { error: "No intelligible speech was detected.", requestId: id });
    }

    return reply(200, { transcript, requestId: id, model: "gemini-2.5-flash" });
  } catch (error) {
    clearTimeout(timeout);
    return reply(error?.name === "AbortError" ? 504 : 502, {
      error:
        error?.name === "AbortError"
          ? "Gemini transcription timed out."
          : "Unable to connect to Gemini for transcription.",
      requestId: id
    });
  }
};
