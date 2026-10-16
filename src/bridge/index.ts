import type { AppBridge, BridgeAuth, BridgeImageResult } from './types'

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
  // fallback handled by caller via router
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
  return { token: 'mock-token', userId: 'preview-user' }
}

export const bridge: AppBridge = {
  closePage,
  openHistory,
  pickImage,
  getAuth,
}

export type { AppBridge, BridgeAuth, BridgeImageResult }
