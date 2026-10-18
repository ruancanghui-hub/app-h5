import fs from 'node:fs'
import path from 'node:path'
import type { IdentityStoreData } from './types'

const DATA_DIR = process.env.IDENTITY_DATA_DIR
  ? path.resolve(process.env.IDENTITY_DATA_DIR)
  : path.resolve(process.cwd(), 'data', 'identity')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

const EMPTY: IdentityStoreData = {
  identities: [],
  memberships: [],
  loginTickets: [],
  authCodes: [],
  sessions: [],
  passwordResets: [],
  emailVerifies: [],
  socialLinks: [],
}

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(EMPTY, null, 2), 'utf8')
  }
}

export function readStore(): IdentityStoreData {
  ensureDirs()
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as IdentityStoreData
    return {
      identities: parsed.identities ?? [],
      memberships: parsed.memberships ?? [],
      loginTickets: parsed.loginTickets ?? [],
      authCodes: parsed.authCodes ?? [],
      sessions: parsed.sessions ?? [],
      passwordResets: parsed.passwordResets ?? [],
      emailVerifies: parsed.emailVerifies ?? [],
      socialLinks: parsed.socialLinks ?? [],
    }
  } catch {
    return structuredClone(EMPTY)
  }
}

export function writeStore(data: IdentityStoreData) {
  ensureDirs()
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function identityDataDir(): string {
  return DATA_DIR
}
