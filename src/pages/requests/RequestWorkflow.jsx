import { useRef, useState } from 'react'
import { useApp } from '../../context/useApp'
import Icon from '../../components/Icon'
import './RequestWorkflow.scss'

export default function RequestWorkflow({ task }) {
  const { changeRequest, reloadRequest } = useApp()
  const [rating, setRating] = useState(0)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const inFlight = useRef(false)
  const workerName = [task.worker?.name, task.worker?.surname].filter(Boolean).join(' ') || 'Исполнитель'

  async function submit(action) {
    if (inFlight.current) return
    const validation = {}
    if (action === 'requests.review') {
      if (!rating) validation.rating = 'Выберите оценку от 1 до 5 звёзд.'
      if (!description.trim()) validation.description = 'Напишите несколько слов о выполненной работе.'
    }
    setFields(validation)
    if (Object.keys(validation).length) return
    inFlight.current = true
    setSaving(true)
    setError('')
    try { await changeRequest(action, task.id, action === 'requests.review' ? { review: { rating, description } } : {}) }
    catch (failure) {
      setError(failure.message || 'Не удалось сохранить изменения. Попробуйте ещё раз.')
      setFields(failure.fields || {})
      // A lost HTTP response can follow a successful commit. Fetch the actual
      // status, while keeping the entered review if it has not been saved.
      await reloadRequest(task.id).catch(() => {})
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  if (!['in_progress', 'completed', 'archived'].includes(task.status)) return null
  return <section className="request-workflow panel" aria-labelledby="workflow-heading">
    <span className="eyebrow">{task.status === 'archived' ? 'Доброе дело завершено' : 'Исполнитель'}</span>
    <h2 id="workflow-heading">{workerName}</h2>
    {task.status === 'in_progress' && <>
      <p>Заявка в работе. Когда помощь будет оказана, завершите её и оставьте отзыв.</p>
      <button className="button button-primary" disabled={saving} onClick={() => submit('requests.complete')}><Icon name="check-circle" size={19} />{saving ? 'Сохраняем…' : 'Завершить'}</button>
    </>}
    {task.status === 'completed' && <form className="form-stack review-form" onSubmit={(event) => { event.preventDefault(); submit('requests.review') }} noValidate>
      <h3>Как всё прошло?</h3>
      <p>Оцените помощь исполнителя и расскажите о своём опыте.</p>
      <fieldset className="review-rating" disabled={saving} aria-describedby={fields.rating ? 'rating-error' : undefined}>
        <legend>Ваша оценка</legend>
        <div className="review-stars">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={value <= rating ? 'is-filled' : ''}>
          <input type="radio" name="review-rating" value={value} checked={rating === value} onChange={() => { setRating(value); setFields((current) => ({ ...current, rating: '' })) }} aria-label={`${value} ${value === 1 ? 'звезда' : value < 5 ? 'звезды' : 'звёзд'}`} />
          <Icon name="star" size={32} />
        </label>)}</div>
        <span className="rating-caption" aria-live="polite">{rating ? `${rating} из 5` : 'Нажмите на звезду'}</span>
        {fields.rating && <span className="field-error" id="rating-error">{fields.rating}</span>}
      </fieldset>
      <label className="field">Ваш отзыв<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} disabled={saving} required placeholder="Что получилось хорошо? Чем помог исполнитель?" aria-invalid={Boolean(fields.description)} aria-describedby={fields.description ? 'review-description-error' : undefined} /></label>
      {fields.description && <p className="field-error" id="review-description-error">{fields.description}</p>}
      <button type="submit" className="button button-primary" disabled={saving}><Icon name="star" size={18} />{saving ? 'Сохраняем отзыв…' : 'Сохранить отзыв'}</button>
      <p className="review-caption">После сохранения отзыва заявка перейдёт в архив.</p>
    </form>}
    {task.status === 'archived' && <div className="workflow-finished"><Icon name="check-circle" size={23} /><p>Заявка в архиве. Спасибо за обратную связь!</p></div>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
}
