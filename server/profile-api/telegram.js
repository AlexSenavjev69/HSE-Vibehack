import { createHmac, timingSafeEqual } from 'node:crypto'
import { ProfileError } from './errors.js'

export function validateTelegramData(initData, botToken, now = Date.now()) {
  if (!botToken) throw new ProfileError('На сервере не настроен TELEGRAM_BOT_TOKEN.', 503)
  if (typeof initData !== 'string' || !initData || initData.length > 16384) throw new ProfileError('Откройте приложение через Telegram.', 401)
  const params = new URLSearchParams(initData)
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new ProfileError('Некорректные данные Telegram.', 401)
  const hash = params.get('hash')
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new ProfileError('Не удалось подтвердить вход через Telegram.', 401)
  params.delete('hash')
  const checkString = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(checkString).digest()
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new ProfileError('Подпись Telegram недействительна. Откройте приложение заново.', 401)
  const authDate = Number(params.get('auth_date'))
  const age = Math.floor(now / 1000) - authDate
  if (!Number.isSafeInteger(authDate) || authDate <= 0 || age < -30 || age > 3600) throw new ProfileError('Время входа истекло. Закройте и снова откройте приложение в Telegram.', 401)
  let user
  try { user = JSON.parse(params.get('user')) } catch { throw new ProfileError('Не удалось определить пользователя Telegram.', 401) }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw new ProfileError('Telegram не передал идентификатор пользователя.', 401)
  return String(user.id)
}

export function resolveIdentity(body, config) {
  if (body.testTgId !== undefined) {
    // Enabled only by the local Vite adapter; deployed Functions never allow it.
    if (!config.allowTestIdentity || !config.useTestIdentity || !/^[1-9]\d{0,15}$/.test(config.testTgId || '') || body.testTgId !== config.testTgId) {
      throw new ProfileError('Тестовый Telegram ID разрешён только в локальном режиме разработки.', 403)
    }
    return config.testTgId
  }
  return validateTelegramData(body.initData, config.botToken)
}
