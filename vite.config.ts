import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const srcPath = path.resolve(__dirname, "./src")
    console.log(">>> VITE ALIAS RESOLVED TO:", srcPath)
    return {
        plugins: [react()],
        base: './', // Ensure assets are loaded relatively for Electron
        resolve: {
            alias: {
                "@": fileURLToPath(new URL('./src', import.meta.url))
            },
        },
        define: {
            'process.env': env,
            'API_BASE_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5050/api'),
        },
        server: {
            port: parseInt(env.VITE_PORT) || 5173,
        },
    }
})
