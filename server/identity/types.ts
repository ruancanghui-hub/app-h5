export interface IdentityRecord {
  id: string
  email: string
  emailVerified: boolean
  passwordHash: string
  displayName: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AppMembershipRecord {
  identityId: string
  clientId: string
  grantedAt: string
  scopes: string[]
}

export interface LoginTicketRecord {
  id: string
  identityId: string
  expiresAt: string
}

export interface AuthCodeRecord {
  code: string
  identityId: string
  clientId: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  scopes: string[]
  expiresAt: string
}

export interface SessionRecord {
  accessToken: string
  refreshToken: string
  identityId: string
  clientId: string
  scopes: string[]
  accessExpiresAt: string
  refreshExpiresAt: string
  revoked: boolean
}

export interface PasswordResetRecord {
  token: string
  identityId: string
  expiresAt: string
}

export interface EmailVerifyRecord {
  token: string
  identityId: string
  expiresAt: string
}

export type SocialProvider = 'apple' | 'google'

export interface SocialLinkRecord {
  provider: SocialProvider
  subject: string
  identityId: string
  email?: string
  /** Apple 隐藏邮箱：不参与自动合并 */
  privateEmail: boolean
  linkedAt: string
}

export interface IdentityStoreData {
  identities: IdentityRecord[]
  memberships: AppMembershipRecord[]
  loginTickets: LoginTicketRecord[]
  authCodes: AuthCodeRecord[]
  sessions: SessionRecord[]
  passwordResets: PasswordResetRecord[]
  emailVerifies: EmailVerifyRecord[]
  socialLinks: SocialLinkRecord[]
}

export interface PublicClient {
  clientId: string
  name: string
  bundleIds: string[]
  redirectUris: string[]
  appleAudiences: string[]
  googleAudiences: string[]
}

export interface TokenResponse {
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
