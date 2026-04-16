import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
// rollup-plugin-visualizer loaded conditionally via ANALYZE=true

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      scope: "/",
      base: "/",
      injectRegister: false,

      includeAssets: [
        "favicon.ico",
        "icons/*.svg",
        "icons/*.png",
        "placeholder.svg",
        "robots.txt",
      ],

      manifest: {
        name: "Clave Seguridad",
        short_name: "Clave",
        description:
          "Centro de Monitoreo, Control de Acceso y Videovigilancia con IA",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#0a0f1e",
        theme_color: "#3b82f6",
        lang: "es",
        categories: ["security", "business", "utilities"],
        icons: [
          {
            src: "/icons/icon-72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
        shortcuts: [
          {
            name: "Panel Principal",
            url: "/dashboard",
            description: "Abrir panel de operaciones",
          },
          {
            name: "Vista en Vivo",
            url: "/live-view",
            description: "Monitoreo de cámaras en tiempo real",
          },
          {
            name: "Eventos",
            url: "/events",
            description: "Ver eventos de seguridad",
          },
          {
            name: "Incidentes",
            url: "/incidents",
            description: "Gestionar incidentes",
          },
        ],
      },

      workbox: {
        globPatterns: [
          "**/*.{js,css,html}",
          "**/*.{svg,png,ico,webp}",
        ],

        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^\/(?!api\/|go2rtc\/|provisioning\/).*$/],
        navigateFallbackDenylist: [/^\/api\//, /^\/rest\//, /^\/go2rtc\//, /^\/provisioning\//],

        runtimeCaching: [
          // AI APIs: never cache
          {
            urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/ai\.gateway\.lovable\.dev\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/api\.elevenlabs\.io\/.*/i,
            handler: "NetworkOnly",
          },
          // Images: cache-first, 30 days
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "clave-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          // Fonts: cache-first, 1 year
          {
            urlPattern: /\.(?:woff2?|ttf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "clave-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],

        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },

      devOptions: {
        enabled: false,
      },
    }),
    // Run: npm install -D rollup-plugin-visualizer && ANALYZE=true npm run build
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Performance: chunk splitting strategy
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React — loaded on every page
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/react-router")) {
            return "vendor-react";
          }
          // Radix UI primitives — used by layout shell
          if (id.includes("@radix-ui/")) {
            return "vendor-ui";
          }
          // React Query — used across app
          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }
          // HLS.js — only loaded with LiveView (522KB)
          if (id.includes("hls.js")) {
            return "vendor-hls";
          }
          // Three.js / React Three Fiber — only loaded with Immersive3D
          if (id.includes("three") || id.includes("@react-three")) {
            return "vendor-3d";
          }
          // Recharts — only loaded with Dashboard/Reports
          if (id.includes("recharts")) {
            return "vendor-charts";
          }
          // Leaflet — only loaded with Sites
          if (id.includes("leaflet")) {
            return "vendor-maps";
          }
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: "es2020",
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500,
  },
}));
