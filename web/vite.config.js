import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [],
    base: '/max_project_pilot/',
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            }
        },
        // Добавьте эту настройку для копирования статических файлов
        assetsDir: 'assets',
        copyPublicDir: true
    },
    publicDir: 'public',
    server: {
        port: 3000,
        open: true
    },
    optimizeDeps: {
        include: ['react', 'react-dom']
    }
})
