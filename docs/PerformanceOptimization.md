# Performance Optimization -- AION Vision Hub

## Code Splitting

All 21 page routes use `React.lazy()` with `Suspense` fallback (`PageLoader` component).
Non-critical app-level components (CommandPalette, PWA notifications) are also lazy-loaded.

**Result**: Main bundle reduced from **349KB to 103KB** (70.5% reduction).

### Lazy-Loaded Pages

```typescript
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LiveViewPage = lazy(() => import("@/pages/LiveViewPage"));
// ... 19 more pages
```

Each page is loaded on-demand when the user navigates to the route. A `PageLoader` spinner is shown during the load.

### Lazy-Loaded App Components

```typescript
// CommandPalette — only loads on Cmd+K interaction
const CommandPalette = lazy(() => import("@/components/CommandPalette"));

// PWA components — only loads when update/install prompts are needed
const PWAUpdateNotification = lazy(() => import("@/components/pwa/PWAUpdateNotification")...);
const PWAInstallPrompt = lazy(() => import("@/components/pwa/PWAInstallPrompt")...);
```

---

## I18n Translation Splitting

Translations were extracted from the monolithic `I18nContext.tsx` (49KB inline) into separate lazy-loaded files:

| File | Size | Loaded When |
|---|---|---|
| `src/i18n/es.ts` | ~21KB | User language is Spanish |
| `src/i18n/en.ts` | ~19KB | User language is English |

Only the active language is loaded at runtime via `import()`. Language switching triggers a dynamic import of the new language file.

---

## Vendor Chunks (`vite.config.ts`)

Dynamic `manualChunks` function separates vendor libraries for optimal caching:

| Chunk | Libraries | Size | Gzip |
|---|---|---|---|
| `vendor-react` | react, react-dom, react-router-dom | 161KB | 52KB |
| `vendor-ui` | All @radix-ui/* components | 151KB | 48KB |
| `vendor-query` | @tanstack/react-query | 37KB | 11KB |
| `vendor-supabase` | @supabase/supabase-js | 172KB | 46KB |

### Heavy Libraries — Lazy Only (NOT in vendor chunks)

These libraries are intentionally excluded from `manualChunks` so they only load with the pages that need them:

| Library | Size | Used By |
|---|---|---|
| recharts | ~400KB | DashboardPage, ReportsPage |
| leaflet + markercluster | ~197KB (in SitesPage) | SitesPage |
| xlsx (SheetJS) | ~284KB | DatabasePage, ReportsPage |

### Build Configuration

```typescript
build: {
  target: 'es2020',
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes("react-dom") || id.includes("react/") || id.includes("react-router")) return "vendor-react";
        if (id.includes("@radix-ui/")) return "vendor-ui";
        if (id.includes("@tanstack/react-query")) return "vendor-query";
        if (id.includes("@supabase/")) return "vendor-supabase";
        // Heavy libs (recharts, leaflet, xlsx) auto-split with lazy pages
      },
    },
  },
  chunkSizeWarningLimit: 500,
}
```

---

## Before/After Metrics

### Phase 1 (Initial Code Splitting)

| Metric | Before | After | Reduction |
|---|---|---|---|
| Main bundle | 1,196KB | 349KB | 71% |
| Per-page chunks | 0 | 21 | On-demand loading |

### Phase 2 (Bundle Optimization — Current)

| Metric | Before | After | Reduction |
|---|---|---|---|
| Main bundle (index.js) | 349.83KB | 103.16KB | **70.5%** |
| Main bundle gzip | 98.11KB | 30.75KB | **68.7%** |
| Vendor charts in initial load | 422KB (always) | 0KB (lazy) | **100%** |
| I18n in main bundle | ~49KB (both langs) | 0KB (lazy) | **100%** |
| CommandPalette in main | ~17KB | 0KB (lazy) | **100%** |
| PWA in main bundle | ~3KB | 0KB (lazy) | **100%** |
| Unused deps (framer-motion) | 3 packages | Removed | Clean |

### Critical Path Comparison

**Before (initial JS to parse):**

```text
index.js:      349KB (98KB gzip)  <- BOTTLENECK
vendor-react:  160KB (52KB gzip)
vendor-ui:     113KB (36KB gzip)
vendor-query:   37KB (11KB gzip)
---------------------------------
Total:         659KB (197KB gzip)
```

**After (initial JS to parse):**

```text
index.js:       103KB (31KB gzip)  <- 70% SMALLER
vendor-react:   161KB (52KB gzip)
vendor-ui:      151KB (48KB gzip)
vendor-query:    37KB (11KB gzip)
vendor-supabase: 172KB (46KB gzip)  <- separated for caching
---------------------------------
Total:          624KB (188KB gzip)
```

**Net initial load reduction: 35KB raw / 9KB gzip** plus dramatically faster parse time due to smaller critical-path chunk.

---

## React Query Caching

Server state caching via TanStack React Query:

- Device lists: `staleTime: 30s`, `gcTime: 5min`
- Events: `staleTime: 10s` (real-time data)
- Settings: `staleTime: 5min` (rarely changes)
- Reports: `staleTime: 1min`

---

## Changes Summary

1. **I18n translations split** — `src/i18n/es.ts` and `src/i18n/en.ts` loaded dynamically
2. **CommandPalette lazy-loaded** — only loads with `React.lazy` in AppLayout
3. **PWA components lazy-loaded** — `PWAUpdateNotification` and `PWAInstallPrompt`
4. **manualChunks refactored** — function-based, recharts removed (auto-splits with lazy pages)
5. **vendor-supabase separated** — better long-term caching
6. **framer-motion removed** — unused dependency (3 packages)

---

## Bundle Analysis

```bash
npm run build
# Check dist/assets/ for chunk sizes
# Use vite-plugin-visualizer for detailed analysis:
# npm install --save-dev rollup-plugin-visualizer
```
