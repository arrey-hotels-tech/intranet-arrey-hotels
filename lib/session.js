import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'arrey_session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.SESSION_JWT_SECRET;
  if (!s) throw new Error('SESSION_JWT_SECRET não configurado.');
  return s;
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

// data ex: { type: 'admin'|'employee', id, role, areaId, name }
export function createSessionToken(data) {
  const payload = { ...data, iat: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() - payload.iat > THIRTY_DAYS_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: THIRTY_DAYS_MS / 1000,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Lê e valida a sessão da requisição atual (server component / server action)
export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
