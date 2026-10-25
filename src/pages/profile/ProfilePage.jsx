import { useApp } from '../../context/useApp'
import { categories } from '../../data/catalog'
import Icon from '../../components/Icon'
import './ProfilePage.scss'

export default function ProfilePage() {
  const { profile, tasks, responses } = useApp()
  const myTasks = tasks.filter((task) => task.owner)
  const active = myTasks.filter((task) => task.status === 'created').length
  return <div className="profile-page narrow-page">
    <div className="page-heading"><span className="eyebrow">Ваш маленький мир добрых дел</span><h1>Мой профиль</h1></div>
    <section className="profile-card">
      <div className="profile-cover"><span /><span /><Icon name="sparkles" size={25} /></div>
      <div className="profile-person"><span className="profile-avatar avatar-peach">{profile.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}<span className="profile-heart"><Icon name="heart" size={13} /></span></span><a href="#/profile/edit" className="profile-edit" aria-label="Редактировать профиль"><Icon name="edit" size={17} /><span>Редактировать</span></a></div>
      <div className="profile-info"><h2>{profile.name}</h2><p><Icon name="pin" size={13} />{profile.city}, {profile.district}</p><span className="profile-member"><span className="status-dot" />Профиль заполнен</span></div>
    </section>

    <div className="profile-actions">
      <a href="#/profile/requests" className="profile-action"><span className="profile-action-icon tone-blue"><Icon name="clipboard" size={23} /></span><span className="profile-action-text"><strong>Мои заявки</strong><small>{active ? `${active} в поиске помощника` : 'Все ваши просьбы о помощи'}</small></span><span className="action-count">{myTasks.length}</span><Icon name="chevron" size={18} /></a>
      <a href="#/profile/responses" className="profile-action"><span className="profile-action-icon tone-green"><Icon name="message" size={23} /></span><span className="profile-action-text"><strong>Мои отклики</strong><small>Дела, в которых вы готовы помочь</small></span><span className="action-count">{responses.length}</span><Icon name="chevron" size={18} /></a>
    </div>

    <section className="profile-section panel"><div className="section-heading"><h2>Контакты и время</h2><Icon name="heart" size={18} /></div><p className="profile-about">Телефон: {profile.phone}</p><div className="profile-availability"><Icon name="clock" size={15} />{profile.availability}</div></section>
    <section className="profile-section panel"><div className="section-heading"><h2>Могу помочь</h2><a className="text-link" href="#/profile/edit">Изменить<Icon name="arrow" size={14} /></a></div><div className="profile-skills">{profile.skills.map((skill) => { const category = categories.find((item) => item.label === skill); return <span className={`skill-tag tone-${category?.tone || 'green'}`} key={skill}><Icon name={category?.icon || 'heart'} size={16} />{skill}</span> })}{!profile.skills.length && <p className="section-caption">Добавьте навыки в настройках профиля.</p>}</div></section>
    <div className="profile-thanks"><Icon name="heart" size={20} /><p>Спасибо, что делаете мир немного добрее.</p></div>
  </div>
}
