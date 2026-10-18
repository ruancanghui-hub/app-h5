import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEYLEN = 64

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('base64url')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = parts[1] ?? ''
  const expected = parts[2] ?? ''
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN).toString('base64url')
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** PKCE S256: base64url(sha256(verifier)) */
export function pkceChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function defaultDisplayName(email: string): string {
  const local = email.split('@')[0] || 'user'
  return local.slice(0, 32)
}
