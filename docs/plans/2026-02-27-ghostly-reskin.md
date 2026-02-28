# Ghostly Reskin & Rebrand Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the app from Victorian "Counting House" aesthetic to an ethereal, elegant "Ghostly" dark theme with glass-morphism, spectral purple accents, and frosted glass UI.

**Architecture:** Complete CSS theme rewrite (globals.css), update all UI components (Button, Card, ProgressBar) to use new design tokens, rebrand all 80+ "Counting House"/"Scrooge" text references, and update functional code (auth cookies, JWT, export filenames, API headers).

**Tech Stack:** Next.js 16, Tailwind CSS 4, Geist font family, CSS custom properties, glass-morphism via backdrop-filter

---

## Design System Reference

### Color Palette (Dark Mode Default)

```
Background Base:     #0A0612  (near-black, deep purple undertone)
Background Elevated: #130D1E  (slightly lifted surfaces)
Surface/Glass:       rgba(255,255,255,0.05) + backdrop-blur-xl
Surface Hover:       rgba(255,255,255,0.08)
Border:              rgba(255,255,255,0.08)
Border Accent:       rgba(139,92,246,0.3)

Text Primary:        #F0ECF9  (warm white, slight lavender)
Text Secondary:      #9B8FB8  (muted lavender-gray)
Text Muted:          #6B5F82  (tertiary/disabled)

Purple Primary:      #8B5CF6
Purple Light:        #A78BFA
Purple Soft:         #C4B5FD
Purple Subtle BG:    rgba(139,92,246,0.1)

Teal Secondary:      #06B6D4  (from logo gradient)
Teal Light:          #67E8F9

Success:             #34D399  (emerald)
Danger:              #F87171  (soft red)
Warning:             #FBBF24  (amber)
Info:                #60A5FA  (blue)
```

### Light Mode Palette

```
Background:          #F8F7FC  (very pale lavender-white)
Background Elevated: #EFEDF5
Surface:             rgba(255,255,255,0.8)
Border:              rgba(139,92,246,0.15)

Text Primary:        #1A1025  (deep purple-black)
Text Secondary:      #6B5F82
Text Muted:          #9B8FB8

Purple Primary:      #7C3AED
Accent:              #8B5CF6
```

### Glass-morphism

```css
/* Standard glass card */
background: rgba(255,255,255,0.05);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 12px;

/* Glow on focus/active */
box-shadow: 0 0 20px rgba(139,92,246,0.15);
```

### Typography
- Sans: Geist Sans (already loaded)
- Mono: Geist Mono (already loaded)
- Remove: Playfair Display (no longer needed)
- Headings: Geist Sans, semibold, no serif

---

## Task 1: Rewrite globals.css with Ghostly Theme

**Files:**
- Modify: `src/app/globals.css` (full rewrite)

Replace the entire Victorian theme system with the Ghostly ethereal theme. This includes:
- New CSS custom properties for both dark (default) and light modes
- Replace all Victorian color tokens (wood-*, parchment-*, ink-*, sepia) with Ghostly tokens (ghost-*, phantom-*, spectral-*)
- New glass-morphism utility classes replacing paper-texture, flourish, corner-flourish, ledger-lines
- New shadow system (spectral glow instead of ink/parchment shadows)
- Updated scrollbar styling
- Updated form element styling
- Updated selection styling
- New animations (fade-in with slight scale, ghost-float for subtle ambient motion)
- Keep the shadcn semantic mappings (--background, --foreground, --card, etc.) but with new values

**Key mappings (old → new Tailwind classes):**
- `bg-parchment` → `bg-background` (use semantic tokens)
- `bg-parchment-dark` → `bg-card`
- `text-ink-black` → `text-foreground`
- `text-sepia` → `text-muted-foreground`
- `text-ink-green` → `text-emerald-400` or semantic `text-positive`
- `text-ink-red` → `text-red-400` or semantic `text-negative`
- `text-ink-gold` → `text-purple-400` or semantic `text-accent`
- `bg-wood-dark` → `bg-primary` (sidebar/headers)
- `border-wood-medium` → `border-border`
- `ring-ink-gold` → `ring-ring` (purple)

---

## Task 2: Update layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

Changes:
- Remove Playfair Display font import and variable
- Remove `playfairDisplay.variable` from body className
- Replace `paper-texture` class with new background class
- Update metadata description to "Ghostly - AI-powered event management platform"
- Add favicon reference for new logo
- Update the dark mode detection script (default to dark instead of checking system preference)

---

## Task 3: Update AppShell with Ghostly Theme

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

Changes:
- Replace BookOpen icon with Image component showing ghostly-logo.jpg (or Ghost icon from Lucide)
- Replace all Victorian Tailwind classes with Ghostly equivalents:
  - `bg-wood-dark` → sidebar background color
  - `text-parchment` → sidebar text color
  - `ink-shadow` → new spectral shadow
  - `bg-wood-medium` → active nav item bg
  - `text-ink-gold` → active nav accent (purple)
  - `border-wood-medium` → border colors
  - Victorian flourish/diamond divider → simple glow divider
- Update footer quote to something ghostly-themed
- Replace all `dark:bg-sidebar` patterns with new dark mode tokens

---

## Task 4: Update Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

