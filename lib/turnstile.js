const TEST_SECRET = '1x0000000000000000000000000000000AA';

export async function verifyTurnstile(token) {
  if (!token) return false;
  const secret = process.env.NODE_ENV === 'production' ? process.env.TURNSTILE_SECRET_KEY : TEST_SECRET;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();
    return result.success === true && (process.env.NODE_ENV !== 'production' || result.hostname === 'intranet-arrey-hotels.vercel.app');
  } catch (error) {
    console.error('[Turnstile] Falha na validação:', { name: error?.name, message: error?.message });
    return false;
  }
}
