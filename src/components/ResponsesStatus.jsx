import { useApp } from '../context/useApp'

export default function ResponsesStatus() {
  const { responsesLoading, responsesError, reloadResponses } = useApp()
  if (responsesLoading) return <div className="empty-state" role="status"><p>Загружаем отклики…</p></div>
  if (responsesError) return <div className="empty-state" role="alert"><h2>Не удалось загрузить отклики</h2><p>{responsesError}</p><button className="button button-secondary" onClick={() => reloadResponses()}>Попробовать снова</button></div>
  return null
}
