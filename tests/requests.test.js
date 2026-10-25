import test from 'node:test'
import assert from 'node:assert/strict'
import { handleProfileRequest } from '../server/profile-api/handler.js'
import { createRepository } from '../server/profile-api/repository.js'
import { ProfileError } from '../server/profile-api/errors.js'
import { publicRequest } from '../server/profile-api/request-domain.js'

const config = { allowTestIdentity: true, useTestIdentity: true, testTgId: '123456789', citiesNameColumn: 'cityName' }
const user = { $id: 'author', tgId: config.testTgId, name: 'Иван', surname: 'Иванов', phone: '+79991234567', tags: ['Помощь'], groups: [], cities: { $id: 'city', name: 'москва', cityName: 'москва' }, district: 'Хамовники', time: 'Вечером', isProfileCompleted: true }
const request = { title: 'Помочь собрать стол', description: 'Нужно помочь собрать стол, все инструменты есть.', category: 'household', reward: 'Покормлю обедом', urgent: true, online: true }
const submissionId = 'aabbccdd-1234-4321-abcd-112233445566'
const body = (action, extra = {}) => ({ action, testTgId: config.testTgId, ...extra })
function repository() {
  const rows = new Map()
  const repo = {
    rows, creates: 0,
    async findUser() { return user },
    async listRequests() { return [...rows.values()].map((row) => ({ ...row, client: user })) },
    async getRequest(id) { return rows.get(id) },
    async createRequest(id, data) {
      if (rows.has(id)) throw new ProfileError('Conflict', 409)
      repo.creates++
      const row = { $id: id, $createdAt: '2026-10-25T12:00:00.000Z', ...data }
      rows.set(id, row)
      return row
    },
  }
  return repo
}

test('empty Requests returns an empty feed without sample rows', async () => {
  const result = await handleProfileRequest(body('requests.list'), config, repository())
  assert.equal(result.status, 200)
  assert.deepEqual(result.body.requests, [])
})

test('publishing persists correct columns, author, tags and reward; a fresh list returns the request', async () => {
  const repo = repository()
  const result = await handleProfileRequest(body('requests.create', { request: { ...request, client: 'other-user', status: 'completed', name: 'forged' }, submissionId }), config, repo)
  assert.equal(result.status, 200)
  const row = [...repo.rows.values()][0]
  assert.equal(row.name, request.title)
  assert.equal(row.description, request.description)
  assert.equal(row.reward, request.reward)
  assert.equal(row.client, user.$id)
  assert.equal(row.status, 'created')
  assert.deepEqual(row.tags, ['Бытовая помощь', 'срочно', 'онлайн'])
  assert.equal(row.title, undefined)
  assert.equal(row.urgent, undefined)
  assert.equal(row.online, undefined)
  assert.equal(result.body.request.owner, true)
  assert.equal(result.body.request.city, 'москва')
  const list = await handleProfileRequest(body('requests.list'), config, repo)
  assert.equal(list.body.requests.length, 1)
  assert.equal(list.body.requests[0].id, result.body.request.id)
  assert.equal(list.body.requests[0].reward, request.reward)
  assert.equal(list.body.requests[0].urgent, true)
  assert.equal(list.body.requests[0].online, true)
})

test('retries and concurrent submission create one row', async () => {
  const repo = repository()
  const payload = body('requests.create', { request, submissionId })
  const [first, second] = await Promise.all([handleProfileRequest(payload, config, repo), handleProfileRequest(payload, config, repo)])
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(first.body.request.id, second.body.request.id)
  assert.equal(repo.creates, 1)
  assert.equal(repo.rows.size, 1)
})

test('empty reward and unselected tags are saved without adding urgent/online', async () => {
  const repo = repository()
  const result = await handleProfileRequest(body('requests.create', { request: { ...request, reward: '', urgent: false, online: false }, submissionId }), config, repo)
  assert.equal(result.status, 200)
  assert.deepEqual([...repo.rows.values()][0].tags, ['Бытовая помощь'])
  assert.equal(result.body.request.reward, '')
})

