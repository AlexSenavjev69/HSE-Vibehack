import { loadEnv } from 'vite'
const env = loadEnv('development', process.cwd(), '')
const endpoint = env.VITE_APPWRITE_ENDPOINT?.replace(/\/$/, '')
const database = env.VITE_APPWRITE_DATABASE_ID
const headers = { 'Content-Type': 'application/json', 'X-Appwrite-Project': env.VITE_APPWRITE_PROJECT_ID, 'X-Appwrite-Key': env.APPWRITE_API_KEY }
if (!endpoint || !database || !headers['X-Appwrite-Key']) throw new Error('Заполните настройки Appwrite в .env')
async function api(path, method = 'GET', body) {
  const response = await fetch(`${endpoint}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) })
  const data = await response.json()
  if (!response.ok) { const error = new Error(`${response.status}: ${data.message}`); error.status = response.status; throw error }
  return data
}
const columns = [
  { table: env.VITE_APPWRITE_REQUESTS_TABLE_ID, label: 'Requests.worker', key: 'worker', relatedTableId: env.VITE_APPWRITE_USERS_TABLE_ID },
  { table: env.VITE_APPWRITE_REVIEWS_TABLE_ID, label: 'Reviews.request', key: 'request', relatedTableId: env.VITE_APPWRITE_REQUESTS_TABLE_ID },
]
for (const column of columns) {
  if (!column.table || !column.relatedTableId) throw new Error(`Не заданы ID таблиц для ${column.label}`)
  const path = `/tablesdb/${database}/tables/${column.table}/columns`
  let existing
  try { existing = await api(`${path}/${column.key}`) } catch (error) { if (error.status !== 404) throw error }
  if (!existing) {
    await api(`${path}/relationship`, 'POST', { key: column.key, relatedTableId: column.relatedTableId, type: 'manyToOne', twoWay: false, onDelete: 'setNull' })
    console.log(`Создана связь ${column.label}`)
  }
  for (let attempt = 0; attempt < 25; attempt++) {
    const current = await api(`${path}/${column.key}`)
    if (current.type !== 'relationship' || current.relatedTable !== column.relatedTableId || current.relationType !== 'manyToOne' || current.side !== 'parent') throw new Error(`Связь ${column.label} имеет другую схему; существующая колонка не изменена.`)
    if (current.status === 'available') { console.log(`${column.label}: available`); break }
    if (current.status === 'failed' || attempt === 24) throw new Error(`${column.label}: ${current.status}; ${current.error || 'ожидание завершено'}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
// Probe transaction support using an empty transaction, without touching application rows.
const tx = await api('/tablesdb/transactions', 'POST', { ttl: 60 })
await api(`/tablesdb/transactions/${tx.$id}`, 'PATCH', { rollback: true })
console.log('Транзакции доступны. Существующие строки не изменены.')
