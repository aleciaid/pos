import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/webhook': {
                target: 'https://webhook.site',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/webhook/, '')
            },
            '/api/webhook-api': {
                target: 'https://api.webhook.site',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/webhook-api/, '')
            }
        }
    }
})
