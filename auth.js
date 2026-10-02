// Single-owner PIN login. Works in middleware (edge) and server actions.
const enc = new TextEncoder();

async function hmac(msg) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(process.env.SESSION_SECRET || 'dev-secret'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeToken(days = 30) {
  const exp = String(Date.now() + days * 864e5);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyToken(token) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return (await hmac(exp)) === sig;
}
