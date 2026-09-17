const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

function envInteger(name, fallback, min, max) {
  return Math.round(clampNumber(process.env[name], fallback, min, max));
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function requestId() {
  return `lt-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
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
    console.error(`[${id}] GEMINI_API_KEY is not configured.`);
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

  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) {
    return reply(400, { error: "No prompt was supplied.", requestId: id });
  }
  if (prompt.length > 15000) {
    return reply(413, { error: "Prompt is too long.", requestId: id });
  }

  const allowedModels = new Set(["gemini-2.5-flash"]);
  const requestedModel =
    typeof input.model === "string" ? input.model.trim() : "";
  const model = allowedModels.has(requestedModel)
    ? requestedModel
    : "gemini-2.5-flash";

  const temperature = clampNumber(input.temperature, 0.7, 0, 2);
  const maxOutputTokens = Math.round(
    clampNumber(input.maxOutputTokens, 8192, 512, 8192)
  );
  const maxAttempts = envInteger("GEMINI_MAX_ATTEMPTS", 3, 1, 3);
  const timeoutMs = envInteger("GEMINI_TIMEOUT_MS", 30000, 10000, 50000);

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let lastStatus = 502;
  let lastMessage = "Unable to connect to Gemini.";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature,
            maxOutputTokens
          }
        })
      });

      clearTimeout(timeout);
      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        lastStatus = 502;
        lastMessage = "Gemini returned an invalid server response.";
        console.warn(`[${id}] Attempt ${attempt}: invalid provider JSON.`);

        if (attempt < maxAttempts) {
          await wait(600 * attempt + Math.floor(Math.random() * 250));
          continue;
        }
        return reply(lastStatus, { error: lastMessage, requestId: id });
      }

      if (!response.ok) {
        lastStatus = response.status;
        lastMessage =
          data?.error?.message ||
          `Gemini request failed with status ${response.status}.`;

        console.warn(
          `[${id}] Attempt ${attempt}: Gemini ${response.status}: ${lastMessage}`
        );

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts) {
          const retryAfterSeconds = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfterSeconds)
            ? Math.min(4000, Math.max(500, retryAfterSeconds * 1000))
            : 700 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
          await wait(delay);
          continue;
        }

        return reply(response.status, {
          error: lastMessage,
          requestId: id,
          attempts: attempt
        });
      }

      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason || "";
      const text = extractText(data);

      if (finishReason === "MAX_TOKENS") {
        lastStatus = 502;
        lastMessage = "Gemini's response was cut short. Please try again.";
        console.warn(`[${id}] Attempt ${attempt}: response reached token limit.`);

        if (attempt < maxAttempts) {
          await wait(500 * attempt);
          continue;
        }
        return reply(lastStatus, {
          error: lastMessage,
          requestId: id,
          attempts: attempt
        });
      }

      if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT"].includes(finishReason)) {
        console.warn(`[${id}] Gemini stopped generation: ${finishReason}.`);
        return reply(422, {
          error: "Gemini could not create content for that request. Try another theme.",
          requestId: id,
          reason: finishReason
        });
      }

      if (!text) {
        lastStatus = 502;
        lastMessage = "Gemini returned an empty response.";
        console.warn(
          `[${id}] Attempt ${attempt}: empty response (${finishReason || "no reason"}).`
        );

        if (attempt < maxAttempts) {
          await wait(600 * attempt + Math.floor(Math.random() * 250));
          continue;
        }
        return reply(lastStatus, {
          error: lastMessage,
          requestId: id,
          attempts: attempt
        });
      }

      /*
        Preserve the complete Gemini response because existing LingoTotal pages
        read candidates/content/parts. Add normalized fields for pages that are
        upgraded later, without breaking the current clients.
      */
      return reply(200, {
        ...data,
        text,
        lingototal: {
          requestId: id,
          attempt,
          model
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      const timedOut = error?.name === "AbortError";
      lastStatus = timedOut ? 504 : 502;
      lastMessage = timedOut
        ? "Gemini took too long to respond."
        : error?.message || "Unable to connect to Gemini.";

      console.warn(`[${id}] Attempt ${attempt}: ${lastMessage}`);

      if (attempt < maxAttempts) {
        await wait(700 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300));
        continue;
      }
    }
  }

  return reply(lastStatus, {
    error: `${lastMessage} Please try again.`,
    requestId: id,
    attempts: maxAttempts
  });
};
