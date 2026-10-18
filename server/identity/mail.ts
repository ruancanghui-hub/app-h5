import net from 'node:net'
import tls from 'node:tls'

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM)
}

export function publicOrigin(): string {
  return (process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
}

function readReply(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8')
      const lines = buf.split(/\r?\n/).filter((line) => line.length > 0)
      const last = lines[lines.length - 1] ?? ''
      if (!/^\d{3} /.test(last)) return
      socket.off('data', onData)
      socket.off('error', onError)
      const code = Number(last.slice(0, 3))
      if (code >= 400) reject(new Error(buf.trim()))
      else resolve(buf)
    }
    const onError = (err: Error) => {
      socket.off('data', onData)
      reject(err)
    }
    socket.on('data', onData)
    socket.once('error', onError)
  })
}

function writeLine(socket: net.Socket, line: string): Promise<string> {
  socket.write(`${line}\r\n`)
  return readReply(socket)
}

function connectSmtp(host: string, port: number, secure: boolean): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port })
    socket.once('error', reject)
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      socket.off('error', reject)
      resolve(socket)
    })
  })
}

async function upgradeStartTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect({ socket, servername: host }, () => resolve(tlsSocket))
    tlsSocket.once('error', reject)
  })
}

/**
 * 最小 SMTP 客户端：465 隐式 TLS，其他端口走 STARTTLS。
 */
export async function sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean }> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[identity][mail] SMTP 未配置，跳过发送\nTo: ${to}\n${subject}\n${text}`)
    }
    return { sent: false }
  }

  const host = process.env.SMTP_HOST!
  const port = Number(process.env.SMTP_PORT ?? 465)
  const from = process.env.MAIL_FROM!
  const user = process.env.SMTP_USER ?? ''
  const pass = process.env.SMTP_PASS ?? ''
  const implicitTls = process.env.SMTP_SECURE === 'true' || port === 465

  let socket = await connectSmtp(host, port, implicitTls)
  try {
    await readReply(socket)
    await writeLine(socket, `EHLO ${host}`)
    if (!implicitTls) {
      await writeLine(socket, 'STARTTLS')
      socket = await upgradeStartTls(socket, host)
      await writeLine(socket, `EHLO ${host}`)
    }
    if (user) {
      await writeLine(socket, 'AUTH LOGIN')
      await writeLine(socket, Buffer.from(user).toString('base64'))
      await writeLine(socket, Buffer.from(pass).toString('base64'))
    }
    await writeLine(socket, `MAIL FROM:<${from}>`)
    await writeLine(socket, `RCPT TO:<${to}>`)
    await writeLine(socket, 'DATA')
    const body = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text.replace(/^\./gm, '..'),
      '.',
    ].join('\r\n')
    socket.write(`${body}\r\n`)
    await readReply(socket)
    await writeLine(socket, 'QUIT')
    return { sent: true }
  } finally {
    socket.end()
  }
}
