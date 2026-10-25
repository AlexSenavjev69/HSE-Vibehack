import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { profileApiPlugin } from './server/vite-profile-api.js'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => ({
  plugins: [react(), ...(command === 'serve' && mode === 'development' ? [profileApiPlugin(loadEnv(mode, process.cwd(), ''))] : [])],
}))
