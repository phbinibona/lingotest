const crypto = require('crypto');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  },
  body: JSON.stringify(body)
});

function secureMatch(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function configuredCodes() {
  return String(process.env.EVALUATION_CODES || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const separator = entry.indexOf('=');
      const code = (
        separator >= 0 ? entry.slice(0, separator) : entry
      ).trim();

      const group = (
        separator >= 0 ? entry.slice(separator + 1) : entry
      ).trim();

      return {
        code: code.toUpperCase(),
        group: group || 'evaluation'
      };
    })
    .filter(entry => entry.code);
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') {
    return json(405, {
      valid: false,
      message: 'Method not allowed.'
    });
  }

  let submitted;

  try {
    submitted = JSON.parse(event.body || '{}').code;
  } catch {
    return json(400, {
      valid: false,
      message: 'Invalid request.'
    });
  }

  const candidate = String(submitted || '')
    .trim()
    .toUpperCase()
    .slice(0, 100);

  if (!candidate) {
    return json(400, { valid: false });
  }

  const match = configuredCodes().find(entry =>
    secureMatch(candidate, entry.code)
  );

  if (!match) {
    return json(401, { valid: false });
  }

  return json(200, {
    valid: true,
    group: match.group
  });
};