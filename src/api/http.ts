import { bridge } from '@/bridge'

export class HttpError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: BodyInit | null
  headers?: Record<string, string>
  timeoutMs?: number
  retries?: number
  /** only safe methods retry by default */
  retryable?: boolean
  formData?: FormData
  json?: unknown
}

const DEFAULT_TIMEOUT = 10_000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HttpError('网络超时，请稍后重试', 408)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function isRetryableMethod(method: string, explicit?: boolean): boolean {
  if (explicit != null) return explicit
  return method === 'GET'
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
  const maxRetries = options.retries ?? (isRetryableMethod(method, options.retryable) ? 2 : 0)
  const base = import.meta.env.VITE_API_BASE || '/api'
  const url = path.startsWith('http') ? path : `${base}${path}`

  const auth = await bridge.getAuth()
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  }
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`

  let body: BodyInit | null | undefined = options.body
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  } else if (options.formData) {
    body = options.formData
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await withTimeout(
        fetch(url, { method, headers, body }),
        timeoutMs,
      )
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const errBody = (await res.json()) as { message?: string }
          throw new HttpError(errBody.message || `请求失败(${res.status})`, res.status)
        }
        throw new HttpError(`请求失败(${res.status})`, res.status)
      }
      if (contentType.includes('application/json')) {
        return (await res.json()) as T
      }
      return (await res.text()) as T
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await sleep(300 * (attempt + 1))
        continue
      }
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError('网络异常')
}
