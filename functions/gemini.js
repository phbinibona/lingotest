exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "GEMINI_API_KEY is not configured in Netlify."
      })
    };
  }

  let input;

  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Invalid JSON request."
      })
    };
  }

  const prompt =
    typeof input.prompt === "string"
      ? input.prompt.trim()
      : "";

  const requestedModel =
    typeof input.model === "string" && input.model.trim()
      ? input.model.trim()
      : "gemini-2.5-flash";

  const temperature =
    Number.isFinite(Number(input.temperature))
      ? Math.min(2, Math.max(0, Number(input.temperature)))
      : 0.7;

  if (!prompt) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "No prompt was supplied."
      })
    };
  }

  if (prompt.length > 15000) {
    return {
      statusCode: 413,
      headers,
      body: JSON.stringify({
        error: "Prompt is too long."
      })
    };
  }

  const allowedModels = new Set([
    "gemini-2.5-flash"
  ]);

  const model = allowedModels.has(requestedModel)
    ? requestedModel
    : "gemini-2.5-flash";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 4096
        }
      })
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Gemini returned an invalid server response."
        })
      };
    }

    if (!response.ok) {
      const providerMessage =
        data?.error?.message ||
        `Gemini request failed with status ${response.status}.`;

      console.error(
        "Gemini API error:",
        response.status,
        providerMessage
      );

      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: providerMessage
        })
      };
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Gemini returned an empty response."
        })
      };
    }

    /*
      IMPORTANT:
      The existing LingoTotal test pages expect the original
      Gemini response structure, including candidates/content/parts.
      Therefore we return the complete Gemini response unchanged.
    */

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error("Gemini function error:", error);

    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error:
          error?.message ||
          "Unable to connect to Gemini."
      })
    };
  }
};
