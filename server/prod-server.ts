/**
 * 生产环境 API 服务
 *
 * 开发时这些接口由 vite 的 feedbackApiPlugin 中间件承载（只在 dev server 生效），
 * 生产环境静态托管下不存在，因此这里把它们做成独立 Node 服务，由 nginx 反代 /api/。
 *
 * 环境变量：
 *   PORT      监听端口，默认 3900
 *   HOST      监听地址，默认 127.0.0.1（只对 nginx 暴露，不直接对外）
 *   DATA_DIR  数据目录，默认 <cwd>/data
 */
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  handleCreateFeedback,
  handleListFeedbacks,
  handleUploadFile,
} from './feedbackStore'

const PORT = Number(process.env.PORT ?? 3900)
const HOST = process.env.HOST ?? '127.0.0.1'

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

const UPLOAD_RE = /^\/api\/ops\/uploads\/([^/]+)$/

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = (req.url ?? '').split('?')[0] ?? ''
  const method = req.method ?? 'GET'

  if (method === 'GET' && url === '/api/health') {
    sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()) })
    return
  }

  // 客户端提交反馈（公开）
  if (method === 'POST' && url === '/api/feedback') {
    void handleCreateFeedback(req, res)
    return
  }

  // 运营页读取反馈列表（nginx 层已加访问保护）
  if (method === 'GET' && url === '/api/ops/feedbacks') {
    handleListFeedbacks(res)
    return
  }

  // 运营页查看上传的截图
  const uploadMatch = url.match(UPLOAD_RE)
  if (method === 'GET' && uploadMatch) {
    handleUploadFile(res, decodeURIComponent(uploadMatch[1] ?? ''))
    return
  }

  sendJson(res, 404, { message: 'Not Found' })
})

server.on('clientError', (_err: Error, socket: NodeJS.WritableStream) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

server.listen(PORT, HOST, () => {
  console.log(`[app-h5-api] listening on http://${HOST}:${PORT}`)
})

function shutdown(signal: string): void {
  console.log(`[app-h5-api] received ${signal}, shutting down...`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
