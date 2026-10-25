import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { handleProfileRequest, readConfig } from '../server/profile-api/handler.js'
import { createRepository } from '../server/profile-api/repository.js'
import { ProfileError } from '../server/profile-api/errors.js'
import { isProfileReady, normalizeCity, validateProfile } from '../server/profile-api/domain.js'
import { resolveIdentity, validateTelegramData } from '../server/profile-api/telegram.js'

const config = { allowTestIdentity: true, useTestIdentity: true, testTgId: '123456789' }
const validProfile = { name: 'Иван', surname: 'Иванов', phone: '+7 (999) 123-45-67', tags: ['Помощь с техникой'], city: ' Нижний Новгород ', district: 'Советский', time: 'Будни после 18:00' }
const body = (action, profile) => ({ action, testTgId: config.testTgId, profile })

function memoryRepository() {
  let row
  const cities = new Map()
  const calls = { userCreates: 0, cityCreates: 0, updates: [] }
  return {
    calls, cities,
    get row() { return row },
    set row(value) { row = value },
    async findUser(tgId) { return row?.tgId === tgId ? row : null },
    async createUser(tgId) {
      calls.userCreates++
      if (row) throw new ProfileError('Conflict', 409)
      row = { $id: `tg_${tgId}`, tgId, name: '', surname: '', phone: '', tags: [], groups: [], cities: null, time: '', district: '', isProfileCompleted: false }
      return row
    },
    async updateUser(id, data) {
      assert.equal(id, row.$id)
      calls.updates.push(data)
      row = { ...row, ...data, cities: [...cities.values()].find((city) => city.$id === data.cities) }
      return row
    },
    async findCity(name) { return cities.get(name) || null },
    async createCity(name) {
      calls.cityCreates++
      if (cities.has(name)) throw new ProfileError('Conflict', 409)
      const city = { $id: `city-${cities.size}`, name }
      cities.set(name, city)
      return city
    },
  }
}

test('first launch creates a blank draft; repeated launch reuses the same user', async () => {
  const repository = memoryRepository()
  const first = await handleProfileRequest(body('bootstrap'), config, repository)
  assert.equal(first.status, 200)
  assert.equal(first.body.profile.tgId, config.testTgId)
  assert.equal(first.body.profile.isProfileCompleted, false)
  assert.equal(first.body.profile.name, '')
  assert.equal(first.body.profile.cities, null)
  assert.deepEqual(first.body.profile.groups, [])
  const second = await handleProfileRequest(body('bootstrap'), config, repository)
  assert.deepEqual(second.body.profile, first.body.profile)
  assert.equal(repository.calls.userCreates, 1)
})

test('concurrent launches create only one user', async () => {
  const repository = memoryRepository()
  const results = await Promise.all([handleProfileRequest(body('bootstrap'), config, repository), handleProfileRequest(body('bootstrap'), config, repository)])
  assert.ok(results.every((result) => result.status === 200))
  assert.equal(results[0].body.profile.$id, results[1].body.profile.$id)
})

test('complete profile needs no groups and persists normalized city relation', async () => {
  const repository = memoryRepository()
  const result = await handleProfileRequest(body('save', validProfile), config, repository)
  assert.equal(result.status, 200)
  assert.equal(result.body.profile.isProfileCompleted, true)
  assert.equal(isProfileReady(result.body.profile), true)
  assert.deepEqual(result.body.profile.groups, [])
  assert.equal(result.body.profile.city, 'нижнийновгород')
  assert.equal(result.body.profile.phone, '+79991234567')
  assert.equal(repository.calls.updates[0].cities, 'city-0')
  assert.equal(repository.calls.updates[0].city, undefined)
  assert.equal(repository.calls.updates[0].time, validProfile.time)
  assert.equal(repository.calls.updates[0].district, validProfile.district)
  const reopened = await handleProfileRequest(body('bootstrap'), config, repository)
  assert.equal(isProfileReady(reopened.body.profile), true)
})

