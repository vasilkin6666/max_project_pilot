import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [],
    base: '/project-pilot-max/',
    build: {
        outDir: 'dist',
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
