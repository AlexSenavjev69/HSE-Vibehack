import { resolveIdentity } from './telegram.js'
import { createRepository } from './repository.js'
import { ProfileError } from './errors.js'
import { isProfileReady, publicProfile, validateProfile } from './domain.js'

export function readConfig(env, overrides = {}) {
  return {
    endpoint: env.APPWRITE_FUNCTION_API_ENDPOINT || env.VITE_APPWRITE_ENDPOINT,
    projectId: env.APPWRITE_FUNCTION_PROJECT_ID || env.VITE_APPWRITE_PROJECT_ID,
    databaseId: env.APPWRITE_DATABASE_ID || env.VITE_APPWRITE_DATABASE_ID,
    usersTableId: env.APPWRITE_USERS_TABLE_ID || env.VITE_APPWRITE_USERS_TABLE_ID,
    citiesTableId: env.APPWRITE_CITIES_TABLE_ID || env.VITE_APPWRITE_CITIES_TABLE_ID,
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
    if (!body || typeof body !== 'object' || !['bootstrap', 'save'].includes(body.action)) throw new ProfileError('Неизвестное действие.', 400)
    const tgId = resolveIdentity(body, config)
    const repository = repositoryOverride || createRepository(config)
    let row = await findOrCreateUser(repository, tgId)
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
    return { status: 500, body: { error: 'Не удалось загрузить или сохранить профиль. Попробуйте ещё раз.' } }
  }
}
