import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto'

interface Jwk extends JsonWebKey {
  kid?: string
}

const cache = new Map<string, { until: number; keys: Jwk[] }>()

async function loadJwks(url: string): Promise<Jwk[]> {
  const hit = cache.get(url)
  if (hit && hit.until > Date.now()) return hit.keys
  const res = await fetch(url)
  if (!res.ok) throw new Error(`拉取公钥失败(${res.status})`)
  const body = (await res.json()) as { keys?: Jwk[] }
  const keys = body.keys ?? []
  cache.set(url, { until: Date.now() + 60 * 60 * 1000, keys })
  return keys
}

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
}

export async function verifyRs256Jwt(
  token: string,
  jwksUrl: string,
  options: { issuers: string[]; audiences: string[] },
): Promise<Record<string, unknown>> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('令牌格式无效')
  const header = decodePart(parts[0]!)
  if (header.alg !== 'RS256') throw new Error('仅支持 RS256')
  const keys = await loadJwks(jwksUrl)
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('找不到匹配的签名公钥')
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const ok = cryptoVerify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    key,
    Buffer.from(parts[2]!, 'base64url'),
  )
  if (!ok) throw new Error('令牌签名无效')

  const payload = decodePart(parts[1]!)
  const now = Math.floor(Date.now() / 1000)
  const exp = Number(payload.exp)
  if (!Number.isFinite(exp) || exp < now - 60) throw new Error('令牌已过期')
  const iss = String(payload.iss ?? '')
  if (!options.issuers.includes(iss)) throw new Error('签发方无效')
  if (!options.audiences.length) throw new Error('未配置受众')
  const audRaw = payload.aud
  const auds = Array.isArray(audRaw) ? audRaw.map(String) : [String(audRaw ?? '')]
  if (!auds.some((a) => options.audiences.includes(a))) throw new Error('受众不匹配')
  return payload
}
