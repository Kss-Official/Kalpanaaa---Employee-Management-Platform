import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  return {
    // Build identifier surfaced in error_logs diagnostics (Phase 22)
    define: {
      __BUILD_ID__: JSON.stringify(new Date().toISOString().replace(/[:.]/g, '-'))
    },
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html'
        },
        workbox: {
          globPatterns: command === 'build' ? ['**/*.{js,css,html,ico,png,svg,jpeg}'] : [],
          // Keep the face-recognition bundle OUT of the precache. It is a large,
          // lazily-imported chunk that every install was paying for up front, and
          // precaching it bought nothing: the models themselves are fetched from
          // third-party CDNs at runtime (MODEL_URLS in src/lib/faceRecognitionEngine.ts),
          // so face check-in could never work offline regardless. Excluded here it is
          // fetched on demand instead, which shrinks the install and speeds first load.
          //
          // vendor-pdf is deliberately NOT excluded: jspdf is bundled locally, so it
          // genuinely does work offline once precached, and PDF export would regress.
          globIgnores: ['**/vendor-faceapi-*.js'],
          maximumFileSizeToCacheInBytes: 6000000, // 6MB to accommodate large JS bundles and logo
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true
        },
        manifest: {
          name: 'Kalpanaaa Software Solutions',
          short_name: 'KSS HRMS',
          description: 'Kalpanaaa Software Solutions Employee Management System',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-motion': ['framer-motion', 'motion'],
            'vendor-faceapi': ['@vladmandic/face-api'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable']
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
