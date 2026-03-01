import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: './', // Ensure assets are loaded relatively for Electron
    define: {
      'process.env': env,
      'API_BASE_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5050/api'),
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
    },
  }
})