test('existing city is reused, including on another save with different whitespace/case', async () => {
  const repository = memoryRepository()
  repository.cities.set('нижнийновгород', { $id: 'already-there', name: 'нижнийновгород' })
  for (const city of ['Нижний Новгород', 'НИЖНИЙ\tНОВГОРОД', 'нижний\u00a0новгород']) {
    const result = await handleProfileRequest(body('save', { ...validProfile, city }), config, repository)
    assert.equal(result.body.profile.cities, 'already-there')
  }
  assert.equal(repository.calls.cityCreates, 0)
})

test('a city created concurrently is looked up again after a conflict', async () => {
  const repository = memoryRepository()
  repository.createCity = async (name) => {
    repository.cities.set(name, { $id: 'concurrent-city', name })
    throw new ProfileError('Conflict', 409)
  }
  const result = await handleProfileRequest(body('save', validProfile), config, repository)
  assert.equal(result.status, 200)
  assert.equal(result.body.profile.cities, 'concurrent-city')
})

for (const field of ['name', 'surname', 'phone', 'tags', 'city', 'district', 'time']) {
  test(`missing ${field} cannot complete a profile or create a city`, async () => {
    const repository = memoryRepository()
    const result = await handleProfileRequest(body('save', { ...validProfile, [field]: field === 'tags' ? [] : ' ' }), config, repository)
    assert.equal(result.status, 422)
    assert.ok(result.body.fields[field])
    assert.equal(repository.row.isProfileCompleted, false)
    assert.equal(repository.calls.cityCreates, 0)
    assert.equal(repository.calls.updates.length, 0)
  })
}

test('saving ignores forged identity, completion flags, city IDs and group membership', async () => {
  const repository = memoryRepository()
  await handleProfileRequest(body('bootstrap'), config, repository)
  repository.row.groups = ['existing-group']
  const result = await handleProfileRequest(body('save', { ...validProfile, $id: 'someone-else', tgId: '999', isProfileCompleted: false, groups: ['forged-group'], cities: 'forged-city' }), config, repository)
  assert.equal(result.status, 200)
  assert.equal(result.body.profile.tgId, config.testTgId)
  assert.deepEqual(result.body.profile.groups, ['existing-group'])
  assert.equal(result.body.profile.isProfileCompleted, true)
  assert.equal(repository.calls.updates[0].groups, undefined)
  assert.equal(repository.calls.updates[0].tgId, undefined)
})

test('database save error never marks a draft complete', async () => {
  const repository = memoryRepository()
  repository.updateUser = async () => { throw new ProfileError('Database unavailable', 502) }
  const result = await handleProfileRequest(body('save', validProfile), config, repository)
  assert.equal(result.status, 502)
  assert.equal(repository.row.isProfileCompleted, false)
})

test('legacy or tampered completion flag alone does not grant access', () => {
  assert.equal(isProfileReady({ isProfileCompleted: true }), false)
  assert.equal(isProfileReady({ ...validProfile, isProfileCompleted: 'true' }), false)
  assert.equal(isProfileReady({ ...validProfile, isProfileCompleted: false }), false)
  assert.equal(isProfileReady({ ...validProfile, isProfileCompleted: true, groups: [] }), true)
  assert.equal(isProfileReady({ ...validProfile, city: undefined, cities: { $id: 'city', name: 'москва' }, isProfileCompleted: true }), true)
  assert.equal(validateProfile(null).valid, false)
  assert.equal(normalizeCity('  Санкт-\tПЕТЕРБУРГ '), 'санкт-петербург')
})

const botToken = '123456:unit-test-token'
const now = 1777777777000
function signedData({ date = Math.floor(now / 1000), id = 123456789, extra = {} } = {}) {
  const fields = { auth_date: String(date), user: JSON.stringify({ id, first_name: 'Иван' }), query_id: 'AA-test', ...extra }
  const data = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secret).update(data).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

