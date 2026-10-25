import { handleProfileRequest, readConfig } from './handler.js'

export default async function ({ req, res }) {
  if (req.method !== 'POST') return res.json({ error: 'Используйте POST.' }, 405)
  let body
  try { body = req.bodyJson } catch { return res.json({ error: 'Некорректный JSON.' }, 400) }
  const config = readConfig(process.env, { apiKey: req.headers['x-appwrite-key'], allowTestIdentity: false })
  const result = await handleProfileRequest(body, config)
  return res.json(result.body, result.status, { 'Cache-Control': 'no-store' })
}
