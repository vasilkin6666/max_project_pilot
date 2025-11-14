import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [],
    base: '/max_project_pilot/',
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: './index.html'
            }
        }
    },
    server: {
        port: 3000,
        open: true
    },
    optimizeDeps: {
        include: ['react', 'react-dom']
    }
})