test('invalid form and incomplete profile cannot create requests or list other users', async () => {
  const repo = repository()
  let result = await handleProfileRequest(body('requests.create', { request: { ...request, title: ' ', reward: 'x'.repeat(501) }, submissionId }), config, repo)
  assert.equal(result.status, 422)
  assert.ok(result.body.fields.title)
  assert.ok(result.body.fields.reward)
  assert.equal(repo.rows.size, 0)
  repo.findUser = async () => ({ ...user, isProfileCompleted: false })
  for (const action of ['requests.create', 'requests.list']) {
    result = await handleProfileRequest(body(action, { request, submissionId }), config, repo)
    assert.equal(result.status, 403)
  }
  assert.equal(repo.rows.size, 0)
})

test('a failed database write does not report successful publication', async () => {
  const repo = repository()
  repo.createRequest = async () => { throw new ProfileError('Appwrite unavailable', 502) }
  const result = await handleProfileRequest(body('requests.create', { request, submissionId }), config, repo)
  assert.equal(result.status, 502)
  assert.equal(result.body.request, undefined)
})

test('feed does not expose phone, Telegram ID, groups or unrelated author data', () => {
  const result = publicRequest({ $id: 'request', name: 'Help', description: 'Details', client: { ...user, secret: 'private' }, tags: ['СРОЧНО', 'ОНЛАЙН'], status: 'created' }, 'another-viewer', 'cityName')
  assert.equal(result.owner, false)
  assert.equal(result.urgent, true)
  assert.equal(result.online, true)
  assert.equal(result.city, 'москва')
  assert.equal(result.phone, undefined)
  assert.equal(result.tgId, undefined)
  assert.equal(result.client, undefined)
  assert.ok(!JSON.stringify(result).includes(user.phone))
  assert.ok(!JSON.stringify(result).includes(user.tgId))
  assert.equal(publicRequest({ $id: 'missing-author', client: null, tags: null }, user.$id).name, 'Участник сообщества')
})

test('real repository paginates all rows and creates only schema columns', async () => {
  const calls = []
  const cfg = { endpoint: 'https://example.invalid/v1', projectId: 'project', databaseId: 'db', usersTableId: 'users', citiesTableId: 'cities', citiesNameColumn: 'cityName', requestsTableId: 'requests', apiKey: 'test-key' }
  const repo = createRepository(cfg, async (url, options) => {
    const queries = url.searchParams.getAll('queries[]').map(JSON.parse)
    calls.push({ url, ...options, queries })
    if (options.method === 'POST') return new Response(JSON.stringify({ $id: 'new-request', ...JSON.parse(options.body).data }), { status: 201 })
    const offset = queries.some((query) => query.method === 'cursorAfter') ? 100 : 0
    const count = offset ? 1 : 100
    return new Response(JSON.stringify({ rows: Array.from({ length: count }, (_, index) => ({ $id: `row-${offset + index}` })) }))
  })
  const rows = await repo.listRequests()
  assert.equal(rows.length, 101)
  assert.ok(calls[1].queries.some((query) => query.method === 'cursorAfter' && query.values[0] === 'row-99'))
  const selection = calls[0].queries.find((query) => query.method === 'select').values
  assert.ok(selection.includes('client.cities.cityName'))
  assert.ok(!selection.includes('client.*'))
  assert.ok(!selection.includes('client.phone'))
  const data = { name: request.title, description: request.description, tags: ['срочно'], client: user.$id, reward: request.reward, status: 'created' }
  await repo.createRequest('new-request', data)
  assert.ok(calls[2].url.pathname.endsWith('/tables/requests/rows'))
  assert.deepEqual(JSON.parse(calls[2].body), { rowId: 'new-request', data, permissions: [] })
})
