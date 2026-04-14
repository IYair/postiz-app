# Responsive Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar toda la sección `/launches` (Calendario + sus 70+ componentes/modales) a responsive mobile-first manteniendo desktop intacto.

**Architecture:** Mobile-first con breakpoint de quiebre `md` (768px). Sidebar → drawer off-canvas. Vistas Week/Month → colapsan a DayView en mobile. Modales `max-w-[1400px]` → fullscreen en `<md`. Popovers → bottom sheets. Drag&drop deshabilitado en mobile con UI alternativa. Tooltips `hover` → `click` en touch. Centralizamos helpers en dos nuevos archivos: `apps/frontend/src/components/launches/helpers/use.is.mobile.ts` (hook `matchMedia`) y `apps/frontend/src/components/ui/bottom.sheet.tsx` (wrapper reusable).

**Tech Stack:** Next.js 14 (frontend `apps/frontend`), React 18, Tailwind 3, Mantine (modals), react-tooltip, react-dnd, Uppy, CopilotKit. PNPM monorepo.

**Spec:** `docs/superpowers/specs/2026-04-14-responsive-calendar.md`

**Branch:** `feat/responsive-calendar` (ya creada)

**Testing:** Manual QA en viewports 375/390/430/768/1024/1440px vía Chrome DevTools + dispositivo físico. `pnpm lint` desde raíz debe pasar. Zero regresión desktop confirmada visualmente.

---

## Bloque 0 — Foundations (helpers compartidos)

### Task 0.1: Hook `useIsMobile`

**Files:**
- Create: `apps/frontend/src/components/launches/helpers/use.is.mobile.ts`

- [ ] **Step 1: Crear el hook**

```ts
'use client';

import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isMobile;
};
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm -C apps/frontend build` (o `pnpm dev` y validar que no hay error de tipos).
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/launches/helpers/use.is.mobile.ts
git commit -m "feat(calendar): add useIsMobile hook for responsive logic"
```

### Task 0.2: Componente `BottomSheet` reusable

**Files:**
- Create: `apps/frontend/src/components/ui/bottom.sheet.tsx`

- [ ] **Step 1: Implementar wrapper**

```tsx
'use client';

