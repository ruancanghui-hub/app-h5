import type { IncomingMessage, ServerResponse } from 'node:http'
import { listClients, upsertClient } from './clients'
import {
  IdentityError,
  bindSocialCredential,
  consentAndIssueCode,
  exchangeSocialToken,
  exchangeToken,
  getClientPublic,
  getMe,
  loginIdentity,
  registerIdentity,
  requestPasswordReset,
  resetPassword,
  revokeSessions,
  verifyEmail,
} from './service'

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      if (Buffer.concat(chunks).length > 1_000_000) {
        reject(new IdentityError('请求体过大', 413))
      }
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw) {
          resolve({} as T)
          return
        }
        resolve(JSON.parse(raw) as T)
      } catch {
        reject(new IdentityError('JSON 无效'))
      }
    })
    req.on('error', reject)
  })
}

function bearer(req: IncomingMessage): string | undefined {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return undefined
  return h.slice(7).trim() || undefined
}

function fail(res: ServerResponse, err: unknown) {
  if (err instanceof IdentityError) {
    sendJson(res, err.status, { message: err.message })
    return
  }
  const message = err instanceof Error ? err.message : '服务异常'
  sendJson(res, 500, { message })
}

/**
 * 处理 /api/identity/* 。命中返回 true；未命中返回 false。
 */
export async function handleIdentityRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = (req.url ?? '').split('?')[0] ?? ''
  const method = req.method ?? 'GET'

  if (!url.startsWith('/api/identity')) return false

  try {
    if (method === 'GET' && url === '/api/identity/health') {
      sendJson(res, 200, { ok: true, service: 'identity' })
      return true
    }

    const clientMatch = url.match(/^\/api\/identity\/v1\/clients\/([^/]+)$/)
    if (method === 'GET' && clientMatch) {
      sendJson(res, 200, getClientPublic(decodeURIComponent(clientMatch[1] ?? '')))
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/register') {
      const body = await readJsonBody<{
        email?: string
        password?: string
        displayName?: string
      }>(req)
      const result = await registerIdentity({
        email: body.email ?? '',
        password: body.password ?? '',
        displayName: body.displayName,
      })
      sendJson(res, 200, result)
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/login') {
      const body = await readJsonBody<{ email?: string; password?: string }>(req)
      sendJson(
        res,
        200,
        loginIdentity({ email: body.email ?? '', password: body.password ?? '' }),
      )
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/consent') {
      const body = await readJsonBody<{
        loginTicket?: string
        clientId?: string
        codeChallenge?: string
        redirectUri?: string
      }>(req)
      sendJson(
        res,
        200,
        consentAndIssueCode({
          loginTicket: body.loginTicket ?? '',
          clientId: body.clientId ?? '',
          codeChallenge: body.codeChallenge ?? '',
          redirectUri: body.redirectUri,
        }),
      )
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/token') {
      const body = await readJsonBody<{
        grantType?: string
        grant_type?: string
        clientId?: string
        client_id?: string
        code?: string
        codeVerifier?: string
        code_verifier?: string
        refreshToken?: string
        refresh_token?: string
      }>(req)
      sendJson(
        res,
        200,
        exchangeToken({
          grantType: body.grantType || body.grant_type || '',
          clientId: body.clientId || body.client_id || '',
          code: body.code,
          codeVerifier: body.codeVerifier || body.code_verifier,
          refreshToken: body.refreshToken || body.refresh_token,
        }),
      )
      return true
    }

    if (method === 'GET' && url === '/api/identity/v1/me') {
      const token = bearer(req)
      if (!token) {
        sendJson(res, 401, { message: '未登录或会话已过期' })
        return true
      }
      sendJson(res, 200, getMe(token))
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/password/forgot') {
      const body = await readJsonBody<{ email?: string }>(req)
      sendJson(res, 200, await requestPasswordReset(body.email ?? ''))
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/password/reset') {
      const body = await readJsonBody<{ token?: string; newPassword?: string }>(req)
      sendJson(
        res,
        200,
        resetPassword({ token: body.token ?? '', newPassword: body.newPassword ?? '' }),
      )
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/email/verify') {
      const body = await readJsonBody<{ token?: string }>(req)
      sendJson(res, 200, verifyEmail(body.token ?? ''))
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/session/revoke') {
      const token = bearer(req)
      if (!token) {
        sendJson(res, 401, { message: '未登录或会话已过期' })
        return true
      }
      const body = await readJsonBody<{ all?: boolean }>(req)
      sendJson(res, 200, revokeSessions({ accessToken: token, all: body.all }))
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/token/social') {
      const body = await readJsonBody<{
        provider?: string
        idToken?: string
        id_token?: string
        clientId?: string
        client_id?: string
        bundleId?: string
        bundle_id?: string
      }>(req)
      sendJson(
        res,
        200,
        await exchangeSocialToken({
          provider: body.provider ?? '',
          idToken: body.idToken || body.id_token || '',
          clientId: body.clientId || body.client_id || '',
          bundleId: body.bundleId || body.bundle_id || '',
        }),
      )
      return true
    }

    if (method === 'POST' && url === '/api/identity/v1/social/bind') {
      const token = bearer(req)
      if (!token) {
        sendJson(res, 401, { message: '未登录或会话已过期' })
        return true
      }
      const body = await readJsonBody<{
        provider?: string
        idToken?: string
        clientId?: string
      }>(req)
      sendJson(
        res,
        200,
        await bindSocialCredential({
          accessToken: token,
          provider: body.provider ?? '',
          idToken: body.idToken ?? '',
          clientId: body.clientId ?? '',
        }),
      )
      return true
    }

    if (url === '/api/identity/ops/clients' && method === 'GET') {
      sendJson(res, 200, { list: listClients() })
      return true
    }

    if (url === '/api/identity/ops/clients' && (method === 'POST' || method === 'PUT')) {
      const body = await readJsonBody<{
        clientId?: string
        name?: string
        bundleIds?: string[] | string
        redirectUris?: string[] | string
        appleAudiences?: string[] | string
        googleAudiences?: string[] | string
      }>(req)
      const split = (value: string[] | string | undefined) =>
        Array.isArray(value)
          ? value
          : (value ?? '')
              .split(/[\n,]/)
              .map((item) => item.trim())
              .filter(Boolean)
      try {
        const saved = upsertClient({
          clientId: body.clientId ?? '',
          name: body.name ?? '',
          bundleIds: split(body.bundleIds),
          redirectUris: split(body.redirectUris),
          appleAudiences: split(body.appleAudiences),
          googleAudiences: split(body.googleAudiences),
        })
        sendJson(res, 200, saved)
      } catch (err) {
        const message = err instanceof Error ? err.message : '保存失败'
        sendJson(res, 400, { message })
      }
      return true
    }

    sendJson(res, 404, { message: 'Not Found' })
    return true
  } catch (err) {
    fail(res, err)
    return true
  }
}
