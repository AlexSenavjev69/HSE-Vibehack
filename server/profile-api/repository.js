import { ProfileError } from './errors.js'
import { createHash } from 'node:crypto'

const query = (method, values, attribute) => JSON.stringify({ method, ...(attribute ? { attribute } : {}), values })

export function createRepository(config, fetchImpl = fetch) {
  const required = { VITE_APPWRITE_ENDPOINT: config.endpoint, VITE_APPWRITE_PROJECT_ID: config.projectId, VITE_APPWRITE_DATABASE_ID: config.databaseId, VITE_APPWRITE_USERS_TABLE_ID: config.usersTableId, VITE_APPWRITE_CITIES_TABLE_ID: config.citiesTableId, APPWRITE_API_KEY: config.apiKey }
  const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name)
  if (missing.length) throw new ProfileError(`Заполните настройки сервера: ${missing.join(', ')}.`, 503)
  const root = `${config.endpoint.replace(/\/$/, '')}/tablesdb/${encodeURIComponent(config.databaseId)}/tables`

  async function request(tableId, { method = 'GET', rowId, queries = [], body } = {}) {
    const url = new URL(`${root}/${encodeURIComponent(tableId)}/rows${rowId ? `/${encodeURIComponent(rowId)}` : ''}`)
    queries.forEach((value) => url.searchParams.append('queries[]', value))
    let response
    try {
      response = await fetchImpl(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': config.projectId, 'X-Appwrite-Key': config.apiKey },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      })
    } catch { throw new ProfileError('Сервер Appwrite недоступен. Попробуйте ещё раз.', 502) }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 409) throw new ProfileError('Запись уже существует.', 409)
      if ([401, 403].includes(response.status)) throw new ProfileError('Appwrite отклонил доступ. Проверьте серверный API-ключ и его scopes rows.read / rows.write.', 502)
      if (response.status === 404) throw new ProfileError('База или таблица не найдена. Проверьте ID в настройках.', 502)
      if (response.status === 400) throw new ProfileError(`Appwrite не принял данные. Проверьте колонки, связи и индексы Users.tgId / Cities.name (${data.type || 'invalid_schema'}).`, 502)
      throw new ProfileError('Не удалось выполнить запрос к Appwrite.', 502)
    }
    return data
  }

  return {
    async findUser(tgId) {
      const result = await request(config.usersTableId, { queries: [query('equal', [tgId], 'tgId'), query('limit', [2]), query('select', ['*', 'groups.*', 'cities.*'])] })
      if (result.rows.length > 1) throw new ProfileError('В Users несколько записей с одинаковым tgId. Добавьте уникальный индекс tgId и устраните дубликаты.', 409)
      return result.rows[0] || null
    },
    createUser(tgId) {
      return request(config.usersTableId, { method: 'POST', body: {
        rowId: `tg_${tgId}`,
        data: { tgId, isProfileCompleted: false, name: '', surname: '', phone: '', tags: [], groups: [], cities: null, time: '', district: '' },
        permissions: [],
      } })
    },
    updateUser(rowId, data) {
      return request(config.usersTableId, { method: 'PATCH', rowId, body: { data } })
    },
    async findCity(name) {
      const result = await request(config.citiesTableId, { queries: [query('equal', [name], 'name'), query('limit', [2])] })
      if (result.rows.length > 1) throw new ProfileError('В Cities несколько записей с одинаковым name. Устраните дубликаты и добавьте уникальный индекс name.', 409)
      return result.rows[0] || null
    },
    createCity(name) {
      // Stable ID makes concurrent creation of the same normalized city idempotent.
      const rowId = `city${createHash('sha256').update(name).digest('hex').slice(0, 32)}`
      return request(config.citiesTableId, { method: 'POST', body: { rowId, data: { name }, permissions: [] } })
    },
  }
}
