import Icon from './Icon'
import { categories, locationLabel, plural } from '../data/demo'
import { useApp } from '../context/useApp'
import './RequestCard.scss'

export default function RequestCard({ task, response, children }) {
  const { respond, responses } = useApp()
  const category = categories.find((item) => item.id === task.category)
  const hasResponded = responses.some((item) => item.taskId === task.id)
  return <article className="request-card">
    <div className="request-card-top"><span className={`category-icon tone-${category.tone}`}><Icon name={category.icon} size={21} /></span><span className="request-category">{category.label}</span>{task.status === 'completed' ? <span className="badge badge-green"><Icon name="check" size={12} />Завершена</span> : task.urgent ? <span className="badge badge-warm"><span className="status-dot" />Срочно</span> : task.isNew ? <span className="badge badge-green">Новая</span> : null}</div>
    <h3><a href={`#/requests/${task.id}`}>{task.title}</a></h3>
    <p className="request-description">{task.description}</p>
    <div className="request-meta"><span><Icon name="clock" size={15} />{task.when}</span><span><Icon name={task.online ? 'globe' : 'pin'} size={15} />{locationLabel(task)}</span></div>
    {response && <div className={`response-status ${response.status === 'accepted' ? 'is-accepted' : ''}`}><Icon name={response.status === 'accepted' ? 'check-circle' : 'clock'} size={16} />{response.status === 'accepted' ? 'Вас выбрали помощником' : 'Ожидает ответа'}</div>}
    <div className="request-card-footer"><div className="author"><span className={`avatar avatar-${task.tone}`}>{task.name[0]}</span><span><strong>{task.owner ? 'Ваша заявка' : task.name}</strong><small><Icon name="star" size={11} className="star-filled" />{task.rating}<span>· {plural(task.deals, ['дело', 'дела', 'дел'])}</span></small></span></div>{task.owner || response ? <a className="card-link" href={`#/requests/${task.id}`}>Подробнее<Icon name="arrow" size={17} /></a> : <button className={`respond-button ${hasResponded ? 'has-responded' : ''}`} onClick={() => respond(task.id)} disabled={hasResponded}>{hasResponded ? <><Icon name="check" size={16} />Вы откликнулись</> : <>Помочь<Icon name="arrow" size={16} /></>}</button>}</div>
    {children}
  </article>
}
