import { useState } from 'react'
import { useApp } from '../../context/useApp'
import { plural } from '../../data/demo'
import Icon from '../../components/Icon'
import RequestCard from '../../components/RequestCard'
import './ActivityPage.scss'

export default function ActivityPage({ kind }) {
  const { tasks, responses, cancelResponse } = useApp()
  const [filter, setFilter] = useState('all')
  const isRequests = kind === 'requests'
  const mine = tasks.filter((task) => task.owner)
  const responseItems = responses.map((response) => ({ response, task: tasks.find((task) => task.id === response.taskId) })).filter((item) => item.task)
  const items = isRequests ? mine.map((task) => ({ task })) : responseItems
  const filters = isRequests ? [{ id: 'all', label: 'Все' }, { id: 'active', label: 'Активные' }, { id: 'completed', label: 'Завершённые' }] : [{ id: 'all', label: 'Все' }, { id: 'waiting', label: 'Ожидают ответа' }, { id: 'accepted', label: 'Меня выбрали' }]
  const matches = (item, value) => value === 'all' || (isRequests ? item.task.status : item.response.status) === value
  const shown = items.filter((item) => matches(item, filter))

  return <div className="activity-page">
    <a className="back-link" href="#/profile"><Icon name="back" size={17} />В профиль</a>
    <div className="activity-heading"><div className="page-heading"><span className="eyebrow">Добрые дела продолжаются</span><h1>{isRequests ? 'Мои заявки' : 'Мои отклики'}</h1><p>{isRequests ? 'Ваши просьбы о помощи и их маленькие истории.' : 'Все дела, в которых вы готовы быть рядом.'}</p></div>{isRequests && <a href="#/create" className="button button-primary activity-create"><Icon name="plus" size={18} /><span>Новая заявка</span></a>}</div>
    <nav className="activity-tabs" aria-label="Моя активность"><a href="#/profile/requests" aria-current={isRequests ? 'page' : undefined}><Icon name="clipboard" size={18} />Мои заявки<span>{mine.length}</span></a><a href="#/profile/responses" aria-current={!isRequests ? 'page' : undefined}><Icon name="message" size={18} />Мои отклики<span>{responses.length}</span></a></nav>
    <div className="activity-filters" role="group" aria-label="Статус">{filters.map((item) => <button key={item.id} className="chip" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{items.filter((entry) => matches(entry, item.id)).length}</span></button>)}</div>
    <p className="activity-count" aria-live="polite">{isRequests ? plural(shown.length) : plural(shown.length, ['отклик', 'отклика', 'откликов'])}</p>
    <div className="activity-grid">{shown.map(({ task, response }) => <RequestCard task={task} response={response} key={task.id}>{response && <div className="response-message"><span>Ваше сообщение</span><p>{response.message}</p><button onClick={() => cancelResponse(task.id)}>Отозвать отклик</button></div>}</RequestCard>)}{!shown.length && <div className="empty-state"><Icon name={isRequests ? 'clipboard' : 'message'} size={34} /><h2>{filter !== 'all' ? 'Здесь пока пусто' : isRequests ? 'Всё начинается с просьбы' : 'Ваше первое доброе дело — впереди'}</h2><p>{filter !== 'all' ? 'Заявок с таким статусом пока нет. Посмотрите другие вкладки.' : isRequests ? 'Создайте заявку, и кто-то рядом сможет предложить помощь.' : 'Выберите задачу на главной и предложите свою помощь.'}</p>{filter !== 'all' ? <button className="button button-secondary" onClick={() => setFilter('all')}>Показать все</button> : <a href={isRequests ? '#/create' : '#/'} className="button button-primary">{isRequests ? 'Создать заявку' : 'Найти доброе дело'}<Icon name="arrow" size={17} /></a>}</div>}</div>
  </div>
}
