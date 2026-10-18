import { randomUUID } from 'node:crypto'
import { audiencesFor, getClient, isRedirectAllowed } from './clients'
import {
  defaultDisplayName,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  pkceChallengeS256,
  randomToken,
  verifyPassword,
} from './crypto'
import { verifyRs256Jwt } from './jwt'
import { mailConfigured, publicOrigin, sendMail } from './mail'
import { readStore, writeStore } from './store'
import type {
  IdentityRecord,
  SessionRecord,
  SocialLinkRecord,
  SocialProvider,
  TokenResponse,
} from './types'

const ACCESS_TTL_MS = 60 * 60 * 1000
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000
const TICKET_TTL_MS = 10 * 60 * 1000
const CODE_TTL_MS = 5 * 60 * 1000
const RESET_TTL_MS = 30 * 60 * 1000
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_SCOPES = ['identity_id', 'email', 'display_name', 'avatar']

export class IdentityError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'IdentityError'
    this.status = status
  }
}

function nowIso() {
  return new Date().toISOString()
}

function plusMs(ms: number) {
  return new Date(Date.now() + ms).toISOString()
}

function purgeExpired(data: ReturnType<typeof readStore>) {
  const now = Date.now()
  data.loginTickets = data.loginTickets.filter((t) => Date.parse(t.expiresAt) > now)
  data.authCodes = data.authCodes.filter((c) => Date.parse(c.expiresAt) > now)
  data.passwordResets = data.passwordResets.filter((r) => Date.parse(r.expiresAt) > now)
  data.emailVerifies = data.emailVerifies.filter((v) => Date.parse(v.expiresAt) > now)
}

function findIdentityByEmail(data: ReturnType<typeof readStore>, email: string) {
  const n = normalizeEmail(email)
  return data.identities.find((i) => i.email === n) ?? null
}

function toTokenResponse(
  session: SessionRecord,
  identity: IdentityRecord,
): TokenResponse {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    identityId: identity.id,
    expiresAt: session.accessExpiresAt,
    tokenType: 'Bearer',
    emailVerified: identity.emailVerified,
    displayName: identity.displayName,
    email: identity.email,
    avatarUrl: identity.avatarUrl,
  }
}

function issueSession(
  data: ReturnType<typeof readStore>,
  identityId: string,
  clientId: string,
  scopes: string[],
): SessionRecord {
  const session: SessionRecord = {
    accessToken: `at_${randomToken(24)}`,
    refreshToken: `rt_${randomToken(32)}`,
    identityId,
    clientId,
    scopes,
    accessExpiresAt: plusMs(ACCESS_TTL_MS),
    refreshExpiresAt: plusMs(REFRESH_TTL_MS),
    revoked: false,
  }
  data.sessions.push(session)
  return session
}

function issueLoginTicket(data: ReturnType<typeof readStore>, identityId: string) {
  const ticket = {
    id: `lt_${randomToken(16)}`,
    identityId,
    expiresAt: plusMs(TICKET_TTL_MS),
  }
  data.loginTickets.push(ticket)
  return ticket
}

function issueEmailVerify(data: ReturnType<typeof readStore>, identityId: string) {
  const record = {
    token: `ev_${randomToken(20)}`,
    identityId,
    expiresAt: plusMs(VERIFY_TTL_MS),
  }
  data.emailVerifies.push(record)
  return record
}

async function deliverVerifyMail(email: string, token: string) {
  const link = `${publicOrigin()}/#/auth/verify?token=${encodeURIComponent(token)}`
  try {
    const result = await sendMail(
      email,
      '验证邮箱',
      `请打开以下链接完成邮箱验证（24 小时内有效）：\n${link}\n`,
    )
    return result.sent
  } catch (err) {
    console.error('[identity] 验证邮件发送失败', err)
    return false
  }
}

async function deliverResetMail(email: string, token: string) {
  const link = `${publicOrigin()}/#/auth/forgot?token=${encodeURIComponent(token)}`
  try {
    const result = await sendMail(
      email,
      '重置密码',
      `请打开以下链接设置新密码（30 分钟内有效）：\n${link}\n`,
    )
    return result.sent
  } catch (err) {
    console.error('[identity] 重置邮件发送失败', err)
    return false
  }
}

