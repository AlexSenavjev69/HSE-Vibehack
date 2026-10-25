// Shared by the server and the profile form. No credentials or I/O here.
export const limits = { name: 80, tag: 40, tags: 20, city: 120, district: 120, time: 200 }

export function normalizeCity(value) {
  return typeof value === 'string' ? value.toLocaleLowerCase('ru-RU').replace(/\s+/gu, '') : ''
}

function cityName(profile) {
  return profile.city ?? (typeof profile.cities === 'object' ? profile.cities?.name : '')
}

export function groupIds(groups = []) {
  if (!Array.isArray(groups)) return []
  return [...new Set(groups.map((group) => typeof group === 'string' ? group : group?.$id).filter((id) => typeof id === 'string' && id))]
}

export function validateProfile(input = {}) {
  input = input && typeof input === 'object' ? input : {}
  const text = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  const name = text(input.name)
  const surname = text(input.surname)
  const rawPhone = text(input.phone)
  const phone = rawPhone.replace(/[\s()-]/g, '')
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(text).filter(Boolean))] : []
  const city = normalizeCity(cityName(input))
  const district = text(input.district)
  const time = text(input.time)
  const errors = {}
  if (!name || name.length > limits.name) errors.name = `Укажите имя (до ${limits.name} символов).`
  if (!surname || surname.length > limits.name) errors.surname = `Укажите фамилию (до ${limits.name} символов).`
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) errors.phone = 'Укажите телефон с кодом страны, например +7 999 123-45-67.'
  if (!tags.length || tags.length > limits.tags || tags.some((tag) => tag.length > limits.tag)) errors.tags = `Выберите от 1 до ${limits.tags} навыков, каждый до ${limits.tag} символов.`
  if (!city || city.length > limits.city || !/\p{L}/u.test(city)) errors.city = `Укажите город (до ${limits.city} символов).`
  if (!district || district.length > limits.district) errors.district = `Укажите район (до ${limits.district} символов).`
  if (!time || time.length > limits.time) errors.time = `Укажите, когда вы свободны (до ${limits.time} символов).`
  return { data: { name, surname, phone, tags, city, district, time }, errors, valid: Object.keys(errors).length === 0 }
}

export function isProfileReady(profile) {
  return profile?.isProfileCompleted === true && validateProfile(profile).valid
}

export function publicProfile(row) {
  return {
    $id: row.$id,
    $createdAt: row.$createdAt,
    tgId: row.tgId,
    name: row.name || '',
    surname: row.surname || '',
    phone: row.phone || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    groups: groupIds(row.groups),
    cities: typeof row.cities === 'string' ? row.cities : row.cities?.$id || null,
    city: cityName(row) || '',
    district: row.district || '',
    time: row.time || '',
    isProfileCompleted: row.isProfileCompleted === true,
  }
}
