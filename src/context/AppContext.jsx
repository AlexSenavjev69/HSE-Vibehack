import { useEffect, useState } from 'react'
import { categories, initialData } from '../data/demo'
import { AppContext } from './useApp'
function restoreData(storageKey) {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey))
    if (data && Array.isArray(data.tasks) && Array.isArray(data.responses)
      && data.tasks.every((task) => task && ['id', 'title', 'name', 'description', 'when', 'district', 'tone', 'rating'].every((key) => typeof task[key] === 'string') && typeof task.deals === 'number' && ['active', 'completed'].includes(task.status) && categories.some((category) => category.id === task.category))
      && data.responses.every((response) => response && typeof response.taskId === 'string' && typeof response.message === 'string' && ['waiting', 'accepted'].includes(response.status))) return { tasks: data.tasks, responses: data.responses }
  } catch { /* Unavailable or outdated storage: start with the example data. */ }
  return { tasks: initialData.tasks.filter((task) => !task.owner), responses: [] }
}
export function AppProvider({ children, user, saveUser }) {
  const storageKey = `dobrye-dela-demo-v2:${user.tgId}`
  const [data, setData] = useState(() => restoreData(storageKey))
  const profile = { ...user, name: `${user.name} ${user.surname}`.trim(), skills: user.tags, availability: user.time }
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)
  function persistData(update) {
    const next = update(data)
    setData(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false) }
    catch { setStorageError(true) }
  }
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])
  function createRequest(form) {
    const task = { ...form, id: crypto.randomUUID(), title: form.title.trim(), description: form.description.trim(), owner: true, name: user.name, rating: '—', deals: 0, tone: 'peach', distance: null, status: 'active', isNew: true }
    persistData((current) => ({ ...current, tasks: [task, ...current.tasks] }))
    setNotice('Заявка создана и добавлена в «Мои заявки»')
    window.location.hash = '/profile/requests'
  }
  function respond(taskId, message = 'Здравствуйте! Буду рада помочь. Давайте договоримся о времени.') {
    const task = data.tasks.find((item) => item.id === taskId)
    if (!task || task.owner || task.status !== 'active' || data.responses.some((item) => item.taskId === taskId)) return
    persistData((current) => current.responses.some((item) => item.taskId === taskId) ? current : ({ ...current, responses: [{ taskId, status: 'waiting', message: message.trim() || 'Здравствуйте! Буду рада помочь.' }, ...current.responses] }))
    setNotice('Отклик добавлен в «Мои отклики»')
  }
  function cancelResponse(taskId) {
    persistData((current) => ({ ...current, responses: current.responses.filter((item) => item.taskId !== taskId) }))
    setNotice('Отклик отозван')
  }
  async function saveProfile(values) {
    await saveUser(values)
    setNotice('Профиль сохранён')
    window.location.hash = '/profile'
  }
  const tasks = data.tasks.map((task) => task.owner ? { ...task, name: user.name } : task)
  return <AppContext.Provider value={{ ...data, tasks, user, profile, notice, setNotice, storageError, createRequest, respond, cancelResponse, saveProfile }}>{children}</AppContext.Provider>
}
