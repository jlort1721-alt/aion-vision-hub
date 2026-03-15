# PWA — AION Vision Hub

## Architecture

The PWA is powered by **vite-plugin-pwa** with **Workbox** for service worker generation and cache management.

### Key files

| File | Purpose |
|------|---------|
| `vite.config.ts` | VitePWA plugin config: manifest, workbox strategies, runtime caching |
| `src/components/pwa/PWAUpdateNotification.tsx` | Registers SW via `useRegisterSW`, shows update/offline toasts via Sonner |
| `src/components/pwa/PWAInstallPrompt.tsx` | Handles `beforeinstallprompt`, shows install toast |
| `src/vite-env.d.ts` | TypeScript reference for `virtual:pwa-register/react` |
| `scripts/generate-icons.js` | Generates PNG icons from SVG template using sharp |

### Generated at build time (in `dist/`)

- `sw.js` — Workbox service worker with precache manifest (content-hashed)
- `workbox-*.js` — Workbox runtime library
- `manifest.webmanifest` — Web app manifest (auto-generated from vite config)

---

## Cache Strategies

| Resource | Strategy | TTL | Notes |
|----------|----------|-----|-------|
| Build assets (JS, CSS, HTML) | **Precache** | Until next deploy | Hash-based versioning via Workbox |
| Icons, SVG, images | **CacheFirst** | 30 days, max 200 entries | `aion-images` cache |
| Fonts (woff2, ttf) | **CacheFirst** | 1 year, max 20 entries | `aion-fonts` cache |
| Supabase API | **NetworkOnly** | — | Auth/realtime never cached |
| OpenAI / Anthropic / ElevenLabs | **NetworkOnly** | — | AI APIs never cached |
| SPA navigation | **navigateFallback** | — | Always serves `/index.html` from precache |

---

## Install Flow

1. User visits the app in a supported browser (Chrome, Edge, Samsung Internet)
2. Browser fires `beforeinstallprompt` after meeting installability criteria
3. After 30 seconds, a Sonner toast appears: "Install AION Vision Hub"
4. User clicks "Install" → browser native install dialog
5. On success, `appinstalled` event fires → confirmation toast
6. If already installed (`display-mode: standalone`), no prompt is shown

### Installability requirements (enforced by browser)

- Served over **HTTPS** (or localhost for dev)
- Valid **manifest.webmanifest** with `name`, `icons` (192px + 512px PNG), `start_url`, `display`
- Registered **service worker** with a fetch handler

---

## Update Flow

1. `PWAUpdateNotification` registers the SW via `useRegisterSW` (from `virtual:pwa-register/react`)
2. Every 60 minutes, `registration.update()` checks for a new SW
3. When Workbox detects a new precache manifest, `needRefresh` becomes `true`
4. A persistent Sonner toast appears: "New version available" with "Update" / "Later"
5. "Update" calls `updateServiceWorker(true)` → `skipWaiting()` + page reload
6. "Later" dismisses; the update activates on next full navigation

**`registerType: "prompt"`** ensures the user is never force-reloaded mid-session (important for live surveillance views).

---

## Offline Support

- The **app shell** (HTML, JS, CSS) is fully precached and available offline
- **SPA routing** works offline via `navigateFallback: "/index.html"`
- **Data** from Supabase is **not** cached (NetworkOnly) — pages show loading/error states when offline
- **Images and fonts** previously visited are available from CacheFirst caches

---

## Icon Generation

Icons are generated from SVG templates using `sharp`:

```bash
# Generate all PNG icons
npm run generate-icons

# Automatically runs before build via prebuild hook
npm run build
```

Output: `public/icons/icon-{72,96,128,144,152,192,384,512}.png` + maskable variants at 192 and 512.

The manifest references both PNG icons (for compatibility) and one SVG icon with `sizes: "any"`.

---

## Development

To test the PWA in development:

1. In `vite.config.ts`, set `devOptions.enabled: true`
2. Run `npm run dev`
3. Open Chrome DevTools → Application → Service Workers

For production testing:

```bash
npm run build
npm run preview
```

Then check:
- **Application → Manifest** — all fields populated, icons load
- **Application → Service Workers** — registered, activated
- **Application → Cache Storage** — workbox-precache contains assets
- **Lighthouse → PWA audit** — target: 100

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Install prompt not showing | Check HTTPS, verify manifest has 192px + 512px PNG icons, ensure SW is registered |
| Old SW stuck | Clear site data in DevTools (Application → Clear site data) |
| CSP blocking SW | Verify `worker-src 'self'` in Content-Security-Policy in `index.html` |
| Update toast not appearing | Check `registerType: "prompt"` in vite config |
| Offline not working | SW only works in production builds — use `npm run build && npm run preview` |
| iOS Safari no install prompt | iOS does not support `beforeinstallprompt` — users must use "Add to Home Screen" manually |
