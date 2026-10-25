import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/useApp'
import { plural, requestDate } from '../../data/catalog'
import Icon from '../../components/Icon'
import './RequestAnswers.scss'

export default function RequestAnswers({ task }) {
  const requestId = task.id
  const { api, changeRequest, reloadRequest } = useApp()
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [actionError, setActionError] = useState('')
  const sequence = useRef(0)
  const reload = useCallback(async (signal) => {
    const current = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const result = await api('answers.list', { requestId }, signal)
      if (!Array.isArray(result.answers)) throw new Error('Сервер вернул некорректный список откликов.')
      if (!signal?.aborted && current === sequence.current) setAnswers(result.answers)
    } catch (failure) {
      if (!signal?.aborted && current === sequence.current) setError(failure.message || 'Не удалось загрузить отклики.')
    } finally {
      if (!signal?.aborted && current === sequence.current) setLoading(false)
    }
  }, [api, requestId])
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) reload(controller.signal) })
    return () => controller.abort()
  }, [reload])
  async function confirm(answerId) {
    if (confirming) return
    setConfirming(answerId)
    setActionError('')
    try { await changeRequest('requests.confirm', requestId, { answerId }) }
    catch (failure) {
      setActionError(failure.message || 'Не удалось подтвердить исполнителя.')
      await reloadRequest(requestId).catch(() => {})
    } finally { setConfirming(null) }
  }
  return <section className="request-answers panel" aria-labelledby="answers-heading">
    <div className="answers-heading"><h2 id="answers-heading">Отклики на заявку</h2><button className="button button-secondary" disabled={loading || Boolean(confirming)} onClick={() => { reload(); reloadRequest(requestId).catch(() => {}) }}>Обновить</button></div>
    {actionError && <p role="alert" className="field-error">{actionError}</p>}
    {loading ? <p role="status">Загружаем отклики…</p> : error ? <p role="alert">{error}</p> : !answers.length ? <div className="answers-empty"><Icon name="message" size={28} /><p>Пока никто не откликнулся. Здесь появятся люди, готовые вам помочь.</p></div> : <ul className="answers-list">{answers.map(({ id, worker, createdAt }) => <li key={id}>
      <span className="avatar avatar-green" aria-hidden="true">{worker?.name?.[0] || '?'}</span>
      <div className="answer-person"><h3>{worker ? [worker.name, worker.surname].filter(Boolean).join(' ') || 'Участник сообщества' : 'Профиль исполнителя удалён'}</h3>
        {worker && <p className="answer-rating"><Icon name="star" size={15} />{worker.reviewCount ? `${worker.rating.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} из 5 · ${plural(worker.reviewCount, ['отзыв', 'отзыва', 'отзывов'])}` : 'Пока нет отзывов'}</p>}
        {createdAt && <small>Откликнулся {requestDate(createdAt)}</small>}
        {worker && task.worker?.id === worker.id && <span className="badge badge-green answer-selected"><Icon name="check" size={14} />Исполнитель выбран</span>}
        {worker && task.status === 'created' && <button className="button button-primary answer-confirm" disabled={Boolean(confirming)} onClick={() => confirm(id)}>{confirming === id ? 'Подтверждаем…' : 'Подтвердить исполнителя'}</button>}
      </div>
    </li>)}</ul>}
  </section>
}
