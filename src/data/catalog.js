export { categories } from '../../server/profile-api/request-domain.js'
export function plural(number, forms = ['заявка', 'заявки', 'заявок']) {
  const lastTwo = number % 100
  const last = number % 10
  return `${number} ${forms[lastTwo > 10 && lastTwo < 20 ? 2 : last === 1 ? 0 : last > 1 && last < 5 ? 1 : 2]}`
}
export function locationLabel(task) {
  if (task.online) return 'Можно помочь онлайн'
  return [task.city, task.district].filter(Boolean).join(', ') || 'Место уточняется у автора'
}
export const statusLabels = { created: 'Ищет помощника', in_progress: 'В работе', completed: 'Завершена', archived: 'В архиве' }
export function requestDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
