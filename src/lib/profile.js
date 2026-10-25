import { ExecutionMethod } from 'appwrite'
import { appwriteConfig, functions } from './appwrite'

export { isProfileReady, limits, validateProfile } from '../../server/profile-api/domain.js'

export async function callApi(action, identity, payload = {}, signal) {
  const body = { ...payload, action, ...identity }
  let result
  let status
  if (import.meta.env.DEV && !appwriteConfig.profileFunctionId) {
    const response = await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal, cache: 'no-store',
    })
    status = response.status
    try { result = await response.json() }
    catch { throw new Error('API профиля недоступен. Перезапустите сервер командой npm run dev.') }
  } else {
    if (!appwriteConfig.profileFunctionId) throw new Error('Не настроен VITE_APPWRITE_PROFILE_FUNCTION_ID. Укажите ID функции профиля и пересоберите приложение.')
    if (identity.testTgId) throw new Error('Для тестового Telegram ID оставьте VITE_APPWRITE_PROFILE_FUNCTION_ID пустым и запустите npm run dev на localhost.')
    let execution
    try {
      execution = await functions.createExecution({ functionId: appwriteConfig.profileFunctionId, body: JSON.stringify(body), async: false, method: ExecutionMethod.POST })
    } catch { throw new Error('Не удалось вызвать функцию профиля. Проверьте подключение, ID функции и разрешение на её выполнение.') }
    status = execution.responseStatusCode
    try { result = JSON.parse(execution.responseBody) }
    catch { throw new Error('Функция профиля не вернула ответ. Проверьте её развёртывание и журналы выполнения.') }
  }
  if (status < 200 || status >= 300 || result.error) {
    const error = new Error(result.error || 'Не удалось загрузить или сохранить профиль. Попробуйте ещё раз.')
    error.fields = result.fields
    throw error
  }
  return result
}

export async function requestProfile(action, identity, profile, signal) {
  const result = await callApi(action, identity, profile ? { profile } : {}, signal)
  if (!result.profile?.$id || !result.profile?.tgId) throw new Error('Сервер вернул неполный профиль. Попробуйте ещё раз.')
  return result.profile
}