export async function registerIdentity(input: {
  email: string
  password: string
  displayName?: string
}): Promise<{
  loginTicket: string
  identityId: string
  emailVerified: boolean
  mailSent: boolean
  emailVerifyToken?: string
}> {
  if (!isValidEmail(input.email)) throw new IdentityError('邮箱格式无效')
  if (input.password.length < 8) throw new IdentityError('密码至少 8 位')

  const data = readStore()
  purgeExpired(data)
  const email = normalizeEmail(input.email)
  if (findIdentityByEmail(data, email)) {
    throw new IdentityError('该邮箱已注册', 409)
  }

  const now = nowIso()
  const identity: IdentityRecord = {
    id: `id_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    email,
    emailVerified: false,
    passwordHash: hashPassword(input.password),
    displayName: (input.displayName || '').trim() || defaultDisplayName(email),
    createdAt: now,
    updatedAt: now,
  }
  data.identities.push(identity)
  const ticket = issueLoginTicket(data, identity.id)
  const verify = issueEmailVerify(data, identity.id)
  writeStore(data)

  const mailSent = await deliverVerifyMail(email, verify.token)
  return {
    loginTicket: ticket.id,
    identityId: identity.id,
    emailVerified: false,
    mailSent,
    ...(mailSent || mailConfigured() ? {} : { emailVerifyToken: verify.token }),
  }
}

export function loginIdentity(input: {
  email: string
  password: string
}): { loginTicket: string; identityId: string; emailVerified: boolean } {
  const data = readStore()
  purgeExpired(data)
  const identity = findIdentityByEmail(data, input.email)
  if (!identity || !verifyPassword(input.password, identity.passwordHash)) {
    throw new IdentityError('邮箱或密码错误', 401)
  }
  const ticket = issueLoginTicket(data, identity.id)
  writeStore(data)
  return {
    loginTicket: ticket.id,
    identityId: identity.id,
    emailVerified: identity.emailVerified,
  }
}

export function consentAndIssueCode(input: {
  loginTicket: string
  clientId: string
  codeChallenge: string
  redirectUri?: string
}): { code: string; clientName: string } {
  if (!input.codeChallenge || input.codeChallenge.length < 16) {
    throw new IdentityError('缺少有效的 code_challenge')
  }
  const client = getClient(input.clientId)
  if (!client) throw new IdentityError('未知的接入应用', 404)
  if (!isRedirectAllowed(client, input.redirectUri)) {
    throw new IdentityError('redirect_uri 未登记')
  }

  const data = readStore()
  purgeExpired(data)
  const ticket = data.loginTickets.find((t) => t.id === input.loginTicket)
  if (!ticket || Date.parse(ticket.expiresAt) <= Date.now()) {
    throw new IdentityError('登录凭证已过期，请重新登录', 401)
  }

  const membership = data.memberships.find(
    (m) => m.identityId === ticket.identityId && m.clientId === input.clientId,
  )
  if (!membership) {
    data.memberships.push({
      identityId: ticket.identityId,
      clientId: input.clientId,
      grantedAt: nowIso(),
      scopes: [...DEFAULT_SCOPES],
    })
  }

  const code = {
    code: `ac_${randomToken(20)}`,
    identityId: ticket.identityId,
    clientId: input.clientId,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: 'S256' as const,
    scopes: [...DEFAULT_SCOPES],
    expiresAt: plusMs(CODE_TTL_MS),
  }
  data.authCodes.push(code)
  data.loginTickets = data.loginTickets.filter((t) => t.id !== ticket.id)
  writeStore(data)

  return { code: code.code, clientName: client.name }
}

export function exchangeToken(input: {
  grantType: string
  clientId: string
  code?: string
  codeVerifier?: string
  refreshToken?: string
}): TokenResponse {
  const client = getClient(input.clientId)
  if (!client) throw new IdentityError('未知的接入应用', 404)

  const data = readStore()
  purgeExpired(data)

  if (input.grantType === 'authorization_code') {
    if (!input.code || !input.codeVerifier) {
      throw new IdentityError('缺少 code 或 code_verifier')
    }
    const idx = data.authCodes.findIndex((c) => c.code === input.code)
    if (idx < 0) throw new IdentityError('授权码无效或已使用', 400)
    const authCode = data.authCodes[idx]!
    if (authCode.clientId !== input.clientId) {
      throw new IdentityError('client_id 与授权码不匹配')
    }
    if (Date.parse(authCode.expiresAt) <= Date.now()) {
      throw new IdentityError('授权码已过期')
    }
    const expected = pkceChallengeS256(input.codeVerifier)
    if (expected !== authCode.codeChallenge) {
      throw new IdentityError('PKCE 校验失败', 401)
    }
    data.authCodes.splice(idx, 1)
    const identity = data.identities.find((i) => i.id === authCode.identityId)
    if (!identity) throw new IdentityError('Identity 不存在', 404)
    const session = issueSession(data, identity.id, input.clientId, authCode.scopes)
    writeStore(data)
    return toTokenResponse(session, identity)
  }

  if (input.grantType === 'refresh_token') {
    if (!input.refreshToken) throw new IdentityError('缺少 refresh_token')
    const session = data.sessions.find(
      (s) => s.refreshToken === input.refreshToken && !s.revoked,
    )
    if (!session || session.clientId !== input.clientId) {
      throw new IdentityError('refresh_token 无效', 401)
    }
    if (Date.parse(session.refreshExpiresAt) <= Date.now()) {
      throw new IdentityError('refresh_token 已过期', 401)
    }
    session.revoked = true
    const identity = data.identities.find((i) => i.id === session.identityId)
    if (!identity) throw new IdentityError('Identity 不存在', 404)
    const next = issueSession(data, identity.id, input.clientId, session.scopes)
    writeStore(data)
    return toTokenResponse(next, identity)
  }

  throw new IdentityError('不支持的 grant_type')
}

export function resolveAccessToken(accessToken: string | undefined): {
  identity: IdentityRecord
  session: SessionRecord
} | null {
  if (!accessToken) return null
  const data = readStore()
  const session = data.sessions.find(
    (s) => s.accessToken === accessToken && !s.revoked,
  )
  if (!session) return null
  if (Date.parse(session.accessExpiresAt) <= Date.now()) return null
  const identity = data.identities.find((i) => i.id === session.identityId)
  if (!identity) return null
  return { identity, session }
}

export function getMe(accessToken: string) {
  const resolved = resolveAccessToken(accessToken)
  if (!resolved) throw new IdentityError('未登录或会话已过期', 401)
  const { identity, session } = resolved
  return {
    identityId: identity.id,
    email: identity.email,
    emailVerified: identity.emailVerified,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
    clientId: session.clientId,
    scopes: session.scopes,
  }
}

export function getClientPublic(clientId: string) {
  const client = getClient(clientId)
  if (!client) throw new IdentityError('未知的接入应用', 404)
  return {
    clientId: client.clientId,
    name: client.name,
    scopes: DEFAULT_SCOPES,
  }
}

export async function requestPasswordReset(email: string): Promise<{
  ok: true
  mailSent?: boolean
  resetToken?: string
}> {
  const data = readStore()
  purgeExpired(data)
  const identity = findIdentityByEmail(data, email)
  if (!identity) return { ok: true }

  const record = {
    token: `pr_${randomToken(20)}`,
    identityId: identity.id,
    expiresAt: plusMs(RESET_TTL_MS),
  }
  data.passwordResets.push(record)
  writeStore(data)

  const mailSent = await deliverResetMail(identity.email, record.token)
  if (!mailSent && !mailConfigured() && process.env.NODE_ENV !== 'production') {
    return { ok: true, mailSent: false, resetToken: record.token }
  }
  return { ok: true, mailSent }
}

export function resetPassword(input: { token: string; newPassword: string }) {
  if (input.newPassword.length < 8) throw new IdentityError('密码至少 8 位')
  const data = readStore()
  purgeExpired(data)
  const idx = data.passwordResets.findIndex((r) => r.token === input.token)
  if (idx < 0) throw new IdentityError('重置凭证无效或已过期')
  const reset = data.passwordResets[idx]!
  if (Date.parse(reset.expiresAt) <= Date.now()) {
    throw new IdentityError('重置凭证无效或已过期')
  }
  const identity = data.identities.find((i) => i.id === reset.identityId)
  if (!identity) throw new IdentityError('Identity 不存在', 404)
  identity.passwordHash = hashPassword(input.newPassword)
  identity.updatedAt = nowIso()
  data.passwordResets.splice(idx, 1)
  // 改密后撤销该 Identity 全部会话
  for (const s of data.sessions) {
    if (s.identityId === identity.id) s.revoked = true
  }
  writeStore(data)
  return { ok: true as const }
}

export function verifyEmail(token: string) {
  const data = readStore()
  purgeExpired(data)
  const idx = data.emailVerifies.findIndex((v) => v.token === token)
  if (idx < 0) throw new IdentityError('验证凭证无效或已过期')
  const record = data.emailVerifies[idx]!
  if (Date.parse(record.expiresAt) <= Date.now()) {
    throw new IdentityError('验证凭证无效或已过期')
  }
  const identity = data.identities.find((i) => i.id === record.identityId)
  if (!identity) throw new IdentityError('Identity 不存在', 404)
  identity.emailVerified = true
  identity.updatedAt = nowIso()
  data.emailVerifies.splice(idx, 1)
  writeStore(data)
  return { ok: true as const, identityId: identity.id, emailVerified: true }
}

export function revokeSessions(input: {
  accessToken: string
  all?: boolean
}): { ok: true } {
  const resolved = resolveAccessToken(input.accessToken)
  if (!resolved) throw new IdentityError('未登录或会话已过期', 401)
  const data = readStore()
  if (input.all) {
    for (const s of data.sessions) {
      if (s.identityId === resolved.identity.id) s.revoked = true
    }
  } else {
    const session = data.sessions.find((s) => s.accessToken === input.accessToken)
    if (session) session.revoked = true
  }
  writeStore(data)
  return { ok: true }
}

const APPLE_JWKS = 'https://appleid.apple.com/auth/keys'
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs'
const APPLE_ISSUER = 'https://appleid.apple.com'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

function claimString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

function isPrivateAppleEmail(email: string, payload: Record<string, unknown>): boolean {
  const flag = payload.is_private_email
  if (flag === true || flag === 'true') return true
  return email.endsWith('@privaterelay.appleid.com')
}

function providerVerified(payload: Record<string, unknown>): boolean {
  const flag = payload.email_verified
  return flag === true || flag === 'true'
}

async function verifyProviderToken(provider: SocialProvider, idToken: string, audiences: string[]) {
  if (!audiences.length) {
    throw new IdentityError(
      provider === 'apple' ? '未配置 Apple 受众（appleAudiences 或 APPLE_AUDIENCES）' : '未配置 Google 受众（googleAudiences 或 GOOGLE_AUDIENCES）',
      503,
    )
  }
  try {
    if (provider === 'apple') {
      return await verifyRs256Jwt(idToken, APPLE_JWKS, {
        issuers: [APPLE_ISSUER],
        audiences,
      })
    }
    return await verifyRs256Jwt(idToken, GOOGLE_JWKS, {
      issuers: GOOGLE_ISSUERS,
      audiences,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '社交令牌无效'
    throw new IdentityError(message, 401)
  }
}

function createSocialIdentity(
  data: ReturnType<typeof readStore>,
  email: string,
  verified: boolean,
  displayName: string,
  avatarUrl?: string,
): IdentityRecord {
  const now = nowIso()
  const identity: IdentityRecord = {
    id: `id_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    email,
    emailVerified: verified,
    passwordHash: '',
    displayName: displayName || defaultDisplayName(email || 'user'),
    avatarUrl,
    createdAt: now,
    updatedAt: now,
  }
  data.identities.push(identity)
  return identity
}

