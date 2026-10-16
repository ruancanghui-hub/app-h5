const MOBILE_RE = /^1[3-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidContact(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  return MOBILE_RE.test(v) || EMAIL_RE.test(v)
}

export function countTextLength(value: string): number {
  return [...value.trim()].length
}
