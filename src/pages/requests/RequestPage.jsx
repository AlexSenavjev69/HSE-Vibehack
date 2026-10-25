import { useState } from 'react'
import { useApp } from '../../context/useApp'
import { categories, locationLabel, requestDate, statusLabels } from '../../data/catalog'
import Icon from '../../components/Icon'
import RequestsStatus from '../../components/RequestsStatus'
import ResponsesStatus from '../../components/ResponsesStatus'
import RequestAnswers from './RequestAnswers'
import './RequestPage.scss'

export default function RequestPage({ id }) {
  const { tasks, tasksLoading, tasksError, responses, responsesLoading, responsesError, respond } = useApp()
  const response = responses.find((item) => item.taskId === id)
  const task = tasks.find((item) => item.id === id) || response?.request
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    try { await respond(id) }
    catch (failure) { setError(failure.message || 'Не удалось отправить отклик.') }
    finally { setSending(false) }
  }
  if (tasksLoading || tasksError) return <RequestsStatus />
  if (!task) return <div className="empty-state"><Icon name="search" size={34} /><h1>Заявка не найдена</h1><p>Возможно, ссылка устарела. На главной есть другие добрые дела.</p><a href="#/" className="button button-primary">На главную</a></div>
  const category = categories.find((item) => item.id === task.category) || categories.at(-1)
  const date = requestDate(task.createdAt)
  return <div className="request-page narrow-page">
    <a className="back-link" href={task.owner ? '#/profile/requests' : response ? '#/profile/responses' : '#/'}><Icon name="back" size={17} />{task.owner ? 'Мои заявки' : response ? 'Мои отклики' : 'К заявкам'}</a>
    <article className="request-detail panel">
      <div className="detail-category"><span className={`category-icon tone-${category.tone}`}><Icon name={category.icon} size={23} /></span><span>{category.label}</span></div>
      <div className="request-badges">{task.urgent && <span className="badge badge-warm"><Icon name="bolt" size={12} />Срочно</span>}{task.online && <span className="badge badge-blue"><Icon name="globe" size={12} />Онлайн</span>}<span className="badge badge-green">{statusLabels[task.status] || 'Статус не указан'}</span></div>
      <h1>{task.title}</h1>
      <div className="detail-meta">{date && <span><Icon name="clock" size={18} /><span><small>Опубликовано</small>{date}</span></span>}<span><Icon name={task.online ? 'globe' : 'pin'} size={18} /><span><small>Где</small>{locationLabel(task)}</span></span></div>
      <h2>О задаче</h2><p className="detail-description">{task.description}</p>
      <h2>Награда</h2><p className="detail-description">{task.reward || 'Награда не указана.'}</p>
      <div className="detail-author"><span className={`avatar avatar-${task.tone}`}>{task.name[0]}</span><span><strong>{task.owner ? 'Вы автор заявки' : task.name}</strong><small>{task.owner ? task.name : 'Автор заявки'}</small></span><Icon name="heart" size={21} /></div>
    </article>
    {task.owner ? <RequestAnswers key={id} requestId={id} /> : responsesLoading || responsesError ? <ResponsesStatus /> : response ? <section className="request-state panel"><span className="request-state-icon"><Icon name="check" size={26} /></span><h2>Вы откликнулись</h2><p>Автор заявки видит ваше имя, фамилию и рейтинг в списке исполнителей.</p><a href="#/profile/responses" className="button button-secondary">Мои отклики</a></section> : task.status === 'created' ? <section className="response-form panel"><h2>Сможете помочь?</h2><p>Предложите помощь — автор увидит ваш отклик в своей заявке.</p><form className="form-stack" onSubmit={submit}>{error && <p role="alert" className="field-error">{error}</p>}<button type="submit" disabled={sending} className="button button-primary"><Icon name="message" size={18} />{sending ? 'Отправляем…' : 'Откликнуться'}</button></form></section> : <section className="request-state panel"><h2>Приём откликов закрыт</h2><p>Выберите другую открытую заявку на главной.</p><a href="#/" className="button button-secondary">К заявкам</a></section>}
  </div>
}
