# UI Overhaul: Sidebar Nav, Truncation Fixes, Dark Mode

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert top nav to collapsible sidebar, fix truncated budget cards, add dark mode with system preference + toggle.

**Architecture:** Centralized in AppShell.tsx (used by all 14 pages). Theme state via React context + localStorage + `prefers-color-scheme` media query. CSS variables for dark mode colors in globals.css.

**Tech Stack:** Next.js 16, Tailwind CSS v4, React Context, localStorage, CSS custom properties

---

## Task 1: Create Theme Provider

**Files:**
- Create: `src/components/providers/ThemeProvider.tsx`
- Create: `src/components/providers/index.ts`
- Modify: `src/app/layout.tsx`

**What:** Create a ThemeProvider that manages `dark` class on `<html>`, syncs with localStorage and `prefers-color-scheme`.

**Step 1:** Create `src/components/providers/ThemeProvider.tsx`:
- Export `ThemeProvider` component and `useTheme` hook
- On mount: check localStorage for `theme` key, fallback to `prefers-color-scheme`
- Toggle function: cycles light/dark, saves to localStorage, adds/removes `dark` class on `<html>`
- Listen to `prefers-color-scheme` changes when in "system" mode
- Three modes: `light`, `dark`, `system`
- Expose: `{ theme, setTheme, resolvedTheme }` via context

**Step 2:** Create `src/components/providers/index.ts` barrel export.

**Step 3:** Modify `src/app/layout.tsx`:
- Wrap `{children}` in `<ThemeProvider>`
- Add `suppressHydrationWarning` to `<html>` tag (needed for class manipulation)
- Add inline script in `<head>` to prevent flash of wrong theme (FOUC prevention)

**Step 4:** Run `npm run build` to verify no errors.

---

## Task 2: Add Dark Mode Colors to CSS

**Files:**
- Modify: `src/app/globals.css`

**What:** Add `.dark` variant color overrides that maintain the Victorian aesthetic but in dark tones.

**Step 1:** Add `.dark` selector block after `:root` in globals.css with dark Victorian palette:
- Dark backgrounds: deep charcoal with warm brown undertone (#1a1612, #242018, #2e281f)
- Muted parchment text: warm cream (#d4c9b0, #c4b898)
- Dark wood tones: deeper mahogany shades
- Ink colors: slightly brighter for contrast on dark bg
- Override all semantic CSS variables (--background, --foreground, --card, etc.)
- Override sidebar variables for dark sidebar

**Step 2:** Update `.paper-texture` to support dark mode:
- Add `.dark .paper-texture` with darker gradient stops

**Step 3:** Update `.ink-shadow`, `.parchment-shadow`, `.inset-shadow` for dark mode.

**Step 4:** Update scrollbar colors for dark mode.

**Step 5:** Update form element styles for dark mode.

**Step 6:** Run `npm run build` to verify no errors.

---

## Task 3: Convert Header to Collapsible Sidebar

**Files:**
- Rewrite: `src/components/layout/AppShell.tsx`

**What:** Replace the top `<header>` navigation with a left sidebar. Collapsible (icon-only) or expanded (icon + label). Mobile: slide-in drawer. Persist collapse state in localStorage.

**Design:**
- Expanded width: ~256px (w-64)
- Collapsed width: ~68px (w-17)
- Logo at top (book icon + "The Counting House" when expanded, just icon when collapsed)
- Nav items: icon + label (expanded), tooltip on hover (collapsed)
- Theme toggle at bottom of sidebar
- Sign Out at bottom of sidebar
- Collapse/expand toggle button (chevron) at sidebar bottom or edge
- Mobile: hamburger icon in a slim top bar, sidebar slides in as overlay
- Main content area takes remaining width with smooth transition
- Footer stays below main content (inside the content area, not full-width)

**Step 1:** Rewrite `AppShell.tsx`:
- Add `collapsed` state, init from `localStorage.getItem('sidebar-collapsed')`
- Sidebar: fixed left, full height, `w-64` expanded / `w-[68px]` collapsed
- Content wrapper: `ml-64` expanded / `ml-[68px]` collapsed with transition
- Nav items: use existing `navItems` array with icons
- Active state: same color logic (bg-wood-medium text-ink-gold)
- Add collapse toggle button (ChevronLeft/ChevronRight)
- Add theme toggle button using `useTheme()` (Sun/Moon icons)
- Mobile: `<= md` breakpoint, sidebar hidden by default, overlay with backdrop
- Smooth width transitions via `transition-all duration-300`
- All dark mode compatible using Tailwind `dark:` variant classes

**Step 2:** Move footer inside content area (since sidebar is full-height).

**Step 3:** Run `npm run build` to verify.

**Step 4:** Test all 14 pages still render correctly.

---

## Task 4: Fix Truncated Budget Cards

**Files:**
- Modify: `src/components/dashboard/QuarterSummary.tsx`

**What:** The quarter cards truncate Spent/Budget/Remaining values when in the 4-col grid. Fix by using compact currency formatting and removing truncate class.

**Step 1:** In `QuarterSummary.tsx`:
- Change `formatCurrency` to use compact notation for the card stats: drop cents (`maximumFractionDigits: 0`) and use abbreviations for large numbers (e.g., `$135K` instead of `$135,775.00`)
- Remove `truncate` class from the currency value spans (lines 150, 164, 178)
- Remove `overflow-hidden` from the stats container div (line 139)
- Keep full precision in the card header totals

**Step 2:** Run `npm run build` to verify.

---

## Task 5: UI/UX Audit (Sub-agent)

**What:** Run a comprehensive UI/UX audit of the entire app and generate a report.

**Deliverable:** `docs/reports/2026-02-20-ui-ux-audit.md`

---

## Task 6: Refactoring Audit (Sub-agent)

**What:** Analyze codebase for refactoring opportunities, code duplication, optimization potential.

**Deliverable:** `docs/reports/2026-02-20-refactoring-audit.md`

---

## Execution Order

1. Task 1 (ThemeProvider) - no deps
2. Task 2 (Dark mode CSS) - no deps
3. Task 3 (Sidebar) - depends on Task 1
4. Task 4 (Truncation fix) - no deps
5. Tasks 5 & 6 (Audits) - independent, can run in parallel after UI changes

Tasks 1, 2, and 4 can be done in parallel.
Task 3 requires Task 1 to be complete.
Tasks 5 & 6 run after all UI work is done.
