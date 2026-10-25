import { useRef, useState } from 'react'
import { useApp } from '../../context/useApp'
import { categories } from '../../data/catalog'
import { requestLimits, validateRequest } from '../../../server/profile-api/request-domain.js'
import Icon from '../../components/Icon'
import './CreateRequestPage.scss'

export default function CreateRequestPage() {
  const { createRequest, profile } = useApp()
  const [form, setForm] = useState({ title: '', description: '', category: 'household', reward: '', online: false, urgent: false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const submissionId = useRef(crypto.randomUUID())
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
    submissionId.current = crypto.randomUUID()
  }
  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    const validation = validateRequest(form)
    if (!validation.valid) { setError(Object.values(validation.errors)[0]); return }
    busy.current = true
    setSaving(true)
    setError('')
    try { await createRequest(form, submissionId.current) }
    catch (failure) { setError(failure.message || 'Не удалось создать заявку. Попробуйте снова.') }
    finally { busy.current = false; setSaving(false) }
  }
  return <div className="create-page narrow-page">
    <a className="back-link" href="#/"><Icon name="back" size={17} />На главную</a>
    <div className="page-heading"><span className="eyebrow">Помощь начинается с просьбы</span><h1>Новая заявка</h1><p>Расскажите, что нужно сделать.<br />Наверняка рядом есть тот, кто сможет помочь.</p></div>
    <form className="create-form panel" onSubmit={submit} aria-busy={saving}>
      <fieldset className="request-form-fields form-stack" disabled={saving}>
        <fieldset className="category-fieldset"><legend><span className="form-step">01</span>Какая помощь нужна?</legend><div className="category-options">{categories.map((category) => <label key={category.id} className={`category-option ${form.category === category.id ? 'is-selected' : ''}`}><input type="radio" name="category" value={category.id} checked={form.category === category.id} onChange={() => update('category', category.id)} /><span className={`category-icon tone-${category.tone}`}><Icon name={category.icon} size={21} /></span><span>{category.label}</span>{form.category === category.id && <Icon name="check" size={13} className="category-check" />}</label>)}</div></fieldset>
        <div className="form-divider" />
        <div className="form-section-heading"><span className="form-step">02</span><h2>Немного подробностей</h2></div>
        <label className="field">Название заявки<input name="title" required minLength={4} maxLength={requestLimits.title} placeholder="Например, помочь собрать стеллаж" value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
        <label className="field">Что нужно сделать?<textarea name="description" required minLength={10} maxLength={requestLimits.description} rows={5} placeholder="Опишите задачу, когда нужна помощь и что важно знать помощнику…" value={form.description} onChange={(event) => update('description', event.target.value)} /><small>{form.description.length} / {requestLimits.description}</small></label>
        <fieldset className="format-fieldset"><legend className="field-legend">Теги заявки</legend><div className="format-options"><label className={form.urgent ? 'is-selected' : ''}><input type="checkbox" checked={form.urgent} onChange={(event) => update('urgent', event.target.checked)} /><Icon name="bolt" size={18} />Срочно</label><label className={form.online ? 'is-selected' : ''}><input type="checkbox" checked={form.online} onChange={(event) => update('online', event.target.checked)} /><Icon name="globe" size={18} />Онлайн</label></div></fieldset>
        <p className="create-hint">{form.online ? 'Можно помочь дистанционно.' : `Место из вашего профиля: ${[profile.city, profile.district].filter(Boolean).join(', ')}.`}</p>
        <div className="form-divider" />
        <div className="form-section-heading"><span className="form-step">03</span><h2>Награда</h2></div>
        <label className="field">Что вы готовы сделать взамен?<textarea name="reward" rows={3} maxLength={requestLimits.reward} placeholder="Например, покормить обедом или помочь с другой задачей" value={form.reward} onChange={(event) => update('reward', event.target.value)} /><small>Необязательно — можно просто сказать спасибо.</small></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary full-width">{saving ? 'Публикуем…' : 'Опубликовать заявку'}<Icon name="arrow" size={18} /></button>
        <p className="create-hint">Заявка появится на главной и в разделе «Мои заявки».</p>
      </fieldset>
    </form>
  </div>
}
