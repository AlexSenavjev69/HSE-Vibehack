import Icon from './Icon'
import { categories, locationLabel, requestDate, statusLabels } from '../data/catalog'
import './RequestCard.scss'

export default function RequestCard({ task, response, children }) {
  const category = categories.find((item) => item.id === task.category) || categories.at(-1)
  const date = requestDate(task.createdAt)
  return <article className="request-card">
    <div className="request-card-top"><span className={`category-icon tone-${category.tone}`}><Icon name={category.icon} size={21} /></span><span className="request-category">{category.label}</span></div>
    <div className="request-badges">{task.urgent && <span className="badge badge-warm"><Icon name="bolt" size={12} />Срочно</span>}{task.online && <span className="badge badge-blue"><Icon name="globe" size={12} />Онлайн</span>}{task.status !== 'created' && <span className="badge badge-green">{statusLabels[task.status] || 'Статус не указан'}</span>}</div>
    <h3><a href={`#/requests/${task.id}`}>{task.title}</a></h3>
    <p className="request-description">{task.description}</p>
    {task.reward && <div className="request-reward"><Icon name="heart" size={16} /><p><strong>В благодарность</strong>{task.reward}</p></div>}
    <div className="request-meta">{date && <span><Icon name="clock" size={15} />Опубликовано {date}</span>}<span><Icon name={task.online ? 'globe' : 'pin'} size={15} />{locationLabel(task)}</span></div>
    {response && <div className="response-status"><Icon name="check" size={16} />Вы откликнулись</div>}
    <div className="request-card-footer"><div className="author"><span className={`avatar avatar-${task.tone}`}>{task.name[0]}</span><span><strong>{task.owner ? 'Ваша заявка' : task.name}</strong><small>{statusLabels[task.status] || 'Статус не указан'}</small></span></div><a className="card-link" href={`#/requests/${task.id}`}>Подробнее<Icon name="arrow" size={17} /></a></div>
    {children}
  </article>
}
