export const config = { runtime: 'edge' };

// small helper to hash text with SHA-256 (so you can store a hash if you prefer)
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { password } = await req.json().catch(() => ({}));

  // Support either plain password (SITE_PASSWORD) or a precomputed hash (SITE_PASSWORD_HASH)
  const expectedHash = process.env.SITE_PASSWORD_HASH
    || (process.env.SITE_PASSWORD ? await sha256(process.env.SITE_PASSWORD) : null);

  if (!expectedHash) {
    return new Response('Server not configured', { status: 500 });
  }
  if (!password || await sha256(password) !== expectedHash) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Set cookie for ~30 days
  const headers = new Headers();
  headers.append('Set-Cookie', `site_auth=${expectedHash}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  headers.append('Location', '/');
  return new Response(null, { status: 302, headers });
}
