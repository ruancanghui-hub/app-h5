import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Busboy from 'busboy'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type ProblemType = 'abnormal' | 'suggestion' | 'other'

export interface StoredFeedback {
  id: string
  problemType: ProblemType
  content: string
  contact?: string
  images: string[]
  createdAt: string
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data')
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const STORE_FILE = path.join(DATA_DIR, 'feedbacks.json')
const TYPE_SET = new Set<ProblemType>(['abnormal', 'suggestion', 'other'])
const MAX_FILE_BYTES = 5 * 1024 * 1024

function ensureDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, '[]', 'utf8')
  }
}

function readAll(): StoredFeedback[] {
  ensureDirs()
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as StoredFeedback[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(list: StoredFeedback[]) {
  ensureDirs()
  fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), 'utf8')
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

interface ParsedUpload {
  fields: Record<string, string>
  files: { filename: string; mimeType: string; buffer: Buffer }[]
}

function parseMultipart(req: IncomingMessage): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type']
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type 必须是 multipart/form-data'))
      return
    }

    const fields: Record<string, string> = {}
    const files: ParsedUpload['files'] = []
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_BYTES, files: 3 },
    })

    busboy.on('field', (name, value) => {
      fields[name] = value
    })

    busboy.on('file', (name, stream, info) => {
      if (name !== 'images') {
        stream.resume()
        return
      }
      const { filename, mimeType } = info
      if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) {
        stream.resume()
        return
      }
      const chunks: Buffer[] = []
      let truncated = false
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      stream.on('limit', () => {
        truncated = true
      })
      stream.on('end', () => {
        if (truncated) return
        files.push({
          filename: filename || 'image.jpg',
          mimeType,
          buffer: Buffer.concat(chunks),
        })
      })
    })

    busboy.on('error', reject)
    busboy.on('finish', () => resolve({ fields, files }))
    req.pipe(busboy)
  })
}

function extFromMime(mimeType: string, filename: string): string {
  const fromName = path.extname(filename)
  if (fromName) return fromName
  if (mimeType.includes('png')) return '.png'
  if (mimeType.includes('webp')) return '.webp'
  return '.jpg'
}

export async function handleCreateFeedback(req: IncomingMessage, res: ServerResponse) {
  try {
    ensureDirs()
    const { fields, files } = await parseMultipart(req)
    const problemType = (fields.problemType || '').trim() as ProblemType
    const content = (fields.content || '').trim()
    const contact = (fields.contact || '').trim()

    if (!TYPE_SET.has(problemType)) {
      sendJson(res, 400, { message: '问题类型无效' })
      return
    }
    if ([...content].length < 10) {
      sendJson(res, 400, { message: '描述至少 10 个字' })
      return
    }
    if ([...content].length > 500) {
      sendJson(res, 400, { message: '描述不能超过 500 字' })
      return
    }

    const imageUrls: string[] = []
    for (const file of files.slice(0, 3)) {
      const name = `${Date.now()}_${randomUUID().slice(0, 8)}${extFromMime(file.mimeType, file.filename)}`
      fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer)
      imageUrls.push(`/api/ops/uploads/${name}`)
    }

    const record: StoredFeedback = {
      id: `fb_${Date.now()}_${randomUUID().slice(0, 6)}`,
      problemType,
      content,
      contact: contact || undefined,
      images: imageUrls,
      createdAt: new Date().toISOString(),
    }

    const list = readAll()
    list.unshift(record)
    writeAll(list)

    sendJson(res, 200, { id: record.id, createdAt: record.createdAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : '提交失败'
    sendJson(res, 500, { message })
  }
}

export function handleListFeedbacks(res: ServerResponse) {
  const list = readAll()
  sendJson(res, 200, { list })
}

export function handleUploadFile(res: ServerResponse, filename: string) {
  ensureDirs()
  const safe = path.basename(filename)
  const filePath = path.join(UPLOAD_DIR, safe)
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
    res.statusCode = 404
    res.end('Not Found')
    return
  }
  const ext = path.extname(safe).toLowerCase()
  const type =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'public, max-age=31536000')
  fs.createReadStream(filePath).pipe(res)
}
