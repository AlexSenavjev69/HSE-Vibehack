import { useState } from 'react'
import { useApp } from '../../context/useApp'
import { categories } from '../../data/demo'
import Icon from '../../components/Icon'
import './CreateRequestPage.scss'

export default function CreateRequestPage() {
  const { createRequest, profile } = useApp()
  const [form, setForm] = useState({ title: '', description: '', category: 'household', district: profile.district, when: 'В удобное время', online: false, urgent: false })
  const [error, setError] = useState('')
  const update = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setError('') }
  function submit(event) {
    event.preventDefault()
    for (const [field, message, length] of [['title', 'Добавьте название заявки — хотя бы 4 символа.', 4], ['description', 'Расскажите немного подробнее — хотя бы 10 символов.', 10], ['when', 'Укажите, когда нужна помощь.', 2]]) {
      if (form[field].trim().length < length) { setError(message); event.currentTarget.elements[field].focus(); return }
    }
    if (!form.online && !form.district.trim()) { setError('Укажите район.'); event.currentTarget.elements.district.focus(); return }
    createRequest(form)
  }

  return <div className="create-page narrow-page">
    <a className="back-link" href="#/"><Icon name="back" size={17} />На главную</a>
    <div className="page-heading"><span className="eyebrow">Помощь начинается с просьбы</span><h1>Новая заявка</h1><p>Расскажите, что нужно сделать.<br />Наверняка рядом есть тот, кто сможет помочь.</p></div>
    <form className="create-form panel form-stack" onSubmit={submit}>
      <fieldset className="category-fieldset"><legend><span className="form-step">01</span>Какая помощь нужна?</legend><div className="category-options">{categories.map((category) => <label key={category.id} className={`category-option ${form.category === category.id ? 'is-selected' : ''}`}><input type="radio" name="category" value={category.id} checked={form.category === category.id} onChange={() => update('category', category.id)} /><span className={`category-icon tone-${category.tone}`}><Icon name={category.icon} size={21} /></span><span>{category.label}</span>{form.category === category.id && <Icon name="check" size={13} className="category-check" />}</label>)}</div></fieldset>
      <div className="form-divider" />
      <div className="form-section-heading"><span className="form-step">02</span><h2>Немного подробностей</h2></div>
      <label className="field">Название заявки <input name="title" required minLength={4} maxLength={90} placeholder="Например, помочь собрать стеллаж" value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
      <label className="field">Что нужно сделать?<textarea name="description" required minLength={10} maxLength={800} rows={4} placeholder="Опишите задачу, сколько времени она займёт и что важно знать помощнику…" value={form.description} onChange={(event) => update('description', event.target.value)} /><small className="character-count">{form.description.length} / 800</small></label>
      <div className="form-divider" />
      <div className="form-section-heading"><span className="form-step">03</span><h2>Где и когда?</h2></div>
      <fieldset className="format-fieldset"><legend className="field-legend">Формат помощи</legend><div className="format-options"><label className={!form.online ? 'is-selected' : ''}><input type="radio" name="format" checked={!form.online} onChange={() => update('online', false)} /><Icon name="pin" size={18} />При встрече</label><label className={form.online ? 'is-selected' : ''}><input type="radio" name="format" checked={form.online} onChange={() => update('online', true)} /><Icon name="globe" size={18} />Онлайн</label></div></fieldset>
      <div className="field-row">{!form.online && <label className="field">Район<input name="district" required maxLength={120} value={form.district} onChange={(event) => update('district', event.target.value)} placeholder="Укажите район" /></label>}<label className="field">Когда нужна помощь?<input name="when" required maxLength={80} value={form.when} onChange={(event) => update('when', event.target.value)} placeholder="Например, завтра после 18:00" /></label></div>
      <label className="urgent-toggle"><span className="urgent-toggle-icon"><Icon name="bolt" size={20} /></span><span><strong>Нужна срочная помощь</strong><small>Отметим заявку, чтобы её заметили</small></span><input type="checkbox" checked={form.urgent} onChange={(event) => update('urgent', event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>
      <div className="note"><Icon name="heart" size={20} /><p>Здесь помогают от души. После доброго дела можно просто сказать спасибо — это уже очень много.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button button-primary full-width">Опубликовать заявку<Icon name="arrow" size={18} /></button>
      <p className="create-hint">Ваша заявка появится на главной и в разделе «Мои заявки».</p>
    </form>
  </div>
}
