// LiveAvatar session credentials are issued server-side. Never expose LINGOTOTAL to the page.
// LiveAvatar currently restricts free sandbox sessions to this test presenter.
// Bryan's chat-page ID is retained separately until paid-mode testing is authorized.
const AVATAR_ID = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a';
const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
 if(!require('./lib/julien-auth').authorized(event))return require('./lib/julien-auth').denied();
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  const keySource = process.env.LIVEAVATAR_API_KEY ? 'LIVEAVATAR_API_KEY' : 'LINGOTOTAL';
  const key = process.env.LIVEAVATAR_API_KEY || process.env.LINGOTOTAL;
  if (!key) return reply(503, { error: 'LiveAvatar key is not configured' });
  try {
    const request = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_id: AVATAR_ID, mode: 'LITE', is_sandbox: true }),
      signal: AbortSignal.timeout(12000)
    });
    const result = await request.json();
    if (!request.ok || !result.data?.session_token) {
      console.error('LiveAvatar token failure', request.status, result.code, result.message);
      return reply(502, { error: request.status === 401
        ? 'LiveAvatar rejected the API key. Check the LIVEAVATAR_API_KEY value in Netlify.'
        : 'LiveAvatar could not create a sandbox session',
        upstreamStatus: request.status, upstreamCode: Number(result.code) || null,
        keySource });
    }
    const started = await fetch('https://api.liveavatar.com/v1/sessions/start', {
      method: 'POST', headers: { Authorization: `Bearer ${result.data.session_token}` },
      signal: AbortSignal.timeout(20000)
    });
    const session = await started.json();
    const data = session.data;
    if (!started.ok || !data?.ws_url || !data?.livekit_url || !data?.livekit_client_token) {
      return reply(502, { error: 'LiveAvatar could not start the sandbox video' });
    }
    return reply(200, { wsUrl: data.ws_url, livekitUrl: data.livekit_url,
      livekitToken: data.livekit_client_token, sessionId: data.session_id });
  } catch (error) {
    console.error('LiveAvatar session setup failed:', error.message);
    return reply(502, { error: 'LiveAvatar is temporarily unavailable' });
  }
};
