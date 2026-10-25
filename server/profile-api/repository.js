import { ProfileError } from './errors.js'
import { createHash } from 'node:crypto'

const query = (method, values, attribute) => JSON.stringify({ method, ...(attribute ? { attribute } : {}), values })

export function createRepository(config, fetchImpl = fetch, transactionId) {
  const required = { VITE_APPWRITE_ENDPOINT: config.endpoint, VITE_APPWRITE_PROJECT_ID: config.projectId, VITE_APPWRITE_DATABASE_ID: config.databaseId, VITE_APPWRITE_USERS_TABLE_ID: config.usersTableId, VITE_APPWRITE_CITIES_TABLE_ID: config.citiesTableId, APPWRITE_API_KEY: config.apiKey }
  const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name)
  if (missing.length) throw new ProfileError(`Заполните настройки сервера: ${missing.join(', ')}.`, 503)
  const root = `${config.endpoint.replace(/\/$/, '')}/tablesdb/${encodeURIComponent(config.databaseId)}/tables`
  const citiesNameColumn = config.citiesNameColumn || 'name'
  // Keep the domain model independent from the actual column key in Appwrite.
  const cityModel = (row) => row && typeof row === 'object' ? { ...row, name: row[citiesNameColumn] || '' } : row
  const requestFields = ['$id', '$createdAt', '$updatedAt', 'name', 'description', 'tags', 'reward', 'status', 'client.$id', 'client.name', 'client.surname', 'client.district', `client.cities.${citiesNameColumn}`, 'worker.$id', 'worker.name', 'worker.surname']
  const requestSelection = query('select', requestFields)
  function configuredTable(key, variable) {
    if (!config[key]) throw new ProfileError(`Заполните VITE_${variable} (или ${variable} для функции).`, 503)
    return config[key]
  }
  const answersTable = () => configuredTable('answersTableId', 'APPWRITE_REQUESTS_ANSWERS_TABLE_ID')
  const reviewsTable = () => configuredTable('reviewsTableId', 'APPWRITE_REVIEWS_TABLE_ID')
  function requestsTable() {
    if (!config.requestsTableId) throw new ProfileError('Заполните VITE_APPWRITE_REQUESTS_TABLE_ID (или APPWRITE_REQUESTS_TABLE_ID для функции).', 503)
    return config.requestsTableId
  }

  async function request(tableId, { method = 'GET', rowId, queries = [], body, path, outsideTransaction = false } = {}) {
    const url = new URL(path ? `${config.endpoint.replace(/\/$/, '')}${path}` : `${root}/${encodeURIComponent(tableId)}/rows${rowId ? `/${encodeURIComponent(rowId)}` : ''}`)
    queries.forEach((value) => url.searchParams.append('queries[]', value))
    if (transactionId && !path && !outsideTransaction) {
      if (method === 'GET') url.searchParams.set('transactionId', transactionId)
      else body = { ...body, transactionId }
    }
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
      if (response.status === 409) throw new ProfileError('Данные уже изменились. Обновите страницу и попробуйте снова.', 409)
      if ([401, 403].includes(response.status)) throw new ProfileError('Appwrite отклонил доступ. Проверьте серверный API-ключ и его scopes rows.read / rows.write.', 502)
      if (response.status === 404 && ['row_not_found', 'document_not_found'].includes(data.type)) throw new ProfileError('Запись не найдена. Возможно, она была удалена.', 404)
      if (response.status === 404) throw new ProfileError('База или таблица не найдена. Проверьте ID в настройках.', 502)
      if (response.status === 400 && data.type === 'general_query_invalid') {
        const table = tableId === config.citiesTableId ? 'Cities' : tableId === config.requestsTableId ? 'Requests' : tableId === config.answersTableId ? 'RequestsAnswers' : tableId === config.reviewsTableId ? 'Reviews' : 'Users'
        const detail = typeof data.message === 'string' ? data.message.slice(0, 300) : 'Проверьте имена колонок запроса.'
        throw new ProfileError(`Ошибка запроса к ${table}: ${detail}`, 502)
      }
      if (response.status === 400 && tableId === config.requestsTableId) {
        const detail = typeof data.message === 'string' ? data.message.slice(0, 300) : data.type || 'invalid_schema'
        throw new ProfileError(`Appwrite не принял заявку: ${detail}`, 502)
      }
      if (response.status === 400 && [config.answersTableId, config.reviewsTableId].includes(tableId)) {
        throw new ProfileError(`Appwrite не принял данные ${tableId === config.answersTableId ? 'RequestsAnswers' : 'Reviews'}: ${String(data.message || data.type).slice(0, 300)}`, 502)
      }
      if (response.status === 400) throw new ProfileError(`Appwrite не принял данные. Проверьте колонки, связи и индексы Users.tgId / Cities.${citiesNameColumn} (${data.type || 'invalid_schema'}).`, 502)
      throw new ProfileError('Не удалось выполнить запрос к Appwrite.', 502)
    }
    return data
  }

  async function freshRow(tableId, rowId, selection) {
    const page = await request(tableId, { outsideTransaction: true, queries: [query('equal', [rowId], '$id'), query('limit', [1]), selection] })
    if (!page.rows[0]) throw new ProfileError('Запись не найдена. Возможно, она была удалена.', 404)
    return page.rows[0]
  }

  async function lockRow(tableId, rowId, field, selection) {
    if (!transactionId) throw new ProfileError('Изменение должно выполняться в транзакции.', 500)
    const before = await freshRow(tableId, rowId, selection)
    // Staging a no-op captures Appwrite's conflict version before any business reads.
    await request(tableId, { method: 'PATCH', rowId, body: { data: { [field]: before[field] ?? 0 } } })
    const after = await freshRow(tableId, rowId, selection)
    // Also cover changes between the initial read and staging. List queries avoid
    // the stale getRow cache after a transaction commit in Appwrite 1.9.6.
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new ProfileError('Запись изменилась во время операции. Повторите попытку.', 409)
    return before
  }

  async function listRows(tableId, filters) {
    const rows = []
    let cursor
    for (;;) {
      const queries = [...filters, query('orderDesc', [], '$createdAt'), query('orderDesc', [], '$id'), query('limit', [100])]
      if (cursor) queries.push(query('cursorAfter', [cursor]))
      const page = await request(tableId, { queries })
      rows.push(...page.rows)
      if (page.rows.length < 100) return rows
      const next = page.rows.at(-1).$id
      if (next === cursor) throw new ProfileError('Не удалось загрузить следующую страницу записей.', 502)
      cursor = next
    }
  }

  return {
    inTransaction: Boolean(transactionId),
    async withTransaction(work) {
      if (transactionId) throw new ProfileError('Вложенная транзакция не поддерживается.', 500)
      for (let attempt = 0; attempt < 3; attempt++) {
        const tx = await request(null, { path: '/tablesdb/transactions', method: 'POST', body: { ttl: 60 } })
        try {
          const result = await work(createRepository(config, fetchImpl, tx.$id))
          const committed = await request(null, { path: `/tablesdb/transactions/${encodeURIComponent(tx.$id)}`, method: 'PATCH', body: { commit: true } })
          if (committed.status !== 'committed') throw new ProfileError('Сервер не подтвердил сохранение изменений.', 502)
          return result
        } catch (error) {
          await request(null, { path: `/tablesdb/transactions/${encodeURIComponent(tx.$id)}`, method: 'PATCH', body: { rollback: true } }).catch(() => {})
          if (error.status !== 409 || attempt === 2) throw error
        }
      }
    },
    lockRequest(rowId) { return lockRow(requestsTable(), rowId, 'status', requestSelection) },
    lockUser(rowId) { return lockRow(config.usersTableId, rowId, 'Rating', query('select', ['$id', '$updatedAt', 'Rating'])) },
    updateRequest(rowId, data) { return request(requestsTable(), { method: 'PATCH', rowId, body: { data } }) },
    getAnswer(rowId) { return request(answersTable(), { rowId, queries: [query('select', ['$id', 'request.$id', 'worker.$id', 'worker.name', 'worker.surname'])] }) },
    async getReview(rowId) {
      const page = await request(reviewsTable(), { queries: [query('equal', [rowId], '$id'), query('limit', [1]), query('select', ['$id', 'rating', 'description', 'users.$id', 'request.$id'])] })
      return page.rows[0] || null
    },
    createReview(rowId, data) { return request(reviewsTable(), { method: 'POST', body: { rowId, data, permissions: [] } }) },
    listMyAnswers(workerId) {
      return listRows(answersTable(), [query('equal', [workerId], 'worker'), query('select', ['$id', '$createdAt', ...requestFields.map((field) => `request.${field}`)])])
    },
    listRequestAnswers(requestId) {
      return listRows(answersTable(), [query('equal', [requestId], 'request'), query('select', ['$id', '$createdAt', 'worker.$id', 'worker.name', 'worker.surname', 'worker.Rating'])])
    },
    async findAnswer(requestId, workerId) {
      const result = await request(answersTable(), { queries: [query('equal', [requestId], 'request'), query('equal', [workerId], 'worker'), query('limit', [1]), query('select', ['$id', '$createdAt'])] })
      return result.rows[0] || null
    },
    createAnswer(rowId, data) {
      // request is the child side of Requests.Answers; Appwrite maintains the reverse link.
      return request(answersTable(), { method: 'POST', body: { rowId, data, permissions: [] } })
    },
    async listReviews(workerIds) {
      const rows = []
      const ids = [...new Set(workerIds)]
      for (let start = 0; start < ids.length; start += 50) {
        rows.push(...await listRows(reviewsTable(), [query('equal', ids.slice(start, start + 50), 'users'), query('select', ['$id', 'rating', 'users.$id'])]))
      }
      return rows
    },
    async listRequests() {
      const rows = []
      let cursor
      for (;;) {
        const queries = [requestSelection, query('orderDesc', [], '$createdAt'), query('orderDesc', [], '$id'), query('limit', [100])]
        if (cursor) queries.push(query('cursorAfter', [cursor]))
        const page = await request(requestsTable(), { queries })
        rows.push(...page.rows)
        if (page.rows.length < 100) return rows
        const next = page.rows.at(-1).$id
        if (next === cursor) throw new ProfileError('Не удалось загрузить следующую страницу заявок.', 502)
        cursor = next
      }
    },
    createRequest(rowId, data) {
      return request(requestsTable(), { method: 'POST', body: { rowId, data, permissions: [] } })
    },
    getRequest(rowId) {
      return freshRow(requestsTable(), rowId, requestSelection)
    },
    async findUser(tgId) {
      const result = await request(config.usersTableId, { queries: [query('equal', [tgId], 'tgId'), query('limit', [2]), query('select', ['*', 'groups.*', 'cities.*'])] })
      if (result.rows.length > 1) throw new ProfileError('В Users несколько записей с одинаковым tgId. Добавьте уникальный индекс tgId и устраните дубликаты.', 409)
      const row = result.rows[0]
      return row ? { ...row, cities: cityModel(row.cities) } : null
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
      const result = await request(config.citiesTableId, { queries: [query('equal', [name], citiesNameColumn), query('limit', [2])] })
      if (result.rows.length > 1) throw new ProfileError(`В Cities несколько записей с одинаковым ${citiesNameColumn}. Устраните дубликаты и добавьте уникальный индекс ${citiesNameColumn}.`, 409)
      return cityModel(result.rows[0]) || null
    },
    createCity(name) {
      // Stable ID makes concurrent creation of the same normalized city idempotent.
      const rowId = `city${createHash('sha256').update(name).digest('hex').slice(0, 32)}`
      return request(config.citiesTableId, { method: 'POST', body: { rowId, data: { [citiesNameColumn]: name }, permissions: [] } }).then(cityModel)
    },
  }
}
