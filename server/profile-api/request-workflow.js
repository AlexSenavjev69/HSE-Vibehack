import { createHash } from 'node:crypto'
import { ProfileError } from './errors.js'
import { calculateRating, relationId, requestId } from './answer-domain.js'
import { publicRequest } from './request-domain.js'

export const reviewId = (id) => `rev_${createHash('sha256').update(id).digest('hex').slice(0, 32)}`
export function validateReview(input) {
  const rating = input?.rating
  const description = typeof input?.description === 'string' ? input.description.trim() : ''
  const fields = {}
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.rating = 'Выберите оценку от 1 до 5 звёзд.'
  if (!description || description.length > 2000) fields.description = 'Напишите отзыв (до 2000 символов).'
  if (Object.keys(fields).length) throw new ProfileError('Проверьте поля отзыва.', 422, fields)
  return { rating, description }
}

export async function handleRequestWorkflow(body, config, repository, user) {
  const id = requestId(body.requestId)
  const initial = await repository.getRequest(id)
  if (!initial) throw new ProfileError('Заявка не найдена.', 404)
  if (relationId(initial.client) !== user.$id) throw new ProfileError('Управлять заявкой может только её автор.', 403)
  const review = body.action === 'requests.review' ? validateReview(body.review) : null
  const selectedAnswer = body.action === 'requests.confirm' ? requestId(body.answerId) : null
  return repository.withTransaction(async (tx) => {
    let task = await tx.lockRequest(id)
    if (relationId(task.client) !== user.$id) throw new ProfileError('Управлять заявкой может только её автор.', 403)
    const done = () => ({ request: publicRequest(task, user.$id, config.citiesNameColumn) })
    if (body.action === 'requests.confirm') {
      const answer = await tx.getAnswer(selectedAnswer)
      if (!answer || relationId(answer.request) !== id) throw new ProfileError('Отклик не относится к этой заявке.', 422)
      if (!answer.worker?.$id || answer.worker.$id === user.$id) throw new ProfileError('Этот исполнитель недоступен.', 409)
      if (task.status !== 'created') {
        if (['in_progress', 'completed', 'archived'].includes(task.status) && relationId(task.worker) === answer.worker.$id) return done()
        throw new ProfileError('Исполнитель уже выбран или заявка закрыта. Обновите страницу.', 409)
      }
      await tx.updateRequest(id, { worker: answer.worker.$id, status: 'in_progress' })
      task = { ...task, worker: answer.worker, status: 'in_progress' }
      return done()
    }
    if (body.action === 'requests.complete') {
      if (['completed', 'archived'].includes(task.status)) return done()
      if (task.status !== 'in_progress' || !relationId(task.worker)) throw new ProfileError('Сначала подтвердите исполнителя заявки.', 409)
      await tx.updateRequest(id, { status: 'completed' })
      task = { ...task, status: 'completed' }
      return done()
    }
    const workerId = relationId(task.worker)
    if (!workerId) throw new ProfileError('У заявки нет исполнителя для отзыва.', 409)
    if (!['completed', 'archived'].includes(task.status)) throw new ProfileError('Отзыв можно оставить после завершения заявки.', 409)
    const existing = await tx.getReview(reviewId(id))
    if (existing && (relationId(existing.users) !== workerId || relationId(existing.request) !== id)) throw new ProfileError('Отзыв связан с другой заявкой или исполнителем.', 409)
    if (task.status === 'archived') {
      if (!existing) throw new ProfileError('Заявка уже в архиве.', 409)
      return done()
    }
    // Every rating writer locks the same user before reading reviews. Concurrent
    // reviews of different requests retry instead of overwriting the average.
    await tx.lockUser(workerId)
    const reviews = await tx.listReviews([workerId])
    const saved = existing || { $id: reviewId(id), ...review, users: workerId, request: id }
    if (!existing) await tx.createReview(saved.$id, { ...review, users: workerId, request: id })
    // Appwrite 1.9.6 listRows may omit staged creates; include the new review here.
    const score = calculateRating([...reviews.filter((entry) => relationId(entry.users) === workerId && entry.$id !== saved.$id), saved])
    await tx.updateUser(workerId, { Rating: score.rating })
    await tx.updateRequest(id, { status: 'archived' })
    task = { ...task, status: 'archived' }
    return { ...done(), rating: score.rating }
  })
}
