export interface BridgeAuth {
  token: string
  userId?: string
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
}
