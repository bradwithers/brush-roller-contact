export const config = { runtime: 'edge' };
export default async function handler() {
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': 'site_auth=; Path=/; HttpOnly; Max-Age=0; Secure; SameSite=Lax',
      'Location': '/password.html'
    }
  });
}
