export const useTestTelegramId = import.meta.env.DEV && import.meta.env.VITE_USE_TEST_TELEGRAM_ID === 'true'

// Read signed launch data. A bare user ID is never trusted in Telegram mode.
export async function getTelegramIdentity(signal) {
  if (useTestTelegramId) {
    const testTgId = import.meta.env.VITE_TEST_TELEGRAM_ID?.trim()
    if (!/^[1-9]\d{0,15}$/.test(testTgId || '')) throw new Error('Укажите числовой VITE_TEST_TELEGRAM_ID в .env и перезапустите Vite.')
    return { testTgId }
  }
  if (!window.Telegram?.WebApp && !document.getElementById('telegram-web-app-sdk')) {
    const script = document.createElement('script')
    script.id = 'telegram-web-app-sdk'
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.addEventListener('error', () => script.remove(), { once: true })
    document.head.append(script)
  }
  return new Promise((resolve, reject) => {
    let timer
    const startedAt = Date.now()
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')) }
    const check = () => {
      if (signal?.aborted) return abort()
      const webApp = window.Telegram?.WebApp
      if (webApp?.initData) {
        cleanup()
        webApp.ready()
        webApp.expand()
        resolve({ initData: webApp.initData })
      } else if (Date.now() - startedAt >= 12000) {
        cleanup()
        reject(new Error('Данные Telegram не получены. Откройте приложение через кнопку в Telegram и попробуйте снова.'))
      } else timer = setTimeout(check, 200)
    }
    signal?.addEventListener('abort', abort, { once: true })
    check()
  })
}