test('Telegram signed launch validates; tampered, expired, future and duplicate data fail', () => {
  assert.equal(validateTelegramData(signedData(), botToken, now), '123456789')
  assert.equal(validateTelegramData(signedData({ extra: { signature: 'some-signature' } }), botToken, now), '123456789')
  assert.throws(() => validateTelegramData(signedData().replace('123456789', '987654321'), botToken, now), { status: 401 })
  assert.throws(() => validateTelegramData(signedData({ date: now / 1000 - 3601 }), botToken, now), { status: 401 })
  assert.throws(() => validateTelegramData(signedData({ date: now / 1000 + 100 }), botToken, now), { status: 401 })
  assert.throws(() => validateTelegramData(`${signedData()}&user=forged`, botToken, now), { status: 401 })
  assert.throws(() => validateTelegramData(signedData({ id: -1 }), botToken, now), { status: 401 })
})

test('test identity cannot be changed and cannot be used in a deployed Function', () => {
  assert.equal(resolveIdentity(body('bootstrap'), config), config.testTgId)
  assert.throws(() => resolveIdentity({ testTgId: '999' }, config), { status: 403 })
  assert.throws(() => resolveIdentity(body('bootstrap'), { ...config, allowTestIdentity: false }), { status: 403 })
  const deployedConfig = readConfig({ VITE_USE_TEST_TELEGRAM_ID: 'true', VITE_TEST_TELEGRAM_ID: config.testTgId })
  assert.throws(() => resolveIdentity(body('bootstrap'), deployedConfig), { status: 403 })
})

test('missing Telegram identity does not touch the database', async () => {
  const repository = memoryRepository()
  const result = await handleProfileRequest({ action: 'bootstrap', tgId: '999' }, { botToken }, repository)
  assert.equal(result.status, 401)
  assert.equal(repository.calls.userCreates, 0)
})

test('repository sends scoped queries, blank user fields, relationship IDs and private permissions', async () => {
  const calls = []
  const repository = createRepository({ endpoint: 'https://example.invalid/v1', projectId: 'project', databaseId: 'database', usersTableId: 'users', citiesTableId: 'cities', apiKey: 'test-key' }, async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : null })
    return new Response(JSON.stringify({ rows: [], $id: 'created' }), { status: 200 })
  })
  await repository.findUser('123')
  const userQuery = calls[0].url.searchParams.getAll('queries[]').map(JSON.parse)
  assert.ok(userQuery.some((query) => query.attribute === 'tgId' && query.values[0] === '123'))
  assert.ok(userQuery.some((query) => query.method === 'select' && query.values.includes('cities.*')))
  await repository.createUser('123')
  assert.deepEqual(calls[1].body, { rowId: 'tg_123', data: { tgId: '123', name: '', surname: '', phone: '', tags: [], groups: [], cities: null, time: '', district: '', isProfileCompleted: false }, permissions: [] })
  await repository.findCity('москва')
  assert.ok(calls[2].url.pathname.endsWith('/tables/cities/rows'))
  assert.ok(calls[2].url.searchParams.getAll('queries[]').map(JSON.parse).some((query) => query.attribute === 'name' && query.values[0] === 'москва'))
  await repository.createCity('москва')
  await repository.createCity('москва')
  assert.equal(calls[3].body.rowId, calls[4].body.rowId)
  assert.equal(calls[3].body.rowId.length, 36)
  assert.deepEqual(calls[3].body.data, { name: 'москва' })
  assert.deepEqual(calls[3].body.permissions, [])
  await repository.updateUser('tg_123', { cities: 'city-id', time: 'вечером' })
  assert.equal(calls[5].method, 'PATCH')
  assert.ok(calls[5].url.pathname.endsWith('/rows/tg_123'))
  assert.equal(calls[5].headers['X-Appwrite-Key'], 'test-key')
})
