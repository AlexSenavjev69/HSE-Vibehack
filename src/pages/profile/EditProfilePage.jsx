import { useApp } from '../../context/useApp'
import Icon from '../../components/Icon'
import ProfileForm from './ProfileForm'
import './ProfilePage.scss'

export default function EditProfilePage() {
  const { user, saveProfile } = useApp()
  return <div className="profile-edit-page narrow-page"><a className="back-link" href="#/profile"><Icon name="back" size={17} />В профиль</a><div className="page-heading"><span className="eyebrow">Ваш профиль</span><h1>О себе</h1><p>Расскажите, в чём вы можете помочь.</p></div><ProfileForm profile={user} onSave={saveProfile} /></div>
}
