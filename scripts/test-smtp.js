import { createServer as createHttpServer } from 'node:http'
import { SMTPServer } from 'smtp-server'

const smtpPort = Number(process.env.PLAYWRIGHT_SMTP_PORT || 4312)
const capturePort = Number(process.env.PLAYWRIGHT_SMTP_CAPTURE_PORT || 4313)
const messages = new Map()
const capturedMessages = new Map()

const smtpServer = new SMTPServer({
  authOptional: true,
  disabledCommands: ['AUTH', 'STARTTLS'],
  logger: false,
  onData(stream, session, callback) {
    let message = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => { message += chunk })
    stream.on('end', () => {
      const email = session.envelope.rcptTo[0]?.address?.toLowerCase()
      const code = message.match(/verification code is (\d{6})/i)?.[1]
      if (!email) {
        callback(new Error('Test email did not contain a recipient.'))
        return
      }
      if (code) messages.set(email, code)
      const recipientMessages = capturedMessages.get(email) || []
      recipientMessages.push(message)
      capturedMessages.set(email, recipientMessages)
      callback(null, 'Test message captured.')
    })
  }
})

const captureServer = createHttpServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200).end(JSON.stringify({ status: 'ok' }))
    return
  }
  if (request.method === 'GET' && url.pathname === '/latest') {
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase()
    const code = messages.get(email)
    if (!code) {
      response.writeHead(404).end(JSON.stringify({ error: 'No test email captured.' }))
      return
    }
    response.writeHead(200).end(JSON.stringify({ code }))
    return
  }
  if (request.method === 'GET' && url.pathname === '/messages') {
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase()
    response.writeHead(200).end(JSON.stringify({ messages: capturedMessages.get(email) || [] }))
    return
  }
  response.writeHead(404).end(JSON.stringify({ error: 'Not found.' }))
})

smtpServer.listen(smtpPort, '127.0.0.1', () => {
  console.log(`Local test SMTP server listening on 127.0.0.1:${smtpPort}`)
})
captureServer.listen(capturePort, '127.0.0.1', () => {
  console.log(`Local test mail capture listening on 127.0.0.1:${capturePort}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    smtpServer.close()
    captureServer.close()
  })
}
