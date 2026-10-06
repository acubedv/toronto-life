import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Preview runs behind a proxied host, so we accept any origin and bind to all
// interfaces. HMR must not try to dial a hardcoded host from the browser.
export default defineConfig({
  // base './' keeps assets resolving when hosted from a sub-path (GitHub Pages).
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    strictPort: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
})
