import type { AppBridge, BridgeAuth, BridgeImageResult, BridgeSetAuthPayload } from './types'

const PREVIEW_AUTH_KEY = 'app-h5-preview-auth'

declare global {
  interface Window {
    Native?: Partial<AppBridge> & {
      postMessage?: (payload: string) => void
    }
    webkit?: {
      messageHandlers?: {
        Native?: { postMessage: (payload: unknown) => void }
      }
    }
    __APP_BRIDGE__?: Partial<AppBridge>
  }
}

function callNative(method: string, payload?: unknown): boolean {
  const message = JSON.stringify({ method, payload })
  if (window.webkit?.messageHandlers?.Native?.postMessage) {
    window.webkit.messageHandlers.Native.postMessage({ method, payload })
    return true
  }
  if (window.Native?.postMessage) {
    window.Native.postMessage(message)
    return true
  }
  return false
}

async function closePage(): Promise<void> {
  if (window.__APP_BRIDGE__?.closePage) {
    await window.__APP_BRIDGE__.closePage()
    return
  }
  if (window.Native?.closePage) {
    await window.Native.closePage()
    return
  }
  if (callNative('closePage')) return
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  console.info('[Bridge] closePage: no native handler')
}

async function openHistory(): Promise<void> {
  if (window.__APP_BRIDGE__?.openHistory) {
    await window.__APP_BRIDGE__.openHistory()
    return
  }
  if (window.Native?.openHistory) {
    await window.Native.openHistory()
    return
  }
  if (callNative('openHistory')) return
  throw new Error('BRIDGE_OPEN_HISTORY_FALLBACK')
}

function pickFromFileInput(maxCount: number): Promise<BridgeImageResult[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.multiple = maxCount > 1
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []).slice(0, maxCount)
      const results: BridgeImageResult[] = files.map((file) => ({
        url: URL.createObjectURL(file),
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      }))
      input.remove()
      resolve(results)
    })
    document.body.appendChild(input)
    input.click()
  })
}

async function pickImage(options?: { maxCount?: number }): Promise<BridgeImageResult[]> {
  const maxCount = options?.maxCount ?? 1
  if (window.__APP_BRIDGE__?.pickImage) {
    return window.__APP_BRIDGE__.pickImage({ maxCount })
  }
  if (window.Native?.pickImage) {
    return window.Native.pickImage({ maxCount })
  }
  if (callNative('pickImage', { maxCount })) {
    // Native async callback protocol can be wired later; browser fallback below for H5 preview.
  }
  return pickFromFileInput(maxCount)
}

function readPreviewAuth(): BridgeAuth | null {
  try {
    const raw = sessionStorage.getItem(PREVIEW_AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BridgeAuth
  } catch {
    return null
  }
}

async function getAuth(): Promise<BridgeAuth | null> {
  if (window.__APP_BRIDGE__?.getAuth) {
    return window.__APP_BRIDGE__.getAuth()
  }
  if (window.Native?.getAuth) {
    return window.Native.getAuth()
  }
  if (callNative('getAuth')) {
    return null
  }
  const preview = readPreviewAuth()
  if (preview) return preview
  return { token: 'mock-token', userId: 'preview-user' }
}

async function setAuth(payload: BridgeSetAuthPayload): Promise<void> {
  if (window.__APP_BRIDGE__?.setAuth) {
    await window.__APP_BRIDGE__.setAuth(payload)
    return
  }
  if (window.Native?.setAuth) {
    await window.Native.setAuth(payload)
    return
  }
  if (callNative('setAuth', payload)) return

  // 浏览器预览：sessionStorage 模拟原生保管（非正式主会话）
  const auth: BridgeAuth = {
    token: payload.accessToken,
    userId: payload.identityId,
    identityId: payload.identityId,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt,
  }
  sessionStorage.setItem(PREVIEW_AUTH_KEY, JSON.stringify(auth))
  console.info('[Bridge] setAuth: preview session stored')
}

export const bridge: AppBridge = {
  closePage,
  openHistory,
  pickImage,
  getAuth,
  setAuth,
}

export type { AppBridge, BridgeAuth, BridgeImageResult, BridgeSetAuthPayload }
