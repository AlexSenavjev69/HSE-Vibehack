import test from 'node:test'
import assert from 'node:assert/strict'
import { handleProfileRequest } from '../server/profile-api/handler.js'
import { calculateRating } from '../server/profile-api/answer-domain.js'
import { createRepository } from '../server/profile-api/repository.js'
import { ProfileError } from '../server/profile-api/errors.js'

const profile = { name: 'Анна', surname: 'Иванова', phone: '+79991234567', tags: ['Помощь'], cities: { $id: 'city', name: 'москва', cityName: 'москва' }, district: 'Центр', time: 'Вечером', isProfileCompleted: true }
function setup() {
  const users = new Map(['owner', 'worker', 'another'].map((id, i) => [id, { ...profile, $id: id, tgId: String(100 + i), Rating: 1 }]))
  const tasks = new Map([['task', { $id: 'task', name: 'Помочь с покупками', description: 'Принести продукты из магазина.', status: 'created', client: users.get('owner') }]])
  const answers = new Map()
  const reviews = [{ $id: 'r1', users: { $id: 'worker' }, rating: 4 }, { $id: 'r2', users: 'worker', rating: 5 }, { $id: 'r3', users: 'another', rating: 2 }]
  const writes = []
  const repo = {
    async findUser(tgId) { return [...users.values()].find((user) => user.tgId === tgId) },
    async getRequest(id) { return tasks.get(id) },
    async findAnswer(requestId, workerId) { return [...answers.values()].find((row) => row.request === requestId && row.worker === workerId) },
    async createAnswer(id, data) {
      if (answers.has(id)) throw new ProfileError('Conflict', 409)
      const row = { $id: id, $createdAt: '2026-10-25T15:00:00Z', ...data }
      answers.set(id, row)
      return row
    },
    async listMyAnswers(workerId) { return [...answers.values()].filter((row) => row.worker === workerId).map((row) => ({ ...row, request: tasks.get(row.request) || null })) },
    async listRequestAnswers(id) { return [...answers.values()].filter((row) => row.request === id).map((row) => ({ ...row, worker: users.get(row.worker) || null })) },
    async listReviews() { return reviews },
    async updateUser(id, data) { writes.push({ id, data }); Object.assign(users.get(id), data) },
  }
  const call = (as, action, extra = {}) => {
    const tgId = users.get(as).tgId
    return handleProfileRequest({ action, testTgId: tgId, ...extra }, { allowTestIdentity: true, useTestIdentity: true, testTgId: tgId, citiesNameColumn: 'cityName' }, repo)
  }
  return { repo, call, users, tasks, answers, reviews, writes }
}

test('a response is persisted with authenticated worker, appears after reload and is visible to the owner', async () => {
  const { call, answers, writes } = setup()
  const created = await call('worker', 'answers.create', { requestId: 'task', worker: 'another', Rating: 5 })
  assert.equal(created.status, 200)
  assert.equal(answers.size, 1)
  const row = [...answers.values()][0]
  assert.equal(row.worker, 'worker')
  assert.equal(row.request, 'task')
  assert.deepEqual(writes, [{ id: 'worker', data: { Rating: 4.5 } }])
  const mine = await call('worker', 'answers.mine')
  assert.equal(mine.body.answers[0].id, created.body.answer.id)
  assert.equal(mine.body.answers[0].request.title, 'Помочь с покупками')
  assert.equal(mine.body.answers[0].request.owner, false)
  const owner = await call('owner', 'answers.list', { requestId: 'task' })
  assert.deepEqual(owner.body.answers[0].worker, { id: 'worker', name: 'Анна', surname: 'Иванова', rating: 4.5, reviewCount: 2 })
  assert.ok(!JSON.stringify(owner.body).includes(profile.phone))
  assert.ok(!JSON.stringify(mine.body).includes(profile.phone))
  assert.deepEqual((await call('another', 'answers.mine', { worker: 'worker' })).body.answers, [])
})

test('retries and concurrent clicks create exactly one response', async () => {
  const { call, answers, tasks } = setup()
  const payload = { requestId: 'task' }
  const results = await Promise.all(Array.from({ length: 4 }, () => call('worker', 'answers.create', payload)))
  assert.ok(results.every((result) => result.status === 200))
  assert.equal(new Set(results.map((result) => result.body.answer.id)).size, 1)
  assert.equal(answers.size, 1)
  tasks.get('task').status = 'completed'
  assert.equal((await call('worker', 'answers.create', payload)).status, 200)
  assert.equal((await call('another', 'answers.create', payload)).status, 409)
})

test('rejects own request, foreign answer lists, missing requests, invalid IDs and incomplete profiles', async () => {
  const { call, users, answers } = setup()
  assert.equal((await call('owner', 'answers.create', { requestId: 'task' })).status, 403)
  assert.equal((await call('worker', 'answers.list', { requestId: 'task' })).status, 403)
  assert.equal((await call('worker', 'answers.create', { requestId: 'missing' })).status, 404)
  assert.equal((await call('worker', 'answers.create', { requestId: '../task' })).status, 400)
  users.get('worker').isProfileCompleted = false
  for (const action of ['answers.create', 'answers.list', 'answers.mine']) assert.equal((await call('worker', action, { requestId: 'task' })).status, 403)
  assert.equal(answers.size, 0)
})

