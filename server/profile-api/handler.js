import { resolveIdentity } from './telegram.js'
import { createRepository } from './repository.js'
import { ProfileError } from './errors.js'
import { isProfileReady, publicProfile, validateProfile } from './domain.js'
import { publicRequest, validateRequest } from './request-domain.js'
import { createHash } from 'node:crypto'
import { handleAnswerRequest } from './answer-domain.js'
import { handleRequestWorkflow } from './request-workflow.js'
import { requestId } from './answer-domain.js'

export function readConfig(env, overrides = {}) {
  return {
    endpoint: env.APPWRITE_FUNCTION_API_ENDPOINT || env.VITE_APPWRITE_ENDPOINT,
    projectId: env.APPWRITE_FUNCTION_PROJECT_ID || env.VITE_APPWRITE_PROJECT_ID,
    databaseId: env.APPWRITE_DATABASE_ID || env.VITE_APPWRITE_DATABASE_ID,
    usersTableId: env.APPWRITE_USERS_TABLE_ID || env.VITE_APPWRITE_USERS_TABLE_ID,
    citiesTableId: env.APPWRITE_CITIES_TABLE_ID || env.VITE_APPWRITE_CITIES_TABLE_ID,
    citiesNameColumn: env.APPWRITE_CITIES_NAME_COLUMN || 'name',
    requestsTableId: env.APPWRITE_REQUESTS_TABLE_ID || env.VITE_APPWRITE_REQUESTS_TABLE_ID,
    answersTableId: env.APPWRITE_REQUESTS_ANSWERS_TABLE_ID || env.VITE_APPWRITE_REQUESTS_ANSWERS_TABLE_ID,
    reviewsTableId: env.APPWRITE_REVIEWS_TABLE_ID || env.VITE_APPWRITE_REVIEWS_TABLE_ID,
    apiKey: env.APPWRITE_API_KEY,
    botToken: env.TELEGRAM_BOT_TOKEN,
    useTestIdentity: env.VITE_USE_TEST_TELEGRAM_ID === 'true',
    testTgId: env.VITE_TEST_TELEGRAM_ID?.trim(),
    allowTestIdentity: false,
    ...overrides,
  }
}

async function findOrCreateUser(repository, tgId) {
  const existing = await repository.findUser(tgId)
  if (existing) return existing
  try { return await repository.createUser(tgId) }
  catch (error) {
    // Concurrent launches, retries and React StrictMode must not create duplicates.
    if (error.status !== 409) throw error
    const created = await repository.findUser(tgId)
    if (!created) throw error
    return created
  }
}

async function findOrCreateCity(repository, name) {
  const existing = await repository.findCity(name)
  if (existing) return existing
  try { return await repository.createCity(name) }
  catch (error) {
    if (error.status !== 409) throw error
    const created = await repository.findCity(name)
    if (!created) throw error
    return created
  }
}

export async function handleProfileRequest(body, config, repositoryOverride) {
  try {
    if (!body || typeof body !== 'object' || !['bootstrap', 'save', 'requests.list', 'requests.get', 'requests.create', 'requests.confirm', 'requests.complete', 'requests.review', 'answers.mine', 'answers.list', 'answers.create'].includes(body.action)) throw new ProfileError('Неизвестное действие.', 400)
    const tgId = resolveIdentity(body, config)
    const repository = repositoryOverride || createRepository(config)
    let row = await findOrCreateUser(repository, tgId)
    if (body.action.startsWith('answers.')) {
      if (!isProfileReady(row)) throw new ProfileError('Сначала заполните профиль.', 403)
      return { status: 200, body: await handleAnswerRequest(body, config, repository, row) }
    }
    if (body.action.startsWith('requests.')) {
      if (!isProfileReady(row)) throw new ProfileError('Сначала заполните профиль.', 403)
      if (['requests.confirm', 'requests.complete', 'requests.review'].includes(body.action)) return { status: 200, body: await handleRequestWorkflow(body, config, repository, row) }
      if (body.action === 'requests.get') {
        const request = await repository.getRequest(requestId(body.requestId))
        if (!request) throw new ProfileError('Заявка не найдена.', 404)
        return { status: 200, body: { request: publicRequest(request, row.$id, config.citiesNameColumn) } }
      }
      if (body.action === 'requests.list') {
        const rows = await repository.listRequests()
        return { status: 200, body: { requests: rows.map((request) => publicRequest(request, row.$id, config.citiesNameColumn)) } }
      }
      const validated = validateRequest(body.request)
      if (!validated.valid) throw new ProfileError('Проверьте поля заявки.', 422, validated.errors)
      if (typeof body.submissionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.submissionId)) throw new ProfileError('Не удалось определить отправку заявки. Обновите страницу.', 400)
      const id = `req_${createHash('sha256').update(`${row.$id}:${body.submissionId}`).digest('hex').slice(0, 32)}`
      let request
      try { request = await repository.createRequest(id, { ...validated.data, client: row.$id, status: 'created' }) }
      catch (error) {
        if (error.status !== 409) throw error
        request = await repository.getRequest(id)
        const ownerId = typeof request.client === 'string' ? request.client : request.client?.$id
        if (ownerId !== row.$id) throw new ProfileError('Не удалось подтвердить автора заявки.', 409)
      }
      // A create response may contain only the relation ID. Expand from the authenticated user.
      return { status: 200, body: { request: publicRequest({ ...request, client: { ...row, cities: row.cities ? { ...row.cities, [config.citiesNameColumn || 'name']: row.cities.name } : null } }, row.$id, config.citiesNameColumn) } }
    }
    if (body.action === 'save') {
      const validated = validateProfile(body.profile)
      if (!validated.valid) throw new ProfileError('Заполните все поля профиля.', 422, validated.errors)
      const { city: cityName, ...profileData } = validated.data
      const city = await findOrCreateCity(repository, cityName)
      // Identity, groups and completion status cannot be overwritten by the browser.
      await repository.updateUser(row.$id, { ...profileData, cities: city.$id, isProfileCompleted: true })
      row = await repository.findUser(tgId)
      if (!isProfileReady(row)) throw new ProfileError('Не удалось подтвердить сохранение профиля. Попробуйте ещё раз.', 502)
    }
    return { status: 200, body: { profile: publicProfile(row) } }
  } catch (error) {
    if (error instanceof ProfileError) return { status: error.status, body: { error: error.message, fields: error.fields } }
    return { status: 500, body: { error: 'Не удалось выполнить запрос. Попробуйте ещё раз.' } }
  }
}
