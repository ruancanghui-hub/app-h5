export interface BridgeAuth {
  /** 当前 access token（业务请求 Authorization） */
  token: string
  /** 与 identityId 对齐；兼容旧字段名 */
  userId?: string
  identityId?: string
  refreshToken?: string
  expiresAt?: string
}

export interface BridgeSetAuthPayload {
  accessToken: string
  refreshToken: string
  identityId: string
  expiresAt: string
}

export interface BridgeImageResult {
  /** local blob/object url or base64 data url */
  url: string
  file?: File
  name?: string
  size?: number
  mimeType?: string
}

export interface AppBridge {
  closePage: () => Promise<void>
  openHistory: () => Promise<void>
  pickImage: (options?: { maxCount?: number }) => Promise<BridgeImageResult[]>
  getAuth: () => Promise<BridgeAuth | null>
  /** 托管登录成功后回写原生会话 */
  setAuth: (payload: BridgeSetAuthPayload) => Promise<void>
}