Changes:
- Replace BookOpen icon with ghostly logo image
- Replace Victorian background gradients with dark ethereal gradients
- Replace wood-dark, parchment, ink-gold classes with Ghostly palette
- Update "Sign In to the Ledger" → "Sign In"
- Update Victorian quote in footer → ghostly-themed tagline
- Replace flourish divider with subtle glow divider
- Glass-morphism treatment on login card
- Dark background with subtle purple/teal gradient orbs

---

## Task 5: Update UI Components (Button, Card, ProgressBar)

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/ProgressBar.tsx`
- Modify: `src/components/ui/Toast.tsx` (if exists)
- Modify: `src/components/ui/ConfirmDialog.tsx` (if exists)

**Button changes:**
- Primary: Purple gradient (#7C3AED → #8B5CF6) with glow on hover
- Secondary: Glass-morphism (translucent bg, border)
- Ghost: Transparent with purple text on hover
- Destructive: Soft red with glass treatment
- Success: Emerald with glass treatment
- Gold variant → rename to "accent" with purple/teal gradient
- Remove all wood-*, parchment-*, ink-* color references
- Update focus ring to purple

**Card changes:**
- Replace parchment-dark bg with glass-morphism
- Replace wood-medium borders with glass borders
- Remove corner-flourish and ledger-lines options (replace with glow variant)
- Add glass-morphism backdrop-filter
- Update StatCard decorative corner to purple glow
- Update trend colors from ink-* to semantic colors

**ProgressBar changes:**
- Replace ink-green/ink-gold/ink-red with emerald/amber/red
- Replace wood-medium track with dark glass track
- Update glow effects on fill

---

## Task 6: Bulk Text Replacement - Comments & Headers

**Files:** ~50+ source files with "The Counting House" in comments

Run bulk replacement across all source files:
- `"The Counting House"` → `"Ghostly"` in all file header comments
- `"Victorian"` → remove or replace with `"Ethereal"` in comments
- `"counting house"` → `"Ghostly"` in comments
- Component index file comments updated

This is safe because these are all JSDoc/comment changes with no functional impact.

---

## Task 7: Functional Rebrand - Auth, Exports, APIs

**Files:**
- Modify: `src/lib/auth.ts` — cookie name `counting-house-token` → `ghostly-token`, JWT issuer/audience `counting-house` → `ghostly`
- Modify: `src/middleware.ts` — same cookie name and JWT changes
- Modify: `src/lib/openrouter.ts` — X-Title header and AI prompts
- Modify: `src/lib/webhook-sender.ts` — User-Agent header
- Modify: `src/app/api/export/csv/route.ts` — export filename and report title
- Modify: `src/app/api/export/excel/route.ts` — export filename and report title
- Modify: `src/app/export/page.tsx` — export filename in UI
- Modify: `src/app/api/webhooks/test/route.ts` — test message and User-Agent

**IMPORTANT:** The auth cookie rename will log out the current user. This is expected.

---

## Task 8: Scrooge References - Phase Out

**Files:**
- Modify: `src/types/database.ts` — `NotifyChannel` type: keep 'scrooge' for DB compatibility but add comment noting it's legacy
- Modify: `src/app/settings/cadence/page.tsx` — UI label `"Scrooge"` → `"AI Agent"`, keep value as `"scrooge"` for DB compatibility
- Modify: `src/app/api/reminders/check/route.ts` — update comment
- Modify: `src/app/api/reminders/upcoming/route.ts` — update comment
- Modify: `src/app/api/reminders/[rid]/sent/route.ts` — update comment
- Modify: `src/app/api/cadence-templates/[id]/milestones/route.ts` — update comment
- Modify: `src/app/api/cadence-templates/[id]/milestones/[mid]/route.ts` — update comment

**Strategy:** Change UI-facing labels from "Scrooge" to "AI Agent". Keep DB values as-is for backward compatibility (no migration needed). The MCP will replace Scrooge's functionality.

---

## Task 9: Update Remaining Component Files

**Files:** All component files under `src/components/` that use Victorian color classes

Systematically update every component that uses old color tokens:
- `text-wood-dark` → headings color
- `text-sepia` → muted text
- `text-ink-black` → primary text
- `bg-parchment-dark` → card bg
- `border-wood-medium` → border
- `text-ink-gold` → accent
- `text-ink-green` / `text-ink-red` → semantic positive/negative
- `font-serif` → `font-sans` for headings

This task requires reading each component and updating class names while preserving layout and functionality.

---

## Task 10: MCP Server Rebrand

**Files:**
- Modify: `mcp-server/src/index.ts` — update references
- Modify: `mcp-server/README.md` — full rebrand from Shindig/Counting House to Ghostly

---

## Task 11: Documentation Rebrand

**Files:**
- Modify: `PRD.md` — update title and theme references
- Modify: `CODEBASE_REPORT.md` — update title
- Modify: `SCROOGE_API_SPEC.md` → rename to `AGENT_API_SPEC.md` and update content
- Modify: `README.md` — verify branding is correct
- Modify: `supabase/seed.sql` — update comment header

---

## Task 12: Verify Build & Visual Check

Run `npm run build` to verify no TypeScript errors or broken imports from the rebrand. Check that all Tailwind classes resolve correctly.
