import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [],
    base: '/',
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: './index.html'
            },
            output: {
                manualChunks: undefined
            }
        }
    },
    server: {
        port: 3000,
        open: true
    },
    optimizeDeps: {
        include: ['react', 'react-dom']
    },
    publicDir: 'public'
})