function linkSocial(
  data: ReturnType<typeof readStore>,
  link: Omit<SocialLinkRecord, 'linkedAt'>,
) {
  data.socialLinks.push({ ...link, linkedAt: nowIso() })
}

export type SocialExchangeResult =
  | (TokenResponse & { needsConsent: false })
  | {
      needsConsent: true
      loginTicket: string
      identityId: string
      emailVerified: boolean
    }

/**
 * 宿主原生 SDK 提交 Apple/Google id_token，验签后换本平台会话。
 * 尚无 AppMembership 时只发 loginTicket，由授权确认页完成加入。
 */
export async function exchangeSocialToken(input: {
  provider: string
  idToken: string
  clientId: string
  bundleId: string
}): Promise<SocialExchangeResult> {
  if (input.provider !== 'apple' && input.provider !== 'google') {
    throw new IdentityError('provider 仅支持 apple 或 google')
  }
  const provider = input.provider
  const client = getClient(input.clientId)
  if (!client) throw new IdentityError('未知的接入应用', 404)
  if (!input.bundleId || !client.bundleIds.includes(input.bundleId)) {
    throw new IdentityError('Bundle ID / 包名未登记', 403)
  }

  const payload = await verifyProviderToken(
    provider,
    input.idToken,
    audiencesFor(client, provider),
  )
  const subject = claimString(payload, 'sub')
  if (!subject) throw new IdentityError('社交令牌缺少 sub', 401)
  const emailRaw = claimString(payload, 'email')
  const email = emailRaw ? normalizeEmail(emailRaw) : ''
  const privateEmail = provider === 'apple' && isPrivateAppleEmail(email, payload)
  const verified = providerVerified(payload) && Boolean(email)
  const name = claimString(payload, 'name') || claimString(payload, 'given_name')
  const picture = claimString(payload, 'picture')

  const data = readStore()
  purgeExpired(data)
  const existingLink = data.socialLinks.find(
    (link) => link.provider === provider && link.subject === subject,
  )

  let identity = existingLink
    ? data.identities.find((item) => item.id === existingLink.identityId) ?? null
    : null

  if (!identity && email && !privateEmail) {
    identity = findIdentityByEmail(data, email)
    if (identity) {
      linkSocial(data, {
        provider,
        subject,
        identityId: identity.id,
        email,
        privateEmail: false,
      })
      if (verified) identity.emailVerified = true
      if (!identity.displayName && name) identity.displayName = name
      if (!identity.avatarUrl && picture) identity.avatarUrl = picture
      identity.updatedAt = nowIso()
    }
  }

  if (!identity) {
    const syntheticEmail = email || `${provider}_${subject.slice(0, 12)}@social.local`
    identity = createSocialIdentity(
      data,
      syntheticEmail,
      verified && !privateEmail,
      name,
      picture || undefined,
    )
    linkSocial(data, {
      provider,
      subject,
      identityId: identity.id,
      email: email || undefined,
      privateEmail,
    })
  }

  const membership = data.memberships.find(
    (item) => item.identityId === identity!.id && item.clientId === input.clientId,
  )
  if (!membership) {
    const ticket = issueLoginTicket(data, identity.id)
    writeStore(data)
    return {
      needsConsent: true,
      loginTicket: ticket.id,
      identityId: identity.id,
      emailVerified: identity.emailVerified,
    }
  }

  const session = issueSession(data, identity.id, input.clientId, [...DEFAULT_SCOPES])
  writeStore(data)
  return { ...toTokenResponse(session, identity), needsConsent: false }
}

