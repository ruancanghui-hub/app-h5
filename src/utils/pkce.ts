function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomVerifier(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bufferToBase64Url(bytes.buffer)
}

export async function challengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufferToBase64Url(digest)
}

const VERIFIER_KEY = 'app-h5-pkce-verifier'

export function saveVerifier(verifier: string) {
  sessionStorage.setItem(VERIFIER_KEY, verifier)
}

export function loadVerifier(): string | null {
  return sessionStorage.getItem(VERIFIER_KEY)
}

export function clearVerifier() {
  sessionStorage.removeItem(VERIFIER_KEY)
}
