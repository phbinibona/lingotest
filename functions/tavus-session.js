// Start Tavus only after the visitor presses the Tavus button. Keep the API key server-side.
const DEFAULT_FACE = 'r3f4182ef554'; // Lucas - Studio, Tavus stock face
let cachedPalId;
const reply = (statusCode, body) => ({ statusCode, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'
}, body: JSON.stringify(body) });

async function tavus(path, key, body) {
  const response = await fetch('https://tavusapi.com/v2/' + path, {
    method: 'POST', headers: { 'x-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(18000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Tavus ' + path + ' failed (HTTP ' + response.status + '): ' + String(data.message || data.error || 'check your Tavus account').slice(0, 160));
  return data;
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  const key = process.env.TAVUS_API_KEY;
  if (!key) return reply(503, { error: 'Tavus is not connected yet. Add TAVUS_API_KEY to this Netlify site.' });
  try {
    const palId = process.env.TAVUS_PAL_ID || cachedPalId || (await tavus('pals', key, {
      pal_name: 'LingoChatAvatar teacher', pipeline_mode: 'echo',
      default_face_id: process.env.TAVUS_FACE_ID || DEFAULT_FACE
    })).pal_id;
    if (!palId) throw new Error('Tavus did not return a PAL ID.');
    cachedPalId = palId;
    const session = await tavus('conversations', key, {
      pal_id: palId, conversation_name: 'LingoChatAvatar teacher',
      properties: { max_call_duration: 120, participant_left_timeout: 20 }
    });
    if (!session.conversation_url || !session.conversation_id ||
        !/^https:\/\/[a-z0-9.-]*daily\.co\//i.test(session.conversation_url))
      throw new Error('Tavus returned an invalid conversation URL.');
    return reply(200, { conversationUrl: session.conversation_url,
      conversationId: session.conversation_id });
  } catch (error) {
    console.error('Tavus session:', error.message);
    return reply(502, { error: error.message });
  }
};
