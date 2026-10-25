import { handleProfileRequest, readConfig } from './profile-api/handler.js'

export function profileApiPlugin(env) {
  return {
    name: 'local-profile-api',
    configureServer(server) {
      const config = readConfig(env, { allowTestIdentity: true })
      server.middlewares.use('/api/profile', async (req, res) => {
        const send = (status, body) => {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          res.end(JSON.stringify(body))
        }
        // The test-ID path is local-only and must not be exposed via --host / tunnels.
        const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
        let localOrigin = false
        try {
          const origin = new URL(req.headers.origin)
          localOrigin = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.host === req.headers.host
        } catch { /* A browser POST must carry its origin. */ }
        if (!loopback || !localOrigin) return send(403, { error: 'Локальный API доступен только из браузера на этом компьютере.' })
        if (req.method !== 'POST') return send(405, { error: 'Используйте POST.' })
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Ожидается JSON.' })
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 32768) return send(413, { error: 'Слишком большой запрос.' })
            chunks.push(chunk)
          }
          const result = await handleProfileRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')), config)
          send(result.status, result.body)
        } catch { send(400, { error: 'Не удалось прочитать запрос.' }) }
      })
    },
  }
}
