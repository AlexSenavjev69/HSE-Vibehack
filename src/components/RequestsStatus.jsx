import { useApp } from '../context/useApp'

export default function RequestsStatus() {
  const { tasksLoading, tasksError, reloadRequests } = useApp()
  if (tasksLoading) return <div className="empty-state" role="status"><p>Загружаем заявки…</p></div>
  if (tasksError) return <div className="empty-state" role="alert"><h2>Не удалось загрузить заявки</h2><p>{tasksError}</p><button className="button button-secondary" onClick={() => reloadRequests()}>Попробовать снова</button></div>
  return null
}
