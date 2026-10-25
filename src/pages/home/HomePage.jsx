import { useState } from 'react'
import { useApp } from '../../context/useApp'
import { categories, plural } from '../../data/catalog'
import Icon from '../../components/Icon'
import RequestCard from '../../components/RequestCard'
import RequestsStatus from '../../components/RequestsStatus'
import './HomePage.scss'

const filters = [
  { id: 'all', label: 'Все заявки', icon: null },
  { id: 'near', label: 'Рядом', icon: 'pin' },
  { id: 'urgent', label: 'Срочные', icon: 'bolt' },
  { id: 'online', label: 'Онлайн', icon: 'globe' },
]

export default function HomePage() {
  const { tasks, profile, tasksLoading, tasksError, reloadRequests } = useApp()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [showCategories, setShowCategories] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const activeTasks = tasks.filter((task) => task.status === 'created')
  const matching = activeTasks.filter((task) => {
    const sameDistrict = task.district.trim().toLocaleLowerCase('ru') === profile.district.trim().toLocaleLowerCase('ru')
    const matchesFilter = filter === 'all' || (filter === 'urgent' && task.urgent) || (filter === 'online' && task.online) || (filter === 'near' && !task.online && task.city === profile.city && sameDistrict)
    return matchesFilter && (category === 'all' || category === task.category) && `${task.title} ${task.description} ${task.reward} ${task.tags.join(' ')}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))
  })
  const reset = () => { setSearch(''); setFilter('all'); setCategory('all'); setVisibleCount(6) }
  const selectCategory = (id) => { setCategory(id); setVisibleCount(6) }

  return <div className="home-page">
    <section className="home-hero">
      <div className="hero-copy"><span className="eyebrow"><span className="status-dot" />Сообщество взаимопомощи</span><h1>Немного времени.<br /><span>Много добра.</span></h1><p>Помогайте людям рядом.<br className="mobile-break" /> Иногда для этого нужно совсем немного.</p><a className="hero-link" href="#/create">Мне нужна помощь<Icon name="arrow" size={17} /></a></div>
      <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-heart"><Icon name="heart" size={65} /></div><div className="art-spark"><Icon name="sparkles" size={28} /></div><div className="art-message"><Icon name="check" size={15} />Спасибо за помощь!</div><span className="art-dot dot-one" /><span className="art-dot dot-two" /></div>
    </section>

    <div className="home-layout">
      <section className="feed-section" aria-labelledby="feed-heading">
        <div className="section-heading"><div><span className="eyebrow">Найдите своё доброе дело</span><h2 id="feed-heading">Рядом с вами</h2></div><span className="feed-location"><Icon name="pin" size={13} />{profile.district}</span></div>
        <div className="search-row"><label className="search-field"><Icon name="search" size={19} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(6) }} placeholder="Какая помощь вам по силам?" aria-label="Поиск заявок" /></label><button className={`category-toggle ${category !== 'all' ? 'has-filter' : ''}`} aria-label="Фильтр по категории" aria-expanded={showCategories} aria-controls="mobile-categories" onClick={() => setShowCategories(!showCategories)}><Icon name="filter" size={21} /></button></div>
        {showCategories && <div className="mobile-categories" id="mobile-categories"><button className="chip" aria-pressed={category === 'all'} onClick={() => selectCategory('all')}>Все категории</button>{categories.map((item) => <button key={item.id} className="chip" aria-pressed={category === item.id} onClick={() => selectCategory(item.id)}>{item.label}</button>)}</div>}
        <div className="feed-filters" role="group" aria-label="Фильтры заявок">{filters.map((item) => <button className="chip" key={item.id} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setVisibleCount(6) }}>{item.icon && <Icon name={item.icon} size={14} />}{item.label}</button>)}</div>
        <div className="feed-result-line"><span aria-live="polite">{!tasksLoading && !tasksError && <>{plural(matching.length)}{filter === 'near' ? ' в вашем городе и районе' : ' в ленте'}</>}</span><button type="button" onClick={() => reloadRequests()} disabled={tasksLoading}>Обновить</button>{category !== 'all' && <button onClick={() => selectCategory('all')}>{categories.find((item) => item.id === category).label}<Icon name="close" size={12} /></button>}</div>
        <RequestsStatus />
        {!tasksLoading && !tasksError && <div className="request-grid">{matching.slice(0, visibleCount).map((task) => <RequestCard key={task.id} task={task} />)}{!matching.length && <div className="empty-state"><Icon name="search" size={32} /><h3>{!activeTasks.length ? 'Пока нет открытых заявок' : 'Пока ничего не нашлось'}</h3><p>{!activeTasks.length ? 'Создайте первую заявку — расскажите, какая помощь вам нужна.' : 'Попробуйте изменить запрос или выбрать другую категорию.'}</p>{!activeTasks.length ? <a href="#/create" className="button button-primary">Создать заявку</a> : <button className="button button-secondary" onClick={reset}>Сбросить фильтры</button>}</div>}</div>}
        {!tasksLoading && !tasksError && matching.length > visibleCount && <button className="button button-outline load-more" onClick={() => setVisibleCount((count) => count + 6)}>Показать ещё<Icon name="plus" size={16} /></button>}
        <p className="feed-kind-note"><Icon name="heart" size={14} />Каждое доброе дело делает нас ближе</p>
      </section>

      <aside className="home-sidebar">
        <section className="sidebar-categories"><h3>Чем вы можете помочь?</h3><button className={category === 'all' ? 'is-selected' : ''} onClick={() => selectCategory('all')} aria-pressed={category === 'all'}><span className="category-icon tone-green"><Icon name="sparkles" size={18} /></span><span>Все категории</span><span className="category-count">{activeTasks.length}</span></button>{categories.map((item) => <button key={item.id} className={category === item.id ? 'is-selected' : ''} onClick={() => selectCategory(item.id)} aria-pressed={category === item.id}><span className={`category-icon tone-${item.tone}`}><Icon name={item.icon} size={18} /></span><span>{item.label}</span><span className="category-count">{activeTasks.filter((task) => task.category === item.id).length}</span></button>)}</section>
        <section className="kindness-panel"><span className="kindness-icon"><Icon name="people" size={25} /></span><h3>Хорошие люди<br />ближе, чем кажется</h3><p>Здесь помогают по-соседски: делятся временем, знаниями и заботой. Просто так.</p><div><Icon name="heart" size={15} />Без оплаты. От всего сердца.</div></section>
        <a href="#/create" className="sidebar-create"><span><strong>Нужна помощь?</strong><small>Расскажите о своей задаче</small></span><Icon name="arrow" size={19} /></a>
      </aside>
    </div>
  </div>
}
