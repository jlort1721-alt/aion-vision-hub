# Design Tokens & System

Este documento registra los tokens de diseño (Design Tokens) configurados para la plataforma AION Vision Hub, garantizando una identidad visual cohesiva en todos los componentes y páginas.

## Tailwind Configuration & CSS Variables

El Design System está anclado en las variables CSS definidas en `src/index.css` y mapeadas en `tailwind.config.ts`. Este mapeo permite mantener el soporte dinámico para Light y Dark Mode respetando la paleta de colores de AION/Clave Seguridad.

### 1. Brand Colors (Tokens Semánticos Básicos)
Se han establecido variables personalizadas para los colores de marca principales. Deben utilizarse mediante las clases de utilidades en lugar de valores hexadecimales hardcodeados.

| Color | CSS Variable | Tailwind Class | Descripción |
|-------|--------------|----------------|-------------|
| Navy 900 | `--color-navy-900` | `bg-navy-900` | Fondo profundo principal (Dark Mode) |
| Navy 800 | `--color-navy-800` | `bg-navy-800` | Fondos de tarjetas o paneles flotantes |
| Navy 700 | `--color-navy-700` | `bg-navy-700` | Fondos secundarios y acentos |
| Brand Red | `--color-red-600` | `bg-brand-red` | Color de acción primario (CTAs, Alertas) |
| Red 700 | `--color-red-700` | `bg-brand-red-700` | Estado Hover de acciones primarias |
| Gold | `--color-gold-500` | `text-gold`, `bg-gold` | Detalles, íconos de estado, brand accents |

### 2. Shadcn UI / Theme Colors
Las primitivas de Radix UI y componentes Shadcn se alimentan de las siguientes variables dinámicas, las cuales mutan automáticamente dependiendo de si el modo (`.dark`) está activo:

- `--background` → `bg-background`
- `--foreground` → `text-foreground`
- `--card` / `--card-foreground`
- `--popover` / `--popover-foreground`
- `--primary` / `--primary-foreground` (Conectado a Brand Red)
- `--secondary` / `--secondary-foreground` (Conectado a Navy 700 en Dark Mode)
- `--muted` / `--muted-foreground`
- `--accent` / `--accent-foreground`
- `--destructive` / `--success` / `--warning` / `--info`

**Nota:** `--warning` está alineado con el token `--color-gold-500`.

### 3. Utilities adicionales (Glassmorphism)
Para dar a AION Vision Hub un look & feel "Enterprise" y avanzado, se proporcionan utilidades de *Glassmorphism* personalizadas en la capa `@layer utilities`:

- `.glass`: Fondo traslúcido (`bg-background/60`) con desenfoque de fondo y borde sutil.
- `.glass-card`: Efecto glass más opaco, usado en tarjetas de visualización de datos.
- `.glass-panel`: Efecto de máxima profundidad, típicamente usado en modales y overlays interactivos.

### 4. Animaciones y Transiciones (Micro-interacciones)
Se encuentran en `tailwind.config.ts` y en `index.css`:
- **Shimmer:** `.skeleton-shimmer` para estados de carga tipo esqueleto.
- **Pulse:** `.animate-pulse-slow` para componentes "en vivo" o estados de conexión.
- **Transiciones Base:** `--transition` y la clase general `.theme-transitioning` para asegurar que el cambio entre temas oscuro y claro sea suave (200ms - 300ms).

## Migración Realizada (2026-04-19)

Como parte de la Auditoría UX/UI, se identificaron y eliminaron valores estáticos en múltiples archivos, reemplazándolos con tokens del sistema. 

**Archivos refactorizados:**
- `src/pages/SitePortalPage.tsx`
- `src/pages/TVDashboardPage.tsx`
- `src/pages/SitesPage.tsx`
- `src/pages/FloorPlanPage.tsx`
- `src/pages/WallPage.tsx`
- `src/pages/vision-hub/VisionHubPage.tsx`
- `src/pages/PatrolsPage.tsx`
- `src/components/video/SmartCameraCell.tsx`

**Ejemplo de reemplazo:**
- ❌ `<div className="bg-[#0D1B2A] text-[#D4A017]">`
- ✅ `<div className="bg-navy-700 text-gold">`

Este estándar **debe ser respetado estrictamente** para todos los componentes de React a futuro. Nunca emplear sintaxis bracket (ej: `bg-[#HEX]`) para fondos, textos o bordes que formen parte de la paleta semántica.
