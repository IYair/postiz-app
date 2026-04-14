# Responsive Calendar Section — Spec

**Status:** Approved
**Date:** 2026-04-14
**Branch:** `feat/responsive-calendar`
**Owner:** Fork `IYair/postiz-app`

## Problem

La sección `/launches` (Calendario, primera del sidebar) no es usable en mobile. Sidebar fijo de 260px, grid semanal hardcoded `[136px_repeat(7,1fr)]`, modales con `max-w-[1400px]`, popovers con widths fijos, tooltips `hover` que no funcionan en touch. Impide gestionar publicaciones desde el móvil — que es el dispositivo principal de muchos creadores.

## Goals

1. Todos los flujos del calendario funcionales y usables en **375px–430px** (iPhone SE → Pro Max) sin scroll horizontal indeseado.
2. **Zero regresión desktop** (≥1024px): layout, spacing y comportamientos actuales intactos.
3. Migración **iterativa, bloque por bloque**, cada bloque mergeable de forma independiente.
4. Sin dependencias nuevas de npm (solo Tailwind 3 + lo ya instalado: Mantine, react-tooltip, Uppy, Polotno, CopilotKit, react-dnd).

## Non-Goals

- Rediseño visual (solo responsive, no rebranding).
- Otras secciones del sidebar (analytics, settings, etc.) — irán en PRs futuras.
- Reemplazar react-dnd por biblioteca touch-friendly (drag&drop se **deshabilita** en mobile en esta iteración).
- Internacionalización nueva; reusamos `useT()` existente.

## Design Decisions

### Breakpoints
Mobile-first con los breakpoints de Tailwind:
- **< 640px** (`<sm`) — mobile, layout stackeado
- **≥ 640px** (`sm`) — tablets pequeñas
- **≥ 768px** (`md`) — tablets grandes / desktop chico
- **≥ 1024px** (`lg`) — desktop (comportamiento actual)

Breakpoint principal de quiebre: **`md`** (768px). Por debajo aplicamos patrones mobile.

### Shell del calendario
- **Sidebar de canales** (`launches.component.tsx`): en `<md` se convierte en **drawer off-canvas** disparado por botón hamburger en el header del contenido. Overlay con backdrop; cerrar con tap fuera o botón ✕. En `≥md` comportamiento actual (fijo, 260px / 100px collapsed).
- **Hamburger button**: visible solo en `<md`, posicionado arriba-izquierda del área de `Filters`.

### Filters (Day/Week/Month/List)
- En `<md`: stack vertical. Navegador prev/today/next en su propia fila; selector de vista Day/Week/Month en segunda fila a ancho completo; customer selector y toggle calendar/list en tercera fila.
- **Ocultar botón "Week"** en `<md` (por decisión de producto: Week View colapsa a agenda Day). Si el estado actual era `week`, auto-reemplazar por `day` en efecto al entrar a mobile.

### Vistas del calendario
- **MonthView**: conservar grid 7 columnas pero reducir a representación **mini-dot indicator** (no mostrar posts expandidos) en `<md`. Tap en día abre DayView de ese día.
- **WeekView**: en `<md`, **colapsar a DayView del día actual** con swipe/flechas para navegar días. El estado de vista `week` se coerciona a `day` internamente en mobile (sin perder la preferencia del usuario en desktop).
- **DayView**: ya acepta scroll vertical; en `<md` reducir ancho de la columna de horas de `136px` a `64px`, ocultar iconos decorativos, tap en slot vacío abre creación.
- **ListView**: ya es responsive; solo ajustar `padding` y tamaños de texto.
- **CalendarItem** (post card): en `<md`, ocultar acciones hover (duplicate/stats/delete/preview); convertirlas a **bottom sheet** que aparece al tap largo (>400ms) o botón `⋯` visible.

### Editor de post (AddEditModal)
- En `<md`: modal **fullscreen** (`w-screen h-screen max-w-none`), sin padding externo.
- Estructura actual en `≥md`: editor izquierda + preview derecha (lado a lado).
- Estructura en `<md`: **tabs horizontales** en la parte superior: `[Edit] [Preview] [Settings]`. Solo una visible a la vez. Tabs sticky arriba; botón `Save` sticky abajo.
- Toolbar del editor (bold/u/heading/bullets/a/mention/delay/finisher): permite scroll horizontal en `<md` si no caben.
- CopilotPopup (chat IA flotante): en `<md` se ancla a la parte inferior como **bottom sheet** al abrirse.
- Preview de plataformas (`show.all.providers`): grid de imágenes `grid-cols-2` → `grid-cols-1` en `<md` cuando hay >1 imagen y el ratio no lo permite.

