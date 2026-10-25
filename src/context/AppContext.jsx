import { useCallback, useEffect, useRef, useState } from 'react'
import { AppContext } from './useApp'

export function AppProvider({ children, user, saveUser, api }) {
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState('')
  const loadSequence = useRef(0)
  const [notice, setNotice] = useState('')
  const [responses, setResponses] = useState([])
  const [responsesLoading, setResponsesLoading] = useState(true)
  const [responsesError, setResponsesError] = useState('')
  const responseSequence = useRef(0)
  const updateRequestInState = useCallback((request) => {
    setTasks((current) => current.some((task) => task.id === request.id) ? current.map((task) => task.id === request.id ? request : task) : [request, ...current])
    setResponses((current) => current.map((response) => response.taskId === request.id ? { ...response, request } : response))
  }, [])
  const profile = { ...user, name: `${user.name} ${user.surname}`.trim(), skills: user.tags, availability: user.time }
  const reloadRequests = useCallback(async (signal) => {
    const sequence = ++loadSequence.current
    setTasksLoading(true)
    setTasksError('')
    try {
      const result = await api('requests.list', {}, signal)
      if (!Array.isArray(result.requests)) throw new Error('Сервер вернул некорректный список заявок.')
      if (!signal?.aborted && sequence === loadSequence.current) setTasks(result.requests)
    } catch (error) {
      if (!signal?.aborted && sequence === loadSequence.current) setTasksError(error.message || 'Не удалось загрузить заявки.')
    } finally {
      if (!signal?.aborted && sequence === loadSequence.current) setTasksLoading(false)
    }
  }, [api])
  const reloadResponses = useCallback(async (signal) => {
    const sequence = ++responseSequence.current
    setResponsesLoading(true)
    setResponsesError('')
    try {
      const result = await api('answers.mine', {}, signal)
      if (!Array.isArray(result.answers)) throw new Error('Сервер вернул некорректный список откликов.')
      if (!signal?.aborted && sequence === responseSequence.current) {
        setResponses(result.answers)
        setTasks((current) => current.map((task) => result.answers.find((answer) => answer.taskId === task.id)?.request || task))
      }
    } catch (error) {
      if (!signal?.aborted && sequence === responseSequence.current) setResponsesError(error.message || 'Не удалось загрузить отклики.')
    } finally {
      if (!signal?.aborted && sequence === responseSequence.current) setResponsesLoading(false)
    }
  }, [api])
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        reloadRequests(controller.signal)
        reloadResponses(controller.signal)
      }
    })
    return () => controller.abort()
  }, [reloadRequests, reloadResponses])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])
  async function createRequest(form, submissionId) {
    const result = await api('requests.create', { request: form, submissionId })
    if (!result.request?.id) throw new Error('Сервер не подтвердил создание заявки. Попробуйте ещё раз.')
    setTasks((current) => [result.request, ...current.filter((task) => task.id !== result.request.id)])
    await reloadRequests()
    setNotice('Заявка опубликована')
    window.location.hash = '/'
  }
  async function respond(taskId) {
    const result = await api('answers.create', { requestId: taskId })
    if (!result.answer?.id) throw new Error('Сервер не подтвердил отправку отклика. Попробуйте ещё раз.')
    // Invalidate any list read started before this mutation.
    responseSequence.current++
    setResponses((current) => [result.answer, ...current.filter((item) => item.taskId !== taskId)])
    setResponsesLoading(false)
    setResponsesError('')
    setNotice('Отклик отправлен. Автор увидит его в своей заявке.')
  }
  async function saveProfile(values) {
    await saveUser(values)
    setNotice('Профиль сохранён')
    window.location.hash = '/profile'
  }
  const reloadRequest = useCallback(async (requestId, signal) => {
    const result = await api('requests.get', { requestId }, signal)
    if (!result.request?.id) throw new Error('Не удалось загрузить заявку.')
    if (!signal?.aborted) updateRequestInState(result.request)
    return result.request
  }, [api, updateRequestInState])
  async function changeRequest(action, requestId, payload = {}) {
    const result = await api(action, { requestId, ...payload })
    if (!result.request?.id) throw new Error('Сервер не подтвердил изменение заявки. Попробуйте ещё раз.')
    loadSequence.current++
    responseSequence.current++
    updateRequestInState(result.request)
    setTasksLoading(false)
    setTasksError('')
    setResponsesLoading(false)
    setNotice(action === 'requests.confirm' ? 'Исполнитель подтверждён. Заявка в работе.' : action === 'requests.complete' ? 'Заявка завершена. Оставьте отзыв об исполнителе.' : 'Отзыв сохранён. Заявка перенесена в архив.')
    return result.request
  }
  return <AppContext.Provider value={{ tasks, tasksLoading, tasksError, reloadRequests, reloadRequest, changeRequest, responses, responsesLoading, responsesError, reloadResponses, api, user, profile, notice, setNotice, createRequest, respond, saveProfile }}>{children}</AppContext.Provider>
}
