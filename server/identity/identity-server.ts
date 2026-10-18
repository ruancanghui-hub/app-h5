/**
 * 身份服务独立进程
 *
 * 环境变量：
 *   IDENTITY_PORT  默认 3901
 *   IDENTITY_HOST  默认 127.0.0.1
 *   IDENTITY_DATA_DIR  默认 <cwd>/data/identity
 */
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleIdentityRequest, sendJson } from './http'
import { identityDataDir } from './store'

const PORT = Number(process.env.IDENTITY_PORT ?? 3901)
const HOST = process.env.IDENTITY_HOST ?? '127.0.0.1'

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  void (async () => {
    const handled = await handleIdentityRequest(req, res)
    if (!handled) {
      sendJson(res, 404, { message: 'Not Found' })
    }
  })()
})

server.on('clientError', (_err: Error, socket: NodeJS.WritableStream) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

server.listen(PORT, HOST, () => {
  console.log(`[identity-api] listening on http://${HOST}:${PORT}`)
  console.log(`[identity-api] data dir: ${identityDataDir()}`)
})

function shutdown(signal: string): void {
  console.log(`[identity-api] received ${signal}, shutting down...`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
