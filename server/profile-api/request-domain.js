export const categories = [
  { id: 'household', label: 'Бытовая помощь', icon: 'bag', tone: 'blue' },
  { id: 'digital', label: 'Цифровая помощь', icon: 'laptop', tone: 'lavender' },
  { id: 'home', label: 'Дом и животные', icon: 'plant', tone: 'green' },
  { id: 'study', label: 'Учёба и документы', icon: 'book', tone: 'peach' },
  { id: 'support', label: 'Поддержка и забота', icon: 'heart', tone: 'pink' },
  { id: 'other', label: 'Другая помощь', icon: 'sparkles', tone: 'yellow' },
]
export const requestLimits = { title: 90, description: 2000, reward: 500 }
export function validateRequest(input = {}) {
  input = input && typeof input === 'object' ? input : {}
  const text = (value) => typeof value === 'string' ? value.trim() : ''
  const title = text(input.title)
  const description = text(input.description)
  const reward = text(input.reward)
  const category = categories.find((item) => item.id === input.category)
  const errors = {}
  if (title.length < 4 || title.length > requestLimits.title) errors.title = 'Название должно содержать от 4 до 90 символов.'
  if (description.length < 10 || description.length > requestLimits.description) errors.description = 'Опишите задачу: от 10 до 2000 символов.'
  if (reward.length > requestLimits.reward) errors.reward = 'Награда: не более 500 символов.'
  if (!category) errors.category = 'Выберите категорию помощи.'
  if (typeof input.urgent !== 'boolean' || typeof input.online !== 'boolean') errors.tags = 'Укажите отметки «Срочно» и «Онлайн».'
  return { valid: Object.keys(errors).length === 0, errors, data: {
    name: title, description, reward,
    tags: [...(category ? [category.label] : []), ...(input.urgent === true ? ['срочно'] : []), ...(input.online === true ? ['онлайн'] : [])],
  } }
}

export function publicRequest(row, viewerId, cityColumn = 'name') {
  const client = row.client && typeof row.client === 'object' ? row.client : {}
  const clientId = typeof row.client === 'string' ? row.client : client.$id
  const workerId = typeof row.worker === 'string' ? row.worker : row.worker?.$id
  const tags = Array.isArray(row.tags) ? row.tags.filter((tag) => typeof tag === 'string') : []
  const lowerTags = tags.map((tag) => tag.toLocaleLowerCase('ru-RU'))
  const category = categories.find((item) => lowerTags.includes(item.label.toLocaleLowerCase('ru-RU'))) || categories.at(-1)
  return {
    id: row.$id, title: row.name || 'Без названия', description: row.description || '',
    reward: row.reward || '', tags, status: row.status || 'unknown', category: category.id,
    urgent: lowerTags.includes('срочно'), online: lowerTags.includes('онлайн'),
    owner: clientId === viewerId, name: [client.name, client.surname].filter(Boolean).join(' ') || 'Участник сообщества',
    city: client.cities?.[cityColumn] || '', district: client.district || '', tone: category.tone,
    createdAt: row.$createdAt || '',
    worker: workerId ? { id: workerId, name: row.worker?.name || '', surname: row.worker?.surname || '' } : null,
    isWorker: Boolean(workerId && workerId === viewerId),
  }
}
