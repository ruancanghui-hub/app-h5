import fs from 'node:fs'
import path from 'node:path'
import type { PublicClient, SocialProvider } from './types'
import { identityDataDir } from './store'

const CLIENT_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/

const SEED: PublicClient[] = [
  {
    clientId: 'demo-app',
    name: 'Demo App',
    bundleIds: ['com.example.demo', 'com.aigrowpark.demo'],
    redirectUris: ['app-h5://auth/callback', 'http://localhost:5173/#/auth/done'],
    appleAudiences: [],
    googleAudiences: [],
  },
  {
    clientId: 'app-h5-preview',
    name: 'App H5 预览',
    bundleIds: ['com.aigrowpark.h5.preview'],
    redirectUris: ['http://localhost:5173/#/auth/done', 'app-h5://auth/callback'],
    appleAudiences: [],
    googleAudiences: [],
  },
]

function clientsFile() {
  return path.join(identityDataDir(), 'clients.json')
}

function normalize(raw: Partial<PublicClient>): PublicClient {
  return {
    clientId: (raw.clientId ?? '').trim(),
    name: (raw.name ?? '').trim(),
    bundleIds: (raw.bundleIds ?? []).map((s) => s.trim()).filter(Boolean),
    redirectUris: (raw.redirectUris ?? []).map((s) => s.trim()).filter(Boolean),
    appleAudiences: (raw.appleAudiences ?? []).map((s) => s.trim()).filter(Boolean),
    googleAudiences: (raw.googleAudiences ?? []).map((s) => s.trim()).filter(Boolean),
  }
}

export function listClients(): PublicClient[] {
  const file = clientsFile()
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(SEED, null, 2), 'utf8')
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<PublicClient>[]
    if (!Array.isArray(parsed)) return structuredClone(SEED)
    return parsed.map(normalize).filter((c) => c.clientId)
  } catch {
    return structuredClone(SEED)
  }
}

export function getClient(clientId: string): PublicClient | null {
  return listClients().find((c) => c.clientId === clientId) ?? null
}

export function isRedirectAllowed(client: PublicClient, redirectUri: string | undefined): boolean {
  if (!redirectUri) return true
  return client.redirectUris.includes(redirectUri)
}

export function audiencesFor(client: PublicClient, provider: SocialProvider): string[] {
  const fromClient = provider === 'apple' ? client.appleAudiences : client.googleAudiences
  const envName = provider === 'apple' ? 'APPLE_AUDIENCES' : 'GOOGLE_AUDIENCES'
  const fromEnv = (process.env[envName] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set([...fromClient, ...fromEnv])]
}

export function assertClientInput(input: PublicClient): void {
  if (!CLIENT_ID_RE.test(input.clientId)) {
    throw new Error('clientId 须为小写字母、数字或连字符，2–64 位')
  }
  if (!input.name) throw new Error('名称不能为空')
  if (!input.bundleIds.length) throw new Error('至少填写一个包名或 Bundle ID')
}

export function upsertClient(input: PublicClient): PublicClient {
  const client = normalize(input)
  assertClientInput(client)
  const list = listClients()
  const idx = list.findIndex((c) => c.clientId === client.clientId)
  if (idx >= 0) list[idx] = client
  else list.push(client)
  fs.writeFileSync(clientsFile(), JSON.stringify(list, null, 2), 'utf8')
  return client
}