/** 已登录 Identity 显式绑定社交 subject（含 Apple 隐藏邮箱） */
export async function bindSocialCredential(input: {
  accessToken: string
  provider: string
  idToken: string
  clientId: string
}): Promise<{ ok: true; identityId: string }> {
  if (input.provider !== 'apple' && input.provider !== 'google') {
    throw new IdentityError('provider 仅支持 apple 或 google')
  }
  const resolved = resolveAccessToken(input.accessToken)
  if (!resolved) throw new IdentityError('未登录或会话已过期', 401)
  const client = getClient(input.clientId || resolved.session.clientId)
  if (!client) throw new IdentityError('未知的接入应用', 404)

  const provider = input.provider
  const payload = await verifyProviderToken(provider, input.idToken, audiencesFor(client, provider))
  const subject = claimString(payload, 'sub')
  if (!subject) throw new IdentityError('社交令牌缺少 sub', 401)
  const emailRaw = claimString(payload, 'email')
  const email = emailRaw ? normalizeEmail(emailRaw) : ''
  const privateEmail = provider === 'apple' && isPrivateAppleEmail(email, payload)

  const data = readStore()
  const taken = data.socialLinks.find(
    (link) => link.provider === provider && link.subject === subject,
  )
  if (taken && taken.identityId !== resolved.identity.id) {
    throw new IdentityError('该社交凭证已绑定到其他 Identity', 409)
  }
  if (!taken) {
    linkSocial(data, {
      provider,
      subject,
      identityId: resolved.identity.id,
      email: email || undefined,
      privateEmail,
    })
  }
  const identity = data.identities.find((item) => item.id === resolved.identity.id)
  if (identity && email && !privateEmail && providerVerified(payload)) {
    const owner = findIdentityByEmail(data, email)
    if (owner && owner.id !== identity.id) {
      throw new IdentityError('该邮箱已属于其他 Identity', 409)
    }
    if (!identity.email || identity.email.endsWith('@social.local')) {
      identity.email = email
    }
    identity.emailVerified = true
    identity.updatedAt = nowIso()
  }
  writeStore(data)
  return { ok: true, identityId: resolved.identity.id }
}
