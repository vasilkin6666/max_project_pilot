import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '/project-pilot-max/',
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                manualChunks: {
                    'max-ui': ['@maxhub/max-ui'],
                    'vendor': ['react', 'react-dom'],
                    'animations': ['framer-motion']
                }
            }
        }
    },
    server: {
        port: 3000,
        open: true
    }
})