### Popovers y componentes compartidos
Patrón universal para popovers en `<md`: convertir a **bottom sheet centered** (`fixed inset-x-0 bottom-0 max-h-[80vh]` con backdrop). Aplica a:
- `date.picker`, `repeat.component`, `tags.component` (+ sus modales Add/Delete tag), `select.customer`, `information.component` (tooltip char-counter), `repeat.component`, menús `⋯`.
- `InformationComponent` tooltip: en `<md` reorganizar el grid `[auto_auto_auto]` a stack vertical de 1 columna.
- `GeneralPreviewComponent`: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.

### Modales secundarios
Patrón: `max-w-[1400px] w-full` → `w-screen h-screen max-w-none md:h-auto md:max-w-[1400px] md:w-full`. Aplica a `statistics`, `missing-release`, `settings.modal`, `customer.modal`, `time.table`, `bot.picture`, `import-debug-post`, `generator/GeneratorPopup`, `media.component` (+ maximize preview + MediaSettings), `polotno` + `polonto.picture.generation`, `ai.image`, `ai.video`, `DummyCodeComponent`, `SetSelectionModal` (inline calendar.tsx), `"What do you want to do?"` confirms (inline calendar.tsx + manage.modal.tsx), `UrlModal`/`ChromeExtensionWarning`/`ExtensionNotFound` (inline add.provider).

Grids/tablas dentro de cada modal: estadísticas `grid-cols-3` → `grid-cols-1 md:grid-cols-3`; time.table selectores hora/min → stack vertical en `<md`.

### Add Channel flow
- `add.provider.component` (AddProviderComponent): grid de plataformas → `grid-cols-3 sm:grid-cols-4 md:grid-cols-5` → `grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5`.
- `menu/menu.tsx` (3-dots por canal): convertir a bottom sheet en `<md`.
- Web3 providers: stack vertical en `<md`.

### Deleteog / areYouSure
Se dispara desde 10+ puntos. Centralizar responsive en `layout/new-modal.tsx` (si es su wrapper), no en cada call-site. Un solo cambio cubre todos los consumidores.

### Tooltip global (react-tooltip)
En `<md`, los tooltips `hover` son inútiles. Opciones:
- **Elegida**: mantener `data-tooltip-id` pero configurar `react-tooltip` a `events={['click']}` cuando `matchMedia('(max-width: 767px)').matches`. En casos donde el tooltip es la única affordance (ej. canal desconectado), convertir también a click.
- Tooltips puramente decorativos se ocultan con `hidden md:block` si no aportan info crítica en mobile.

### Drag & Drop
En `<md`: deshabilitar `useDrag` de integraciones en sidebar y `useDrag`/`useDrop` de posts entre slots. Exponer reordenamiento vía bottom sheet con botones "Mover arriba/abajo" y picker de fecha/hora en edición.

## Acceptance Criteria

Por bloque: manual QA en viewports 375/390/430/768/1024/1440px. Validar:
1. Sin scroll horizontal en ninguna vista/modal en `<md`.
2. Todos los targets táctiles ≥ 40x40px.
3. Modales en `<md` ocupan fullscreen sin padding externo.
4. Popovers se muestran como bottom sheet en `<md`.
5. Drawer de sidebar abre/cierra correctamente.
6. Editor tabs Edit/Preview/Settings funcionan.
7. Drag&drop deshabilitado en `<md`, reordenamiento accesible vía UI alternativa.
8. Zero regresión en desktop (`≥1024px`) — snapshot visual/manual.

## Constraints

- Tailwind 3 (ya en el proyecto). No upgrade.
- No nuevas deps. Bottom sheets se implementan con `fixed inset-x-0 bottom-0` + Tailwind + manejo manual de `useEffect` para backdrop/escape.
- CLAUDE.md: no `--color-custom*` (deprecated). Usar tokens actuales (`newBgColorInner`, `textColor`, `boxHover`, etc.).
- Linting solo desde raíz: `pnpm lint`.
- Commits frecuentes, rama `feat/responsive-calendar`, conventional commits sin "Co-Authored-By".

## Out of Scope (explícito)

- Touch-friendly drag&drop (queda para follow-up).
- Redesign visual (colores, iconografía nueva).
- Otras secciones sidebar.
- PWA / install banners.
- Tests automatizados de viewport (el proyecto no tiene e2e setup para frontend).

## Deliverables

1. Spec: este doc.
2. Plan: `docs/superpowers/plans/2026-04-14-responsive-calendar.md`.
3. PR `feat/responsive-calendar` → `main`, dividida en commits por bloque.