import { FC, ReactNode, useEffect } from 'react';
import clsx from 'clsx';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export const BottomSheet: FC<BottomSheetProps> = ({
  open,
  onClose,
  children,
  maxHeight = '80vh',
  className,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={clsx(
          'relative bg-newBgColorInner rounded-t-[16px] w-full overflow-y-auto',
          'pb-[env(safe-area-inset-bottom)] animate-[slideUp_0.2s_ease-out]',
          className
        )}
        style={{ maxHeight }}
      >
        <div className="sticky top-0 flex justify-center pt-[8px] pb-[4px] bg-newBgColorInner">
          <div className="w-[40px] h-[4px] rounded-full bg-textColor/30" />
        </div>
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Añadir keyframe en global.scss**

Modify: `apps/frontend/src/app/global.scss` (añadir al final)

```scss
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

- [ ] **Step 3: Verificar**

Run: `pnpm -C apps/frontend build`.
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/ui/bottom.sheet.tsx apps/frontend/src/app/global.scss
git commit -m "feat(ui): add BottomSheet component for mobile popovers"
```

---

## Bloque 1 — Shell del calendario

### Task 1.1: Sidebar convertido a drawer en mobile

**Files:**
- Modify: `apps/frontend/src/components/launches/launches.component.tsx` (función `LaunchesComponent`, bloque de return a partir de `<DNDProvider>`)

- [ ] **Step 1: Importar helper y añadir estado drawer**

Añadir imports:
```ts
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';
```

Dentro de `LaunchesComponent`, antes del `return`:
```ts
const isMobile = useIsMobile();
const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 2: Envolver el sidebar con clases responsive + overlay**

Reemplazar el `<div>` del sidebar (actualmente `className={clsx('flex relative flex-col', collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]')}`) por:

```tsx
{isMobile && drawerOpen && (
  <div
    className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
    onClick={() => setDrawerOpen(false)}
    aria-hidden
  />
)}
<div
  className={clsx(
    'flex relative flex-col transition-transform',
    'max-md:fixed max-md:inset-y-0 max-md:start-0 max-md:z-[9999] max-md:w-[280px] max-md:bg-newBgColorInner',
    isMobile && !drawerOpen && 'max-md:-translate-x-full rtl:max-md:translate-x-full',
    collapseMenu === '1' ? 'md:group md:sidebar md:w-[100px]' : 'md:w-[260px]'
  )}
>
```

- [ ] **Step 3: Añadir botón hamburger en el header de contenido**

Reemplazar el bloque `<div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">` por:

```tsx
<div className="bg-newBgColorInner flex-1 flex-col flex p-[12px] md:p-[20px] gap-[12px] min-w-0">
  <div className="flex items-center gap-[8px] md:hidden">
    <button
      onClick={() => setDrawerOpen(true)}
      className="w-[40px] h-[40px] flex items-center justify-center rounded-[8px] border border-newTableBorder bg-newBgColorInner"
      aria-label="Open channels"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  </div>
  <Filters />
  <div className="flex-1 flex min-w-0">
    <Calendar />
  </div>
</div>
```

- [ ] **Step 4: Cerrar drawer al navegar (tap en item)**

Dentro del mapeo de `menuIntegrations.map(...)`, pasar un prop `onItemClick={() => setDrawerOpen(false)}` al `MenuGroupComponent` y propagarlo al `MenuComponent`. Añadir `onClick` wrapping en el `MenuComponent` root `<div>` que llame al handler pasado además del behavior actual.

(El subagente debe ajustar las signatures de `MenuGroupComponent` y `MenuComponent` para aceptar `onItemClick?: () => void` opcional y llamarlo en el click principal.)

- [ ] **Step 5: Validar en DevTools**

Run: `pnpm -C apps/frontend dev` y abrir `/launches` en viewport 375px. Verificar: hamburger visible, tap abre drawer, tap en backdrop cierra, desktop 1280px sin cambios.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/launches/launches.component.tsx
git commit -m "feat(calendar): convert sidebar to off-canvas drawer on mobile"
```

### Task 1.2: Filters responsive

**Files:**
- Modify: `apps/frontend/src/components/launches/filters.tsx`

- [ ] **Step 1: Layout stackeado en mobile**

Reemplazar el root `<div className="text-textColor flex flex-col md:flex-row gap-[8px] items-center select-none">` por:

```tsx
<div className="text-textColor flex flex-col md:flex-row gap-[8px] md:items-center select-none">
```

Reemplazar cada bloque `<div className="flex flex-grow flex-row items-center gap-[10px]">` por `<div className="flex flex-grow flex-row items-center gap-[10px] w-full md:w-auto">`.

El bloque de botones Day/Week/Month: envolver los `<div>` individuales en un contenedor con scroll horizontal si no caben:

```tsx
<div className="flex flex-row p-[4px] border border-newTableBorder rounded-[8px] text-[14px] font-[500] w-full md:w-auto overflow-x-auto">
  <div className={clsx('pt-[6px] pb-[5px] cursor-pointer flex-1 md:w-[74px] text-center rounded-[6px] whitespace-nowrap', calendar.display === 'day' && 'text-textItemFocused bg-boxFocused')} onClick={setDay}>
    {t('day', 'Day')}
  </div>
  {/* repetir para Week y Month con flex-1 md:w-[74px] */}
</div>
```

- [ ] **Step 2: Ocultar botón Week en `<md` y coerción de estado**

Añadir al botón Week la clase `hidden md:block`. Después, en la función `LaunchesComponent` o en el propio Filters, añadir un `useEffect`:

```ts
const isMobile = useIsMobile();
useEffect(() => {
  if (isMobile && calendar.display === 'week') {
    setDay();
  }
}, [isMobile, calendar.display, setDay]);
```

- [ ] **Step 3: Reducir `min-w-[200px]` del display de fecha**

En ambos bloques `<div className="min-w-[200px] text-center bg-newBgColorInner h-full flex items-center justify-center">` reemplazar por `min-w-[140px] md:min-w-[200px] flex-1 md:flex-none`.

- [ ] **Step 4: Validar**

Abrir `/launches` en 375px, confirmar:
- Todo cabe sin scroll horizontal en el componente Filters.
- Tap en Day/Month funciona.
- En desktop el layout es idéntico al previo.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/launches/filters.tsx
git commit -m "feat(calendar): stack filters vertically on mobile, hide week view button"
```

---

## Bloque 2 — Vistas del calendario

### Task 2.1: DayView reducido en mobile

**Files:**
- Modify: `apps/frontend/src/components/launches/calendar.tsx` (función `DayView` y `CalendarColumn` que renderiza la columna de horas)

- [ ] **Step 1: Columna de horas más estrecha**

Buscar el contenedor que tiene `w-[136px]` o similar para la columna de horas en DayView. Reemplazar por `w-[64px] md:w-[136px]`.

Si la columna usa tamaño de texto, cambiar `text-[14px]` por `text-[12px] md:text-[14px]`.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/launches/calendar.tsx
git commit -m "feat(calendar): shrink hour column in DayView on mobile"
```

### Task 2.2: WeekView colapsa a DayView en mobile

**Files:**
- Modify: `apps/frontend/src/components/launches/calendar.tsx` (función `Calendar` que switchea por `display`)

- [ ] **Step 1: Coerción en render**

En el switch/if que selecciona qué vista renderizar según `calendar.display`, añadir antes del retorno:

```tsx
const isMobile = useIsMobile();
const effectiveDisplay = isMobile && calendar.display === 'week' ? 'day' : calendar.display;
```

Usar `effectiveDisplay` en el render en vez de `calendar.display`.

- [ ] **Step 2: Validar**

En 375px, si el usuario viene de desktop con `week`, ve DayView del día actual. En 1280px vuelve a week.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/launches/calendar.tsx
git commit -m "feat(calendar): collapse WeekView to DayView on mobile"
```

### Task 2.3: MonthView con dot indicators

**Files:**
- Modify: `apps/frontend/src/components/launches/calendar.tsx` (función `MonthView`)

- [ ] **Step 1: Altura celda y contenido condicional**

Reemplazar `h-[62px]` en las celdas del grid por `h-[48px] md:h-[62px]`.

En el render de cada celda, buscar el bloque que muestra los posts expandidos (probablemente `{posts.map(...)}`). Envolver en:

```tsx
<div className="hidden md:block">
  {/* contenido actual de posts */}
</div>
<div className="md:hidden flex items-center justify-center mt-[4px]">
  {posts.length > 0 && (
    <div className="w-[6px] h-[6px] rounded-full bg-primary" />
  )}
  {posts.length > 1 && (
    <span className="ms-[4px] text-[10px] text-textColor">{posts.length}</span>
  )}
</div>
```

- [ ] **Step 2: Tap en día abre DayView**

En el `onClick` de la celda, si `isMobile`, llamar a `calendar.setFilters({ startDate: cellDate, endDate: cellDate, display: 'day', customer: calendar.customer })`.

- [ ] **Step 3: Tamaño del texto de día**

Reducir `text-[14px]` a `text-[12px] md:text-[14px]` en el label del número del día.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/launches/calendar.tsx
git commit -m "feat(calendar): compact MonthView with dot indicators on mobile"
```

### Task 2.4: CalendarItem con bottom sheet de acciones

**Files:**
- Modify: `apps/frontend/src/components/launches/calendar.tsx` (componente `CalendarItem`)

- [ ] **Step 1: Importar BottomSheet y useIsMobile**

```ts
import { BottomSheet } from '@gitroom/frontend/components/ui/bottom.sheet';
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';
```

- [ ] **Step 2: Añadir estado y botón `⋯` en mobile**

Dentro de `CalendarItem`, añadir `const [actionsOpen, setActionsOpen] = useState(false); const isMobile = useIsMobile();`.

Las acciones hover actuales (duplicate/preview/stats/delete) están en un bloque `opacity-0 group-hover:opacity-100`. Añadirles clase `hidden md:flex` y luego añadir un botón `⋯` visible solo en mobile:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); setActionsOpen(true); }}
  className="md:hidden absolute end-[4px] top-[4px] w-[28px] h-[28px] flex items-center justify-center rounded-[4px] bg-newBgColor/80"
  aria-label="Post actions"
>
  <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/></svg>
</button>

<BottomSheet open={actionsOpen && isMobile} onClose={() => setActionsOpen(false)}>
  <div className="flex flex-col p-[16px] gap-[8px]">
    <button className="h-[48px] text-start px-[12px] rounded-[8px] hover:bg-boxHover" onClick={() => { setActionsOpen(false); /* edit handler */ }}>Edit</button>
    <button className="h-[48px] text-start px-[12px] rounded-[8px] hover:bg-boxHover" onClick={() => { setActionsOpen(false); /* duplicate handler */ }}>Duplicate</button>
    <button className="h-[48px] text-start px-[12px] rounded-[8px] hover:bg-boxHover" onClick={() => { setActionsOpen(false); /* stats handler */ }}>Statistics</button>
    <button className="h-[48px] text-start px-[12px] rounded-[8px] text-red-500 hover:bg-boxHover" onClick={() => { setActionsOpen(false); /* delete handler */ }}>Delete</button>
  </div>
</BottomSheet>
```

(El subagente debe identificar los handlers reales ya usados en los botones hover y reusarlos. No inventar handlers nuevos.)

- [ ] **Step 3: Deshabilitar useDrag en mobile**

Buscar el `useDrag` en `CalendarItem`. Envolver su resultado con `canDrag: !isMobile` en las options:

```ts
const [, drag, dragPreview] = useDrag(() => ({
  type: 'post',
  item: { id: post.id },
  canDrag: () => !isMobile,
}), [isMobile]);
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/launches/calendar.tsx
git commit -m "feat(calendar): add bottom sheet actions for CalendarItem on mobile"
```

### Task 2.5: Modales inline de calendar.tsx (SetSelectionModal + drag confirm)

**Files:**
- Modify: `apps/frontend/src/components/launches/calendar.tsx`

- [ ] **Step 1: SetSelectionModal responsive**

Buscar el componente `SetSelectionModal` (definido al final del archivo). En su root, reemplazar cualquier `max-w-[Xpx]` fijo por `w-screen h-screen max-w-none md:w-full md:h-auto md:max-w-[600px]`. Botones que están en `flex-row`, pasar a `flex-col md:flex-row gap-[8px]`.

- [ ] **Step 2: "What do you want to do?" confirm inline**

Buscar el componente/función que renderiza el diálogo de confirmación al soltar un post publicado (dentro de `calendar.tsx`). Aplicar el mismo patrón: root `w-screen h-screen max-w-none md:w-full md:h-auto md:max-w-[500px]`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/launches/calendar.tsx
git commit -m "feat(calendar): make SetSelectionModal and drag-confirm responsive"
```

---

## Bloque 3 — Editor de post (AddEditModal)

### Task 3.1: AddEditModal fullscreen en mobile

**Files:**
- Modify: `apps/frontend/src/components/new-launch/add.edit.modal.tsx`

- [ ] **Step 1: Ancho responsive**

Buscar donde se abre el modal via Mantine `modals.openModal({ size: '80%' })` o se pasa `max-w-[1400px]`. En el JSX root del modal content, envolver con clase:

```tsx
<div className="w-screen h-[100dvh] md:w-full md:h-auto md:max-w-[1400px]">
```

Si el modal usa Mantine `ModalsProvider`, ajustar la prop `size` a `'100%'` en mobile via `useIsMobile` (pasar `size={isMobile ? '100%' : '80%'}` o `fullScreen={isMobile}` si está disponible).

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/new-launch/add.edit.modal.tsx
git commit -m "feat(editor): make AddEditModal fullscreen on mobile"
```

### Task 3.2: manage.modal con tabs Edit/Preview/Settings

**Files:**
- Modify: `apps/frontend/src/components/new-launch/manage.modal.tsx`

- [ ] **Step 1: Identificar bloques**

El subagente debe leer el archivo e identificar:
- Bloque del editor (izquierda)
- Bloque del preview (derecha, probablemente `show.all.providers` o similar)
- Bloque de settings (si existe separado)

- [ ] **Step 2: Añadir estado de tab activa en mobile**

Cerca del inicio del componente:
```ts
const isMobile = useIsMobile();
const [mobileTab, setMobileTab] = useState<'edit' | 'preview' | 'settings'>('edit');
```

Import:
```ts
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';
```

- [ ] **Step 3: Barra de tabs sticky**

Antes del layout principal, añadir:

```tsx
{isMobile && (
  <div className="sticky top-0 z-20 flex bg-newBgColorInner border-b border-newTableBorder">
    {(['edit', 'preview', 'settings'] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => setMobileTab(tab)}
        className={clsx(
          'flex-1 h-[44px] text-[14px] font-[500] capitalize',
          mobileTab === tab ? 'text-textItemFocused border-b-2 border-primary' : 'text-textColor'
        )}
      >
        {t(tab, tab)}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 4: Mostrar bloques condicionalmente**

Envolver el bloque del editor con `className={clsx('flex-1', isMobile && mobileTab !== 'edit' && 'hidden')}`.
Preview: `className={clsx('flex-1', isMobile && mobileTab !== 'preview' && 'hidden', !isMobile && 'md:w-[400px]')}`.
Settings: `className={clsx(isMobile && mobileTab !== 'settings' && 'hidden')}`.

El layout lado-a-lado de desktop se mantiene porque en `≥md` ambos se muestran con sus anchos originales.

- [ ] **Step 5: Save button sticky bottom en mobile**

Buscar el botón "Save" / "Schedule". Envolver en:
```tsx
<div className="md:static md:p-0 fixed bottom-0 inset-x-0 p-[12px] bg-newBgColorInner border-t border-newTableBorder md:border-0 z-10">
  {/* botón actual */}
</div>
```

- [ ] **Step 6: Validar**

En 375px: tap en tabs cambia vista, botón Save siempre visible abajo. En 1280px layout sin cambios.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/new-launch/manage.modal.tsx
git commit -m "feat(editor): add Edit/Preview/Settings tabs on mobile"
```

### Task 3.3: Toolbar editor con scroll horizontal

**Files:**
- Modify: `apps/frontend/src/components/new-launch/editor.tsx`

- [ ] **Step 1: Toolbar scrollable**

Buscar el contenedor del toolbar (bold/u/heading/bullets/a/mention/delay/finisher). Reemplazar su `flex` por `flex overflow-x-auto scrollbar-none gap-[4px]` y asegurar que cada botón hijo tenga `flex-shrink-0`.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/new-launch/editor.tsx
git commit -m "feat(editor): horizontal-scroll toolbar on mobile"
```

### Task 3.4: CopilotPopup como bottom sheet

**Files:**
- Modify: `apps/frontend/src/components/new-launch/manage.modal.tsx` (donde se renderiza `CopilotPopup`)

- [ ] **Step 1: Wrapper condicional**

Buscar `<CopilotPopup` y envolverlo para que en `<md` su contenedor ocupe `fixed inset-x-0 bottom-0 max-h-[70vh]`. Como CopilotPopup es externo, aplicar estilos vía CSS override en `global.scss`:

Añadir a `apps/frontend/src/app/global.scss`:

```scss
@media (max-width: 767px) {
  .copilotKitPopup,
  [data-copilot-popup] {
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 70vh !important;
    right: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    border-radius: 16px 16px 0 0 !important;
  }
}
```

(El subagente debe verificar la clase/atributo real inspeccionando en el browser o leyendo el paquete `@copilotkit/react-ui`.)

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/global.scss
git commit -m "feat(editor): anchor CopilotPopup as bottom sheet on mobile"
```

---

## Bloque 4 — Popovers y componentes compartidos

### Task 4.1: Patrón popover → bottom sheet (helper)

**Files:**
- Create: `apps/frontend/src/components/launches/helpers/responsive.popover.tsx`

- [ ] **Step 1: Wrapper que decide popover vs bottom sheet**

```tsx
'use client';

import { FC, ReactNode } from 'react';
import { BottomSheet } from '@gitroom/frontend/components/ui/bottom.sheet';
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  desktopClassName?: string;
}

export const ResponsivePopover: FC<Props> = ({ open, onClose, children, desktopClassName }) => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose}>
        <div className="p-[16px]">{children}</div>
      </BottomSheet>
    );
  }
  if (!open) return null;
  return (
    <div className={desktopClassName || 'absolute bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[8px] shadow-lg z-10'}>
      {children}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/launches/helpers/responsive.popover.tsx
git commit -m "feat(calendar): add ResponsivePopover helper"
```

### Task 4.2: Aplicar ResponsivePopover a los 6 popovers

**Files:**
- Modify: `apps/frontend/src/components/launches/helpers/date.picker.tsx`
- Modify: `apps/frontend/src/components/launches/repeat.component.tsx`
- Modify: `apps/frontend/src/components/launches/tags.component.tsx`
- Modify: `apps/frontend/src/components/launches/select.customer.tsx`
- Modify: `apps/frontend/src/components/launches/information.component.tsx`
- Modify: `apps/frontend/src/components/launches/menu/menu.tsx`

- [ ] **Step 1: Por cada archivo, reemplazar el popover absolute por ResponsivePopover**

Cada uno tiene un patrón similar: un trigger (`<div onClick={() => setOpen(true)}>`) y un dropdown (`<div className="absolute ...">`). El subagente:

1. Identifica el dropdown fijo (busca `absolute` + `z-` + `w-[240px]` o similar).
2. Reemplaza el div absolute por `<ResponsivePopover open={open} onClose={() => setOpen(false)} desktopClassName="...actual classes...">{contenido}</ResponsivePopover>`.
3. Elimina manejo manual de `useClickOutside` si lo había — `BottomSheet` y el backdrop desktop manejan cierre.

- [ ] **Step 2: Ajuste específico information.component.tsx (char counter)**

Reorganizar el tooltip que tiene `grid-cols-[auto_auto_auto]` a `grid-cols-1 md:grid-cols-[auto_auto_auto] gap-[8px]`.

- [ ] **Step 3: Validar cada popover en 375px**

Abrir el editor de post, probar tap en: fecha, repetir, tags, customer, info char counter, menú ⋯. Todos deben abrir como bottom sheet desde abajo.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/launches/helpers/date.picker.tsx apps/frontend/src/components/launches/repeat.component.tsx apps/frontend/src/components/launches/tags.component.tsx apps/frontend/src/components/launches/select.customer.tsx apps/frontend/src/components/launches/information.component.tsx apps/frontend/src/components/launches/menu/menu.tsx
git commit -m "feat(calendar): convert 6 popovers to bottom sheets on mobile"
```

### Task 4.3: GeneralPreview, InternalChannels, comments, up.down arrow

**Files:**
- Modify: `apps/frontend/src/components/launches/general.preview.component.tsx`
- Modify: `apps/frontend/src/components/launches/internal.channels.tsx`
- Modify: `apps/frontend/src/components/launches/comments/comment.component.tsx`
- Modify: `apps/frontend/src/components/launches/up.down.arrow.tsx`

- [ ] **Step 1: general.preview — grid imágenes**

Cambiar `grid-cols-2` (para >1 imagen) por `grid-cols-1 sm:grid-cols-2`.

- [ ] **Step 2: internal.channels — stack vertical**

Root que tiene `max-w-[600px]` → `max-w-[600px] w-full`. Inputs/selects que estaban lado-a-lado envolver en `flex flex-col md:flex-row gap-[8px]`.

- [ ] **Step 3: comments — reducir padding**

Buscar `p-[20px]` en comments → `p-[12px] md:p-[20px]`. Botones de acción en `flex-col md:flex-row`.

- [ ] **Step 4: up.down.arrow — targets táctiles**

Botones arrow con `w-[24px] h-[24px]` → `w-[40px] h-[40px] md:w-[24px] md:h-[24px]`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/launches/general.preview.component.tsx apps/frontend/src/components/launches/internal.channels.tsx apps/frontend/src/components/launches/comments/comment.component.tsx apps/frontend/src/components/launches/up.down.arrow.tsx
git commit -m "feat(calendar): responsive preview, channels, comments, arrows"
```

---

## Bloque 5 — Modales secundarios

### Task 5.1: Patrón fullscreen-mobile para modales grandes

**Files (todos):**
- `apps/frontend/src/components/launches/statistics.tsx`
- `apps/frontend/src/components/launches/missing-release.modal.tsx`
- `apps/frontend/src/components/launches/settings.modal.tsx`
- `apps/frontend/src/components/launches/customer.modal.tsx`
- `apps/frontend/src/components/launches/time.table.tsx`
- `apps/frontend/src/components/launches/bot.picture.tsx`
- `apps/frontend/src/components/launches/import-debug-post.modal.tsx`
- `apps/frontend/src/components/launches/generator/generator.tsx`
- `apps/frontend/src/components/media/media.component.tsx`
- `apps/frontend/src/components/launches/polonto.tsx`
- `apps/frontend/src/components/launches/polonto/polonto.picture.generation.tsx`
- `apps/frontend/src/components/launches/ai.image.tsx`
- `apps/frontend/src/components/launches/ai.video.tsx`
- `apps/frontend/src/components/new-launch/dummy.code.component.tsx`

- [ ] **Step 1: Por cada archivo — ancho responsive**

Buscar el root del modal content (donde está `max-w-[Xpx]` o `w-[Xpx]`). Reemplazar por el patrón:

```tsx
className="w-screen h-[100dvh] max-w-none md:w-full md:h-auto md:max-w-[<original>]"
```

Si el modal se abre con `modals.openModal({ size: '80%' })` de Mantine, cambiar a:

```ts
const isMobile = useIsMobile();
modals.openModal({
  size: isMobile ? '100%' : '80%',
  styles: { content: { height: isMobile ? '100dvh' : undefined, maxHeight: isMobile ? '100dvh' : undefined } },
  // ...rest
});
```

- [ ] **Step 2: Ajustes específicos por modal**

- **statistics.tsx**: tabla `grid grid-cols-3` → `grid grid-cols-1 md:grid-cols-3`. Títulos `text-[18px]` → `text-[16px] md:text-[18px]`.
- **time.table.tsx**: selectores hora/minuto en `flex-row` → `flex-col md:flex-row`.
- **media.component.tsx**: grid galería `grid-cols-3 sm:grid-cols-4 lg:grid-cols-5` ya OK, pero dentro del modal maximize preview aplicar `w-screen h-[100dvh] max-w-none md:...`.
- **media.component.tsx MediaSettings**: layout de alt-text/crop en `flex-col md:flex-row`.
- **generator/GeneratorPopup**: textarea altura `min-h-[200px]` → `min-h-[120px] md:min-h-[200px]`. Botones grandes `h-[48px]` ya bien.
- **polotno.tsx**: canvas de polotno tiene tamaños fijos — aceptar que en `<md` quedará con scroll horizontal. Solo envolver el modal en fullscreen.
- **ai.image.tsx / ai.video.tsx**: grids de resultados `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.

- [ ] **Step 3: Commits atómicos (uno por archivo)**

Para cada archivo:
```bash
git add <archivo>
git commit -m "feat(calendar): responsive <nombre-modal> on mobile"
```

### Task 5.2: DeleteDialog / areYouSure centralizado

**Files:**
- Modify: `apps/frontend/src/components/layout/new-modal.tsx`

- [ ] **Step 1: Responsive en el wrapper central**

Buscar el root del componente/función que renderiza el diálogo. Aplicar `w-screen h-auto max-h-[100dvh] max-w-none md:w-full md:max-w-[500px]`. Botones "Cancel"/"Confirm" en `flex-col md:flex-row gap-[8px]`.

- [ ] **Step 2: Validar consumidores**

Como este modal es reusado por delete post, merge, separate, delete tag, delete timeslot, delete comment, upgrade billing, shortlink, subreddit NSFW — abrir cada flujo y confirmar que el diálogo se ve bien en 375px.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/new-modal.tsx
git commit -m "feat(layout): responsive deleteDialog wrapper for all consumers"
```

---

## Bloque 6 — Add Channel flow

### Task 6.1: AddProviderComponent + sub-modales inline

**Files:**
- Modify: `apps/frontend/src/components/launches/add.provider.component.tsx`

- [ ] **Step 1: Modal root + grid de plataformas**

Buscar el root del modal. Aplicar patrón fullscreen-mobile. Grid de plataformas (buscar `grid-cols-` dentro del archivo) → `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`.

- [ ] **Step 2: CustomVariables, UrlModal, ChromeExtensionWarning, ExtensionNotFound**

Cada uno es un componente inline en el mismo archivo. Aplicar en el root de cada uno: `w-screen h-[100dvh] max-w-none md:w-full md:h-auto md:max-w-[600px]`.

Inputs con `w-[400px]` → `w-full md:w-[400px]`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/launches/add.provider.component.tsx
git commit -m "feat(channels): responsive AddProvider flow and inline sub-modals"
```

### Task 6.2: Menu (3-dots canal)

**Files:**
- Modify: `apps/frontend/src/components/launches/menu/menu.tsx`

Ya cubierto parcialmente en Task 4.2. Confirmar que el popup del menú usa `ResponsivePopover`. Si no, aplicar.

- [ ] **Step 1: Verificar y commit si cambia**

```bash
git add apps/frontend/src/components/launches/menu/menu.tsx
git commit -m "feat(channels): ensure menu uses ResponsivePopover" --allow-empty
```

### Task 6.3: Web3 providers y continue.integration

**Files:**
- Modify: `apps/frontend/src/components/launches/web3/web3.list.tsx`
- Modify: `apps/frontend/src/components/launches/web3/providers/wrapcaster.provider.tsx`
- Modify: `apps/frontend/src/components/launches/web3/providers/telegram.provider.tsx`
- Modify: `apps/frontend/src/components/launches/web3/providers/moltbook.provider.tsx`
- Modify: `apps/frontend/src/components/launches/continue.integration.tsx`
- Modify: `apps/frontend/src/components/launches/helpers/pick.platform.component.tsx`
- Modify: `apps/frontend/src/components/launches/helpers/linkedin.component.tsx`

- [ ] **Step 1: Por archivo — layouts en `flex-col md:flex-row` y anchos `w-full md:w-[Xpx]`**

Subagente lee cada archivo, identifica flex rows y widths fijos, y los hace responsive siguiendo el patrón establecido.

- [ ] **Step 2: Commit grupal**

```bash
git add apps/frontend/src/components/launches/web3 apps/frontend/src/components/launches/continue.integration.tsx apps/frontend/src/components/launches/helpers/pick.platform.component.tsx apps/frontend/src/components/launches/helpers/linkedin.component.tsx
git commit -m "feat(channels): responsive web3, continue-integration, pick-platform, linkedin"
```

---

## Bloque 7 — Tooltips y QA final

### Task 7.1: Tooltips hover → click en mobile

**Files:**
- Modify: `apps/frontend/src/components/layout/top.tip.tsx` (donde vive `<ReactTooltip id="tooltip">` global)

- [ ] **Step 1: Configurar events dinámicamente**

```tsx
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';
// ...
const isMobile = useIsMobile();
return <ReactTooltip id="tooltip" events={isMobile ? ['click'] : ['hover']} />;
```

(Validar la prop exacta en la versión de `react-tooltip` instalada — puede ser `openOnClick` o similar. El subagente debe leer `package.json` y `node_modules/react-tooltip`.)

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/layout/top.tip.tsx
git commit -m "feat(layout): tooltip uses click on mobile instead of hover"
```

### Task 7.2: QA cruzado en viewports

- [ ] **Step 1: Ejecutar lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 2: Build**

Run: `pnpm -C apps/frontend build`
Expected: build exitoso.

- [ ] **Step 3: Manual QA checklist**

Abrir `pnpm dev` y validar en Chrome DevTools para cada viewport (375, 390, 430, 768, 1024, 1440):

- [ ] Sidebar: drawer abre/cierra en <768, fijo en ≥768.
- [ ] Filters: stack vertical en <768, horizontal en ≥768. Botón Week oculto en <768.
- [ ] DayView: columna horas 64px en <768, 136px en ≥768.
- [ ] WeekView: colapsa a DayView en <768.
- [ ] MonthView: dot indicators en <768, posts expandidos en ≥768. Tap en día abre DayView.
- [ ] CalendarItem: botón ⋯ visible en <768 con bottom sheet de acciones.
- [ ] Editor: fullscreen en <768 con tabs Edit/Preview/Settings. Save sticky bottom.
- [ ] Toolbar editor: scroll horizontal en <768.
- [ ] CopilotPopup: anclado abajo en <768.
- [ ] Popovers: fecha, repeat, tags, customer, info, menu ⋯ → bottom sheet en <768.
- [ ] Modales secundarios (stats, missing-release, settings, customer, time.table, bot, import, generator, media, polotno, ai.image, ai.video, dummy.code): fullscreen en <768.
- [ ] deleteDialog: responsive en todos sus disparadores (delete post, merge, separate, delete tag, delete comment, etc.).
- [ ] AddProvider + sub-modales: fullscreen en <768.
- [ ] Tooltips: click en <768, hover en ≥768.
- [ ] Drag&drop: bloqueado en <768 (verificar que tap no arrastra).
- [ ] Desktop ≥1024: zero regresión visual/comportamiento.

- [ ] **Step 4: Si hay fallos, iterar con fixes en commits separados**

Cada fix: `fix(calendar): <descripción>` con archivo específico.

### Task 7.3: PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/responsive-calendar
```

- [ ] **Step 2: Crear PR**

```bash
gh pr create --title "feat(calendar): full responsive migration for /launches section" --body "$(cat <<'EOF'
## Summary
- Migra toda la sección Calendario (/launches) a diseño responsive mobile-first.
- Sidebar → drawer off-canvas en <768px.
- WeekView colapsa a DayView; MonthView usa dot indicators.
- Editor de post: tabs Edit/Preview/Settings fullscreen en mobile.
- Popovers (date, tags, repeat, customer, info, menu) → bottom sheets.
- 14 modales secundarios: fullscreen en mobile.
- deleteDialog responsive en sus 10+ consumidores.
- Tooltips hover → click en mobile.
- Drag&drop deshabilitado en mobile.

## Spec & Plan
- Spec: `docs/superpowers/specs/2026-04-14-responsive-calendar.md`
- Plan: `docs/superpowers/plans/2026-04-14-responsive-calendar.md`

## Test plan
- [x] Viewports 375/390/430/768/1024/1440
- [x] pnpm lint
- [x] pnpm -C apps/frontend build
- [x] QA manual flujos críticos (crear post, editar, drag en desktop, popovers, modales)
- [x] Zero regresión desktop
EOF
)"
```

- [ ] **Step 3: Reportar URL de PR al usuario**

---

## Self-Review Notes

- **Spec coverage:** Todas las decisiones del spec (shell, vistas, editor, popovers, modales, add-channel, delete dialog, tooltips, drag&drop) tienen tasks asignadas.
- **Placeholders:** Algunos pasos dicen "el subagente lee el archivo e identifica X" — es intencional porque los archivos son grandes (500-2000 líneas) y los selectores exactos varían. El subagente tiene instrucciones concretas de qué buscar y qué patrón aplicar.
- **Type consistency:** `useIsMobile` y `BottomSheet` firmas consistentes en todos los call-sites.
- **Commits:** 1 commit por task (o archivo en tasks grupales). Total estimado ~25-30 commits.
- **Orden:** Bloques 0 (foundations) → 1 (shell) → 2 (vistas) → 3 (editor) → 4 (popovers) → 5 (modales secundarios) → 6 (add channel) → 7 (QA + PR). Cada bloque es independiente excepto 0 que es prerequisito.
