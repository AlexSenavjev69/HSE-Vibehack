import { createHash } from 'node:crypto'
import { ProfileError } from './errors.js'
import { publicRequest } from './request-domain.js'

export const relationId = (row) => typeof row === 'string' ? row : row?.$id

export function requestId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(value)) throw new ProfileError('Некорректный ID заявки.', 400)
  return value
}

export const answerId = (request, worker) => `ans_${createHash('sha256').update(`${request}:${worker}`).digest('hex').slice(0, 32)}`

export function calculateRating(reviews) {
  const scores = reviews.map((review) => review.rating).filter((score) => typeof score === 'number' && Number.isFinite(score) && score >= 1 && score <= 5)
  return { rating: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100) / 100 : 0, reviewCount: scores.length }
}

// Re-read reviews on each response view; the database stores the same value the UI shows.
export async function refreshRatings(repository, workers) {
  const unique = [...new Map(workers.filter((worker) => worker?.$id).map((worker) => [worker.$id, worker])).values()]
  const ratings = new Map()
  if (!unique.length) return ratings
  if (repository.withTransaction && !repository.inTransaction) {
    for (const worker of unique) {
      const score = await repository.withTransaction(async (tx) => {
        const current = await tx.lockUser(worker.$id)
        const reviews = await tx.listReviews([worker.$id])
        const result = calculateRating(reviews.filter((review) => relationId(review.users) === worker.$id))
        if (current.Rating !== result.rating) await tx.updateUser(worker.$id, { Rating: result.rating })
        return result
      })
      ratings.set(worker.$id, score)
    }
    return ratings
  }
  const reviews = await repository.listReviews(unique.map((worker) => worker.$id))
  for (const worker of unique) {
    const score = calculateRating(reviews.filter((review) => relationId(review.users) === worker.$id))
    if (worker.Rating !== score.rating) await repository.updateUser(worker.$id, { Rating: score.rating })
    ratings.set(worker.$id, score)
  }
  return ratings
}

export function publicOwnAnswer(row, viewerId, cityColumn) {
  const task = row.request && typeof row.request === 'object' && row.request.$id ? row.request : null
  return { id: row.$id, taskId: relationId(row.request) || null, createdAt: row.$createdAt || '', request: task ? publicRequest(task, viewerId, cityColumn) : null }
}

export async function handleAnswerRequest(body, config, repository, user) {
  if (body.action === 'answers.mine') {
    const rows = await repository.listMyAnswers(user.$id)
    await refreshRatings(repository, [user])
    return { answers: rows.map((row) => publicOwnAnswer(row, user.$id, config.citiesNameColumn)) }
  }
  const id = requestId(body.requestId)
  const task = await repository.getRequest(id)
  if (!task) throw new ProfileError('Заявка не найдена.', 404)
  const owner = relationId(task.client) === user.$id
  if (body.action === 'answers.list') {
    if (!owner) throw new ProfileError('Список исполнителей доступен только автору заявки.', 403)
    const rows = await repository.listRequestAnswers(id)
    const ratings = await refreshRatings(repository, rows.map((row) => row.worker))
    return { answers: rows.map((row) => ({
      id: row.$id, createdAt: row.$createdAt || '',
      worker: row.worker?.$id ? { id: row.worker.$id, name: row.worker.name || '', surname: row.worker.surname || '', ...ratings.get(row.worker.$id) } : null,
    })) }
  }
  if (owner) throw new ProfileError('Нельзя откликнуться на свою заявку.', 403)
  // Existing responses remain successful on retries, even if the request has since closed.
  let answer = await repository.findAnswer(id, user.$id)
  if (!answer) {
    if (task.status !== 'created') throw new ProfileError('Заявка больше не принимает отклики.', 409)
    await refreshRatings(repository, [user])
    try { answer = await repository.createAnswer(answerId(id, user.$id), { request: id, worker: user.$id }) }
    catch (error) {
      if (error.status !== 409) throw error
      answer = await repository.findAnswer(id, user.$id)
      if (!answer) throw error
    }
  }
  return { answer: publicOwnAnswer({ ...answer, request: task }, user.$id, config.citiesNameColumn) }
}