test('two different workers can reply to the same request and keep their own lists separate', async () => {
  const { call, answers } = setup()
  await call('worker', 'answers.create', { requestId: 'task' })
  await call('another', 'answers.create', { requestId: 'task' })
  assert.equal(answers.size, 2)
  const owner = await call('owner', 'answers.list', { requestId: 'task' })
  assert.equal(owner.body.answers.length, 2)
  assert.deepEqual(owner.body.answers.map((row) => row.worker.rating), [4.5, 2])
  assert.equal((await call('worker', 'answers.mine')).body.answers.length, 1)
  assert.equal((await call('another', 'answers.mine')).body.answers.length, 1)
})

test('rating includes only valid 1–5 scores and is refreshed after reviews change or disappear', async () => {
  assert.deepEqual(calculateRating([]), { rating: 0, reviewCount: 0 })
  assert.deepEqual(calculateRating([1, 2, 5, null, '5', -1, 6, Infinity, NaN].map((rating) => ({ rating }))), { rating: 2.67, reviewCount: 3 })
  const { call, reviews, users } = setup()
  await call('worker', 'answers.create', { requestId: 'task' })
  reviews.push({ users: 'worker', rating: 3 })
  const result = await call('owner', 'answers.list', { requestId: 'task' })
  assert.equal(result.body.answers[0].worker.rating, 4)
  assert.equal(users.get('worker').Rating, 4)
  reviews.splice(0)
  const empty = await call('owner', 'answers.list', { requestId: 'task' })
  assert.equal(empty.body.answers[0].worker.reviewCount, 0)
  assert.equal(users.get('worker').Rating, 0)
})

test('failed writes are not reported as successful responses; retries recover', async () => {
  const { repo, call, answers } = setup()
  const create = repo.createAnswer
  repo.createAnswer = async () => { throw new ProfileError('Appwrite unavailable', 502) }
  assert.equal((await call('worker', 'answers.create', { requestId: 'task' })).status, 502)
  assert.equal(answers.size, 0)
  repo.createAnswer = create
  assert.equal((await call('worker', 'answers.create', { requestId: 'task' })).status, 200)
})

test('deleted profiles and requests keep the remaining lists usable', async () => {
  const { call, users, tasks } = setup()
  await call('worker', 'answers.create', { requestId: 'task' })
  const worker = users.get('worker')
  users.delete('worker')
  assert.equal((await call('owner', 'answers.list', { requestId: 'task' })).body.answers[0].worker, null)
  users.set('worker', worker)
  tasks.delete('task')
  assert.equal((await call('worker', 'answers.mine')).body.answers[0].request, null)
})

test('repository filters relationships, paginates answers/reviews and writes scalar child links', async () => {
  const calls = []
  const config = { endpoint: 'https://example.invalid/v1', projectId: 'p', databaseId: 'd', usersTableId: 'u', citiesTableId: 'c', requestsTableId: 'r', answersTableId: 'a', reviewsTableId: 'v', apiKey: 'test-key', citiesNameColumn: 'cityName' }
  const repo = createRepository(config, async (url, options) => {
    const queries = url.searchParams.getAll('queries[]').map(JSON.parse)
    calls.push({ url, queries, ...options })
    if (options.method === 'POST') return new Response(JSON.stringify({ $id: 'new', ...JSON.parse(options.body).data }), { status: 201 })
    const offset = queries.some((query) => query.method === 'cursorAfter') ? 100 : 0
    return new Response(JSON.stringify({ rows: Array.from({ length: offset ? 1 : 100 }, (_, index) => ({ $id: `row-${offset + index}`, rating: 5 })) }))
  })
  assert.equal((await repo.listMyAnswers('worker')).length, 101)
  assert.ok(calls[0].queries.some((q) => q.attribute === 'worker' && q.values[0] === 'worker'))
  assert.ok(calls[0].queries.find((q) => q.method === 'select').values.includes('request.client.cities.cityName'))
  assert.equal((await repo.listRequestAnswers('task')).length, 101)
  assert.ok(calls[2].queries.some((q) => q.attribute === 'request' && q.values[0] === 'task'))
  assert.equal((await repo.listReviews(['worker'])).length, 101)
  assert.ok(calls[4].queries.some((q) => q.attribute === 'users' && q.values[0] === 'worker'))
  assert.equal(calculateRating(await repo.listReviews(['worker'])).reviewCount, 101)
  await repo.createAnswer('new', { request: 'task', worker: 'worker' })
  assert.deepEqual(JSON.parse(calls.at(-1).body), { rowId: 'new', data: { request: 'task', worker: 'worker' }, permissions: [] })
})
