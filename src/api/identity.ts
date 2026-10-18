import { request } from './http'

const BASE = '/identity'

export interface RegisterResult {
  loginTicket: string
  identityId: string
  emailVerifyToken?: string
  emailVerified: boolean
}

export interface LoginResult {
  loginTicket: string
  identityId: string
  emailVerified: boolean
}

export interface ConsentResult {
  code: string
  clientName: string
}

export interface TokenResult {
  accessToken: string
  refreshToken: string
  identityId: string
  expiresAt: string
  tokenType: 'Bearer'
  emailVerified: boolean
  displayName: string
  email: string
  avatarUrl?: string
}

export interface ClientPublic {
  clientId: string
  name: string
  scopes: string[]
}

export function fetchClient(clientId: string) {
  return request<ClientPublic>(`${BASE}/v1/clients/${encodeURIComponent(clientId)}`)
}

export function registerAccount(body: {
  email: string
  password: string
  displayName?: string
}) {
  return request<RegisterResult>(`${BASE}/v1/register`, { method: 'POST', json: body })
}

export function loginAccount(body: { email: string; password: string }) {
  return request<LoginResult>(`${BASE}/v1/login`, { method: 'POST', json: body })
}

export function consentAuthorize(body: {
  loginTicket: string
  clientId: string
  codeChallenge: string
  redirectUri?: string
}) {
  return request<ConsentResult>(`${BASE}/v1/consent`, { method: 'POST', json: body })
}

export function exchangeAuthCode(body: {
  grantType: 'authorization_code'
  clientId: string
  code: string
  codeVerifier: string
}) {
  return request<TokenResult>(`${BASE}/v1/token`, { method: 'POST', json: body })
}

export function forgotPassword(email: string) {
  return request<{ ok: true; resetToken?: string }>(`${BASE}/v1/password/forgot`, {
    method: 'POST',
    json: { email },
  })
}

export function resetPassword(body: { token: string; newPassword: string }) {
  return request<{ ok: true }>(`${BASE}/v1/password/reset`, { method: 'POST', json: body })
}
