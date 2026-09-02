import crypto from 'crypto';

export function genLinkToken() {
  return crypto.randomBytes(16).toString('hex');
}

export function genAccessCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function onlyDigits(value) {
  return (value || '').toString().replace(/\D/g, '');
}
