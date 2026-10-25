import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { categories } from '../../data/demo'
import { limits, validateProfile } from '../../lib/profile'
import './ProfileForm.scss'

const steps = ['О вас', 'Навыки', 'Где и когда']
const stepFields = [['name', 'surname', 'phone'], ['tags'], ['city', 'district', 'time']]
const personalFields = [
  { name: 'name', label: 'Имя', autoComplete: 'given-name', placeholder: 'Ваше имя' },
  { name: 'surname', label: 'Фамилия', autoComplete: 'family-name', placeholder: 'Ваша фамилия' },
  { name: 'phone', label: 'Телефон', autoComplete: 'tel', type: 'tel', placeholder: '+7 999 123-45-67', maxLength: 30 },
]
const locationFields = [
  { name: 'city', label: 'Город', autoComplete: 'address-level2', placeholder: 'Например, Нижний Новгород' },
  { name: 'district', label: 'Район', placeholder: 'Например, Советский' },
  { name: 'time', label: 'Когда свободны', placeholder: 'Например, в будни после 18:00' },
]

export default function ProfileForm({ profile, onSave, onboarding = false }) {
  const [form, setForm] = useState(() => ({ name: profile.name || '', surname: profile.surname || '', phone: profile.phone || '', tags: profile.tags || [], city: profile.city || '', district: profile.district || '', time: profile.time || '' }))
  const [step, setStep] = useState(0)
  const [customTag, setCustomTag] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const formRef = useRef(null)
  const allTags = [...new Set([...categories.map((category) => category.label), ...form.tags])]
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError('')
  }
  function focusField(field) {
    requestAnimationFrame(() => formRef.current?.querySelector(`[name="${field}"]`)?.focus())
  }
  function toggleTag(tag) {
    if (!form.tags.includes(tag) && form.tags.length >= limits.tags) { setErrors((current) => ({ ...current, tags: `Можно добавить не более ${limits.tags} навыков.` })); return }
    update('tags', form.tags.includes(tag) ? form.tags.filter((value) => value !== tag) : [...form.tags, tag])
  }
  function addTag() {
    const tag = customTag.trim().replace(/\s+/g, ' ')
    if (!tag) return
    if (!form.tags.includes(tag)) toggleTag(tag)
    setCustomTag('')
  }
  async function submit(event) {
    event.preventDefault()
    if (inFlight.current) return
    const validated = validateProfile(form)
    if (onboarding && step < steps.length - 1) {
      const currentErrors = Object.fromEntries(Object.entries(validated.errors).filter(([key]) => stepFields[step].includes(key)))
      setErrors(currentErrors)
      if (Object.keys(currentErrors).length) { focusField(Object.keys(currentErrors)[0]); return }
      setStep(step + 1)
      focusField(stepFields[step + 1][0])
      return
    }
    if (!validated.valid) {
      const firstField = Object.keys(validated.errors)[0]
      setErrors(validated.errors)
      if (onboarding) setStep(stepFields.findIndex((fields) => fields.includes(firstField)))
      focusField(firstField)
      return
    }
    inFlight.current = true
    setSaving(true)
    setError('')
    try { await onSave(validated.data) }
    catch (failure) {
      setError(failure.message || 'Не удалось сохранить профиль. Попробуйте ещё раз.')
      if (failure.fields) {
        setErrors(failure.fields)
        const firstField = Object.keys(failure.fields)[0]
        const errorStep = stepFields.findIndex((fields) => fields.includes(firstField))
        if (onboarding && errorStep >= 0) setStep(errorStep)
        focusField(firstField)
      }
    } finally { inFlight.current = false; setSaving(false) }
  }
  function renderField(field) {
    return <label className="field" key={field.name}>{field.label}<input name={field.name} type={field.type || 'text'} autoComplete={field.autoComplete} placeholder={field.placeholder} maxLength={field.maxLength || limits[field.name] || limits.name} required value={form[field.name]} onChange={(event) => update(field.name, event.target.value)} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${field.name}-error` : undefined} />{errors[field.name] && <span className="field-error" id={`${field.name}-error`}>{errors[field.name]}</span>}</label>
  }
  return <form ref={formRef} className="profile-form panel" onSubmit={submit} noValidate aria-busy={saving}>
    {onboarding && <ol className="profile-steps" aria-label="Заполнение профиля">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Icon name="check" size={15} /> : index + 1}</span>{label}</li>)}</ol>}
    <fieldset className="profile-form-fields" disabled={saving}>
      {(!onboarding || step === 0) && <div className="form-stack">
        <div className="profile-form-heading"><h2>Давайте познакомимся</h2><p>Имя и контакты помогут договориться о помощи.</p></div>
        <div className="field-row">{personalFields.slice(0, 2).map(renderField)}</div>
        {renderField(personalFields[2])}
      </div>}
      {(!onboarding || step === 1) && <div className="profile-form-skills">
        <div className="profile-form-heading"><h2>В чём вы можете помочь?</h2><p>Выберите хотя бы один навык или добавьте свой.</p></div>
        <div className="profile-tag-options" role="group" aria-label="Навыки" aria-describedby={errors.tags ? 'tags-error' : undefined}>{allTags.map((tag, index) => <button name={index === 0 ? 'tags' : undefined} type="button" key={tag} className="chip" aria-pressed={form.tags.includes(tag)} onClick={() => toggleTag(tag)}><Icon name={form.tags.includes(tag) ? 'check' : categories.find((item) => item.label === tag)?.icon || 'plus'} size={17} />{tag}</button>)}</div>
        <div className="custom-tag"><label className="field">Свой навык<input maxLength={limits.tag} placeholder="Например, ремонт велосипедов" value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} /></label><button type="button" className="button button-secondary" aria-label="Добавить свой навык" onClick={addTag} disabled={!customTag.trim()}><Icon name="plus" size={19} /></button></div>
        {errors.tags && <p className="field-error" id="tags-error" role="alert">{errors.tags}</p>}
        <p className="profile-form-hint">Группы можно найти и выбрать позже — они не нужны для завершения профиля.</p>
      </div>}
      {(!onboarding || step === 2) && <div className="form-stack"><div className="profile-form-heading"><h2>Где и когда вам удобно?</h2><p>Так будет проще найти помощь по соседству.</p></div>{locationFields.map(renderField)}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="profile-form-buttons">
        {onboarding && step > 0 && <button type="button" className="button button-outline" onClick={() => { setStep(step - 1); focusField(stepFields[step - 1][0]) }}><Icon name="back" size={18} />Назад</button>}
        <button type="submit" className="button button-primary">{saving ? 'Сохраняем…' : onboarding ? step < 2 ? 'Далее' : 'Начать делать добро' : 'Сохранить профиль'}<Icon name={onboarding && step < 2 ? 'arrow' : 'check'} size={18} /></button>
      </div>
      {!onboarding && <a href="#/profile" className="edit-cancel" aria-disabled={saving || undefined} onClick={(event) => { if (saving) event.preventDefault() }}>Отмена</a>}
    </fieldset>
    {onboarding && <p className="profile-form-note">Профиль нужно заполнить, чтобы перейти к заявкам.</p>}
  </form>
}
