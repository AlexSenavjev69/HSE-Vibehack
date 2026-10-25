import { useEffect, useState } from 'react'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import Icon from './components/Icon'
import HomePage from './pages/home/HomePage'
import CreateRequestPage from './pages/create-request/CreateRequestPage'
import ProfilePage from './pages/profile/ProfilePage'
import EditProfilePage from './pages/profile/EditProfilePage'
import ActivityPage from './pages/activity/ActivityPage'
import RequestPage from './pages/requests/RequestPage'
import ProfileGate from './pages/onboarding/ProfileGate'
import './App.scss'

function readRoute() {
  const hash = window.location.hash.slice(1)
  // Telegram uses the initial hash for signed launch parameters, not an app route.
  return hash.startsWith('/') ? hash : '/'
}

function AppLayout() {
  const [route, setRoute] = useState(readRoute)
  const { profile, notice, setNotice, storageError } = useApp()

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const profileActive = route.startsWith('/profile')
  let page
  if (route === '/') page = <HomePage />
  else if (route === '/create') page = <CreateRequestPage />
  else if (route === '/profile') page = <ProfilePage />
  else if (route === '/profile/edit') page = <EditProfilePage />
  else if (route === '/profile/requests') page = <ActivityPage kind="requests" key="requests" />
  else if (route === '/profile/responses') page = <ActivityPage kind="responses" key="responses" />
  else if (route.startsWith('/requests/')) page = <RequestPage id={route.slice('/requests/'.length)} key={route} />
  else page = <div className="empty-state"><Icon name="search" size={36} /><h1>Страница не найдена</h1><a href="#/" className="button button-primary">На главную</a></div>

  useEffect(() => {
    const title = document.querySelector('main h1')?.innerText.replace(/\s+/g, ' ')
    document.title = title ? `${title} — Добрые дела` : 'Добрые дела'
  }, [route])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content').focus() }}>К содержимому</a>
      <header className="site-header"><div className="header-inner">
        <a className="brand" href="#/" aria-label="Добрые дела — главная"><span className="brand-icon"><Icon name="heart" size={24} /></span><span>добрые дела<span className="brand-dot">.</span></span></a>
        <span className="header-location"><Icon name="pin" size={15} />{profile.city}, {profile.district}</span>
        <a className="header-avatar avatar avatar-peach" href="#/profile" aria-label="Открыть профиль">{profile.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</a>
      </div></header>
      <main id="main-content" className="main-content" tabIndex={-1}>{page}</main>
      <footer className="site-footer"><Icon name="heart" size={13} /> Маленькие дела. Большое значение.<span>Профиль сохранён · заявки пока демонстрационные</span></footer>
      <nav className="bottom-nav" aria-label="Основная навигация">
        <a href="#/" className={route === '/' ? 'is-active' : ''} aria-current={route === '/' ? 'page' : undefined}><Icon name="home" /><span>Главная</span></a>
        <a href="#/create" className={`nav-create ${route === '/create' ? 'is-active' : ''}`} aria-current={route === '/create' ? 'page' : undefined}><span className="nav-create-icon"><Icon name="plus" /></span><span>Создать заявку</span></a>
        <a href="#/profile" className={profileActive ? 'is-active' : ''} aria-current={profileActive ? 'page' : undefined}><Icon name="user" /><span>Профиль</span></a>
      </nav>
      <div className="toast-region" aria-live="polite" aria-atomic="true">{notice && <div className="toast"><Icon name="check-circle" size={21} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Закрыть уведомление"><Icon name="close" size={18} /></button></div>}</div>
      {storageError && <div className="storage-notice" role="alert">Браузер не разрешил сохранить данные. Изменения доступны до обновления страницы.</div>}
    </div>
  )
}

export default function App() {
  return <ProfileGate>{({ user, saveProfile }) => <AppProvider key={user.tgId} user={user} saveUser={saveProfile}><AppLayout /></AppProvider>}</ProfileGate>
}
