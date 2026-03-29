# Third-Party Licenses — AION Security Platform

**Version:** 1.0
**Date:** 2026-03-29
**Total direct dependencies:** 89 (production) + 27 (development)

## License Summary

| License | Count (Production) | Count (Dev) | Risk |
|---------|-------------------|-------------|------|
| MIT | 72 | 25 | Low |
| Apache-2.0 | 11 | 2 | Low |
| ISC | 1 | 0 | Low |
| BSD-2-Clause | 2 | 0 | Low |
| MIT-0 | 1 | 0 | Low |
| Unlicense | 1 | 0 | Low |
| MPL-2.0 OR Apache-2.0 | 1 | 0 | Low (Apache-2.0 elected) |

**No GPL, AGPL, or LGPL licenses detected in direct dependencies.**

---

## Dual-Licensed Components

| Component | Licenses Available | Elected License | Rationale |
|-----------|-------------------|-----------------|-----------|
| dompurify 3.3.3 | MPL-2.0 OR Apache-2.0 | Apache-2.0 | Avoids copyleft; compatible with proprietary distribution |

---

## Production Dependencies — Frontend

### MIT License

| Component | Version | Upstream |
|-----------|---------|----------|
| react | 18.3.1 | https://github.com/facebook/react |
| react-dom | 18.3.1 | https://github.com/facebook/react |
| react-router-dom | 6.30.3 | https://github.com/remix-run/react-router |
| @tanstack/react-query | 5.83.0 | https://github.com/TanStack/query |
| @tanstack/react-virtual | 3.13.23 | https://github.com/TanStack/virtual |
| zod | 3.25.76 | https://github.com/colinhacks/zod |
| @hookform/resolvers | 3.10.0 | https://github.com/react-hook-form/resolvers |
| react-hook-form | 7.61.1 | https://github.com/react-hook-form/react-hook-form |
| @radix-ui/* (26 packages) | various | https://github.com/radix-ui/primitives |
| @react-three/drei | 9.114.0 | https://github.com/pmndrs/drei |
| @react-three/fiber | 8.17.10 | https://github.com/pmndrs/react-three-fiber |
| three | 0.183.2 | https://github.com/mrdoob/three.js |
| @sentry/react | 10.46.0 | https://github.com/getsentry/sentry-javascript |
| @supabase/supabase-js | 2.98.0 | https://github.com/supabase/supabase-js |
| clsx | 2.1.1 | https://github.com/lukeed/clsx |
| cmdk | 1.1.1 | https://github.com/pacocoursey/cmdk |
| date-fns | 3.6.0 | https://github.com/date-fns/date-fns |
| embla-carousel-react | 8.6.0 | https://github.com/davidjerleke/embla-carousel |
| framer-motion | 12.38.0 | https://github.com/framer/motion |
| input-otp | 1.4.2 | https://github.com/guilhermerodz/input-otp |
| next-themes | 0.3.0 | https://github.com/pacocoursey/next-themes |
| react-day-picker | 8.10.1 | https://github.com/gpbl/react-day-picker |
| react-resizable-panels | 2.1.9 | https://github.com/bvaughn/react-resizable-panels |
| recharts | 2.15.4 | https://github.com/recharts/recharts |
| sonner | 1.7.4 | https://github.com/emilkowalski/sonner |
| tailwind-merge | 2.6.0 | https://github.com/dcastil/tailwind-merge |
| tailwindcss-animate | 1.0.7 | https://github.com/jamiebuilds/tailwindcss-animate |
| vaul | 0.9.9 | https://github.com/emilkowalski/vaul |
| leaflet.markercluster | 1.5.3 | https://github.com/Leaflet/Leaflet.markercluster |

### Apache-2.0 License

| Component | Version | Upstream |
|-----------|---------|----------|
| @mediapipe/tasks-vision | 0.10.32 | https://github.com/google/mediapipe |
| class-variance-authority | 0.7.1 | https://github.com/joe-bell/cva |
| hls.js | 1.6.15 | https://github.com/video-dev/hls.js |

### ISC License

| Component | Version | Upstream |
|-----------|---------|----------|
| lucide-react | 0.462.0 | https://github.com/lucide-icons/lucide |

### BSD-2-Clause License

| Component | Version | Upstream |
|-----------|---------|----------|
| leaflet | 1.9.4 | https://github.com/Leaflet/Leaflet |

### MPL-2.0 OR Apache-2.0 (Apache-2.0 elected)

| Component | Version | Upstream |
|-----------|---------|----------|
| dompurify | 3.3.3 | https://github.com/cure53/DOMPurify |

---

## Production Dependencies — Backend

### MIT License

| Component | Version | Upstream |
|-----------|---------|----------|
| fastify | 5.8.2 | https://github.com/fastify/fastify |
| fastify-plugin | 4.5.1 | https://github.com/fastify/fastify-plugin |
| fastify-type-provider-zod | 6.1.0 | https://github.com/turkerdev/fastify-type-provider-zod |
| @fastify/cors | 10.1.0 | https://github.com/fastify/fastify-cors |
| @fastify/helmet | 13.0.2 | https://github.com/fastify/fastify-helmet |
| @fastify/jwt | 8.0.1 | https://github.com/fastify/fastify-jwt |
| @fastify/rate-limit | 10.3.0 | https://github.com/fastify/fastify-rate-limit |
| @fastify/swagger | 8.15.0 | https://github.com/fastify/fastify-swagger |
| @fastify/swagger-ui | 3.1.0 | https://github.com/fastify/fastify-swagger-ui |
| @fastify/websocket | 11.2.0 | https://github.com/fastify/fastify-websocket |
| ioredis | 5.10.0 | https://github.com/redis/ioredis |
| pino | 9.14.0 | https://github.com/pinojs/pino |
| pino-pretty | 11.3.0 | https://github.com/pinojs/pino-pretty |
| resend | 6.9.4 | https://github.com/resend/resend-node |
| zod | 3.25.76 | https://github.com/colinhacks/zod |
| undici | 7.22.0 | https://github.com/nodejs/undici |
| onvif | 0.7.4 | https://github.com/agsh/onvif |
| fast-xml-parser | 4.5.4 | https://github.com/NaturalIntelligence/fast-xml-parser |
| node-digest-auth-client | 1.0.6 | https://github.com/nicktomlin/node-digest-auth-client |

### Apache-2.0 License

| Component | Version | Upstream |
|-----------|---------|----------|
| drizzle-orm | 0.38.4 | https://github.com/drizzle-team/drizzle-orm |
| prom-client | 15.1.3 | https://github.com/siimon/prom-client |
| @opentelemetry/* (8 packages) | various | https://github.com/open-telemetry/opentelemetry-js |

### BSD-2-Clause License

| Component | Version | Upstream |
|-----------|---------|----------|
| dotenv | 16.6.1 | https://github.com/motdotla/dotenv |

### MIT-0 License

| Component | Version | Upstream |
|-----------|---------|----------|
| nodemailer | 8.0.2 | https://github.com/nodemailer/nodemailer |

### Unlicense (Public Domain)

| Component | Version | Upstream |
|-----------|---------|----------|
| postgres | 3.4.8 | https://github.com/porsager/postgres |

---

## Notes

- All @types/* packages are licensed under MIT.
- Development-only dependencies (eslint, vitest, typescript, etc.) are not distributed with the product.
- Transitive dependencies inherit from their parent's license ecosystem; the full transitive tree should be validated via SCA tooling (e.g., `npm audit`, Snyk, or Trivy).
- This document must be updated whenever dependencies are added or upgraded.
