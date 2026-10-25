import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { getTelegramIdentity, useTestTelegramId } from '../../lib/telegram'
import { isProfileReady, requestProfile } from '../../lib/profile'
import ProfileForm from '../profile/ProfileForm'
import './OnboardingPage.scss'

export default function ProfileGate({ children }) {
  const [attempt, setAttempt] = useState(0)
  const [session, setSession] = useState({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function bootstrap() {
      try {
        const identity = await getTelegramIdentity(controller.signal)
        const user = await requestProfile('bootstrap', identity, undefined, controller.signal)
        if (active) setSession({ status: 'loaded', identity, user })
      } catch (error) {
        if (active && error.name !== 'AbortError') setSession({ status: 'error', error: error.message })
      }
    }
    bootstrap()
    return () => { active = false; controller.abort() }
  }, [attempt])
  async function saveProfile(values) {
    const user = await requestProfile('save', session.identity, values)
    if (!isProfileReady(user)) throw new Error('Профиль ещё не заполнен. Проверьте все поля.')
    setSession((current) => ({ ...current, user }))
    return user
  }
  if (session.status === 'loaded' && isProfileReady(session.user)) return children({ user: session.user, saveProfile })
  return <div className="onboarding-shell">
    <header className="onboarding-brand"><span className="brand-icon"><Icon name="heart" size={24} /></span><span>добрые дела<span className="brand-dot">.</span></span></header>
    <main className="onboarding-content">
      {session.status === 'loading' && <section className="onboarding-status panel" role="status"><span className="onboarding-symbol"><Icon name="heart" size={30} /></span><h1>{useTestTelegramId ? 'Загружаем профиль' : 'Входим через Telegram'}</h1><p>{useTestTelegramId ? 'Проверяем ваш профиль. Это займёт несколько секунд.' : 'Ждём данные Telegram и проверяем ваш профиль.'}</p><span className="loading-dots" aria-hidden="true">•••</span></section>}
      {session.status === 'error' && <section className="onboarding-status panel" role="alert"><span className="onboarding-symbol"><Icon name="user" size={30} /></span><h1>Не удалось войти</h1><p>{session.error}</p><button type="button" className="button button-primary" onClick={() => { setSession({ status: 'loading' }); setAttempt((value) => value + 1) }}>Попробовать снова</button></section>}
      {session.status === 'loaded' && <>
        <div className="page-heading"><span className="eyebrow">Рады знакомству</span><h1>Начнём с вас</h1><p>Заполните профиль, чтобы находить добрые дела и помогать друг другу.</p></div>
        <ProfileForm profile={session.user} onSave={async (values) => { await saveProfile(values); window.location.hash = '/' }} onboarding />
      </>}
    </main>
    <footer className="onboarding-footer"><Icon name="heart" size={14} /> Маленькие дела. Большое значение.</footer>
  </div>
}
