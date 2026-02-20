# UI/UX Audit - The Counting House

## Date: 2026-02-20
## Auditor: Claude Code (Automated)
## Scope: Full frontend codebase audit after sidebar + dark mode migration

---

## Executive Summary

The Counting House has a well-crafted Victorian theme with a comprehensive CSS variable-based design system that properly supports both light and dark modes at the foundational level. The recent sidebar migration is well-implemented with mobile responsiveness and collapse states. However, there are **significant dark mode gaps in components** that use hardcoded Tailwind colors (blue, amber, gray, purple, green, red) instead of the Victorian theme palette, **9 tabs on the event detail page that don't scroll horizontally on mobile**, **18+ instances of `alert()` for error feedback** instead of in-page toast/banner patterns, and widespread use of `text-wood-dark` (255 occurrences across 58 files) which was designed as a dark color for light mode backgrounds but is technically theme-aware via CSS variables. The Button component uses ~15 hardcoded hex colors in gradient stops that won't adapt to dark mode.

---

## Critical Issues

### 1. Event Detail Tab Bar Overflows on Mobile
- **Severity:** Critical
- **Component:** `/src/app/events/[id]/page.tsx` (lines 542-678)
- **Description:** The event detail page has 9 tabs (Budget & Details, Documents, Team, Checklist, Reminders, Notes, Shipments, Post-Event, ROI Tracking) rendered in a horizontal `flex gap-1` container with no overflow handling. On mobile/tablet screens, these tabs will overflow the viewport and become unreachable.
- **Impact:** Users on screens narrower than ~900px cannot access several tabs. This is a functional blocker for mobile users trying to reach the Shipments, Post-Event, or ROI tabs.
- **Recommendation:** Add `overflow-x-auto` to the tab container and consider a scrollable tab bar with fade indicators, or collapse into a dropdown/select on mobile:
  ```tsx
  <div className="flex gap-1 mb-6 border-b border-wood-medium/20 overflow-x-auto scrollbar-none">
  ```

### 2. Budget Overview Card 3-Column Grid Breaks on Mobile
- **Severity:** High
- **Component:** `/src/components/dashboard/BudgetOverviewCard.tsx` (line 94)
- **Description:** The main stats grid uses `grid grid-cols-3 gap-6` with border-right separators on the first two columns. On small screens, this creates cramped, unreadable budget numbers and the `pr-6` with `border-r` dividers look broken when text wraps.
- **Impact:** The most important numbers on the dashboard (Total Budget, Spent, Remaining) become unreadable on phones. The `text-3xl font-serif font-bold` currency values with 2-decimal formatting (`$1,234,567.89`) overflow their columns.
- **Recommendation:** Change to `grid grid-cols-1 sm:grid-cols-3` and conditionally render the `border-r` dividers only on `sm:` breakpoint:
  ```tsx
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
    <div className="text-center sm:border-r border-wood-medium/20 sm:pr-6">
  ```

---

## Dark Mode Issues

### 3. Hardcoded Tailwind Colors on Source Type Badges
- **Severity:** High
- **Components:**
  - `/src/app/events/[id]/page.tsx` (lines 1149-1153)
  - `/src/app/categories/[id]/page.tsx` (lines 460-464)
- **Description:** Expense source type badges use `bg-blue-100 text-blue-700`, `bg-purple-100 text-purple-700`, and `bg-gray-100 text-gray-700`. These are standard Tailwind colors that have no dark mode counterparts defined. In dark mode, `bg-blue-100` renders as a bright white-blue background on a dark card, creating jarring contrast.
- **Impact:** Visually broken badges in dark mode on event detail and category detail expense lists.
- **Recommendation:** Replace with Victorian palette equivalents that already have dark mode mappings:
  ```tsx
  // brex: "bg-ink-green/15 text-ink-green border-ink-green/30"
  // pdf: "bg-ink-gold/15 text-ink-gold border-ink-gold/30"
  // manual: "bg-sepia/15 text-sepia border-sepia/30"
  ```
  Note: The `ExpenseCard.tsx` component already uses this correct pattern via `sourceBadgeColors` (line 38-42). The inline badges in the page files should be migrated to match.

### 4. Admin Page Uses Non-Theme Colors
- **Severity:** Medium
- **Component:** `/src/app/admin/page.tsx` (lines 56-71)
- **Description:** The admin page level configs use `bg-amber-500/10`, `text-amber-600`, `bg-blue-500/10`, `text-blue-600` for warning and info badges. These won't adapt to dark mode properly.
- **Impact:** Admin page warning/info badges look out of place in dark mode. The amber/blue colors clash with the warm Victorian dark palette.
- **Recommendation:** Map to theme colors: warnings to `ink-gold` variants, info to `wood-medium/sepia` variants.

### 5. Shipment Status Badges Use Non-Theme Colors
- **Severity:** Medium
- **Component:** `/src/components/events/EventShipmentsTab.tsx` (lines 41-47)
- **Description:** Status config uses `bg-yellow-500/15 text-yellow-400`, `bg-blue-500/15 text-blue-400`, `bg-green-500/15 text-green-400`, `bg-gray-500/15 text-gray-400`, `bg-red-500/15 text-red-400`. These bypass the Victorian theme entirely.
- **Impact:** Shipment status badges look inconsistent with the rest of the app in both light and dark modes. The `text-yellow-400` and `text-green-400` may have contrast issues.
- **Recommendation:** Map to Victorian equivalents:
  - pending: `bg-ink-gold/15 text-ink-gold border-ink-gold/30`
  - in_transit: `bg-sepia/15 text-sepia border-sepia/30`
  - delivered: `bg-ink-green/15 text-ink-green border-ink-green/30`
  - returned: `bg-wood-medium/15 text-wood-dark border-wood-medium/30`
  - issue: `bg-ink-red/15 text-ink-red border-ink-red/30`

### 6. Notes Tab Competitor Alert Uses Non-Theme Amber
- **Severity:** Medium
- **Component:** `/src/components/events/EventNotesTab.tsx` (line 35, 218)
- **Description:** Competitor alert notes use `bg-amber-500/15 text-amber-400 border-amber-500/30`. The note card itself also gets `border-amber-500/30 bg-amber-500/5`.
- **Impact:** Competitor alerts look inconsistent with theme in both modes.
- **Recommendation:** Use `bg-ink-gold/15 text-ink-gold border-ink-gold/30` which is the Victorian equivalent of amber.

### 7. Pipeline EventBar Fallback Uses `bg-gray-400`
- **Severity:** Low
- **Component:** `/src/components/pipeline/EventBar.tsx` (line 29)
- **Description:** Events without a tier fall back to `bg-gray-400`, which is a flat gray that doesn't fit the Victorian palette.
- **Impact:** Un-tiered events on the calendar look generic and out of theme.
- **Recommendation:** Use `bg-wood-medium` as the fallback color.

### 8. Button Component Has 15+ Hardcoded Hex Gradient Stops
- **Severity:** Medium
- **Component:** `/src/components/ui/Button.tsx` (lines 26-82)
- **Description:** Button variants use hardcoded hex values like `to-[#2d1a0e]`, `hover:from-[#4a2a1a]`, `active:from-[#1f1108]`, `to-[#6b1d00]`, `to-[#123620]`, `to-[#8a6508]`, etc. for gradient endpoints. These are calculated as darker/lighter variants of the theme colors but are static hex values that don't change in dark mode.
- **Impact:** In dark mode, buttons with dark gradients (primary, destructive, success) render as very dark rectangles on dark backgrounds, reducing visual distinction. The primary button (`from-wood-dark to-[#2d1a0e]`) becomes nearly invisible on a `#1a1612` background.
- **Recommendation:** Add `dark:` variant overrides for each button variant, or use CSS variables for the gradient stops. At minimum, the primary button needs `dark:from-[#c4b898] dark:to-[#a08050] dark:text-[#1a1612]` or similar lighter treatment.

### 9. Login Page Missing Dark Mode Backgrounds
- **Severity:** Medium
- **Component:** `/src/app/login/page.tsx` (lines 50-52, 83)
- **Description:** The login page uses `bg-gradient-to-br from-parchment via-parchment to-parchment-dark` for its background and `bg-gradient-to-b from-wood-dark to-[#2d1a0e]` for the card header. Since these reference CSS variables, the parchment gradient should work. However, the card header gradient endpoint `[#2d1a0e]` is hardcoded and the `bg-parchment/50` footer won't render well on dark backgrounds.
- **Impact:** Login card header could look odd in dark mode. Minor visual issue since login is typically a quick pass-through page.
- **Recommendation:** Verify visual rendering; add `dark:from-[...] dark:to-[...]` overrides to the card header if needed.

---

## Accessibility Issues

### 10. No Focus Management on Tab Navigation
- **Severity:** High
- **Component:** `/src/app/events/[id]/page.tsx` (lines 542-678)
- **Description:** The 9 tab buttons on the event detail page have no `role="tablist"`, `role="tab"`, or `aria-selected` attributes. The tab panels lack `role="tabpanel"` and `aria-labelledby`. There's no keyboard arrow key navigation between tabs.
- **Impact:** Screen reader users cannot determine they're interacting with a tabbed interface. Keyboard-only users must Tab through all 9 buttons instead of using arrow keys.
- **Recommendation:** Add proper ARIA tab pattern:
  ```tsx
  <div role="tablist" className="flex gap-1 mb-6 ...">
    <button role="tab" aria-selected={activeTab === "details"} aria-controls="panel-details" ...>
  ```

### 11. Widespread Use of `alert()` for Error Feedback
- **Severity:** High
- **Components:** 18+ instances across 10+ files (see list below)
- **Description:** Error handling uses native `alert()` dialogs in at least 18 locations:
  - `/src/app/events/page.tsx` (line 85)
  - `/src/app/events/[id]/page.tsx` (lines 168, 194, 216)
  - `/src/app/expenses/page.tsx` (lines 130, 184, 216, 252, 259)
  - `/src/app/categories/page.tsx` (line 86)
  - `/src/app/categories/[id]/page.tsx` (lines 117, 139)
  - `/src/components/settings/EventTypesSection.tsx` (lines 96, 124, 154)
  - `/src/components/documents/DocumentList.tsx` (line 65)
  - `/src/components/events/EventRemindersTab.tsx` (lines 96, 115)
- **Impact:** `alert()` blocks the main thread, cannot be styled, breaks the Victorian aesthetic, provides a jarring user experience, and is not accessible (screen readers may not announce them properly in all browsers).
- **Recommendation:** Create a `Toast` or `Notification` component that renders within the page. Many of these could be inline error banners similar to the pattern already used on the Settings page (lines 306-318).

### 12. Widespread Use of `confirm()` for Destructive Actions
- **Severity:** Medium
- **Components:** 11 instances across 9 files
- **Description:** Native `confirm()` dialogs are used for delete confirmations:
  - `/src/app/expenses/page.tsx` (lines 193, 231)
  - `/src/app/team/page.tsx` (line 67)
  - `/src/app/admin/page.tsx` (line 123)
  - `/src/app/settings/cadence/page.tsx` (lines 204, 286)
  - `/src/components/settings/EventTypesSection.tsx` (line 135)
  - `/src/components/events/EventTeamTab.tsx` (line 43)
  - `/src/components/events/EventShipmentsTab.tsx` (line 201)
  - `/src/components/events/EventNotesTab.tsx` (line 118)
  - `/src/components/events/EventPostEventTab.tsx` (line 160)
- **Impact:** Inconsistent UX -- the event detail page has a nice inline delete confirmation Card (lines 492-539), but most other delete actions use browser-native `confirm()`.
- **Recommendation:** Extract the inline confirmation pattern from event detail into a reusable `ConfirmDialog` component and use it everywhere.

### 13. Missing aria-labels on Many Interactive Elements
- **Severity:** Medium
- **Components:** Various
- **Description:** While some buttons have `aria-label` attributes (AppShell nav buttons, PDFUpload, some icon buttons), many buttons across the app lack them, particularly:
  - Tab buttons on event detail page (9 buttons, none with aria-label)
  - Theme toggle button in sidebar (no aria-label explaining current state)
  - Collapse/expand sidebar button (has `title` but no `aria-label`)
  - Refresh buttons on multiple pages (have visible text but icon-only on small screens)
  - All filter dropdowns (have associated labels, which is good)
- **Impact:** Screen reader users may hear generic "button" announcements instead of meaningful descriptions.
- **Recommendation:** Add `aria-label` to all icon-only and tab buttons. The sidebar theme toggle should announce the current and next theme state.

### 14. Color-Only Status Indicators
- **Severity:** Medium
- **Components:** Progress bars, budget status text throughout
- **Description:** Budget status relies solely on color coding:
  - Green = under 80% (on track)
  - Gold = 80-100% (nearing limit)
  - Red = over budget
  No icons, patterns, or text-based alternatives accompany these color states in the `ProgressBar` component itself, though parent components sometimes add text labels.
- **Impact:** Users with color vision deficiencies may not distinguish between on-track and at-risk budgets from the progress bar alone.
- **Recommendation:** The `BudgetProgress` component already adds text status ("On Track", "Nearing Budget", "Over Budget") which is good. Ensure the standalone `ProgressBar` (used in EventCard, EventTypeSummary, QuarterSummary) always appears alongside textual context.

---

## Consistency Issues

### 15. Inconsistent Delete Confirmation Patterns
- **Severity:** Medium
- **Components:** Multiple pages
- **Description:** Three different patterns exist for delete confirmations:
  1. **Inline Card** (event detail page, category detail page): Beautiful themed Card with warning icon, message, and action buttons. Best UX.
  2. **Native `confirm()`** (expenses, team, admin, notes, shipments, cadence): No styling, jarring, breaks theme.
  3. **No confirmation at all**: Some bulk operations may lack proper confirmation.
- **Impact:** Inconsistent user experience across features.
- **Recommendation:** Standardize on the inline Card pattern or create a modal-based confirmation component.

### 16. Inconsistent Page Header Patterns
- **Severity:** Low
- **Components:** All page components
- **Description:** Most pages follow a consistent header pattern (icon + serif title + subtitle + action buttons), but there are minor variations:
  - Dashboard page (`/src/app/page.tsx`): Title "The Ledger" with no icon in the heading
  - Team page (`/src/app/team/page.tsx`): Title without icon, subtitle shows member count
  - ROI page (`/src/app/roi/page.tsx`): Title without icon
  - All other pages: Have the icon + title pattern
- **Impact:** Minor visual inconsistency; the pages without header icons look slightly different from the majority.
- **Recommendation:** Add consistent header icons (e.g., `LayoutDashboard` for dashboard, `TrendingUp` for ROI).

### 17. Quarter Summary Grid Within Nested Grid Creates Layout Issues
- **Severity:** Low
- **Component:** `/src/components/dashboard/QuarterSummary.tsx` (line 254)
- **Description:** The Quarter Summary card contains a grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. When this card is already inside the dashboard's `xl:grid-cols-2` parent grid, the inner `xl:grid-cols-4` tries to show 4 columns within roughly half the viewport width, creating cramped quarter cards.
- **Impact:** Quarter cards become very narrow at `xl` breakpoint, making the text hard to read.
- **Recommendation:** Change inner grid to `grid-cols-1 sm:grid-cols-2` since the parent container is already half-width at `xl`.

---

## Responsiveness Issues

### 18. Delete Confirmation Bar Layout Breaks on Mobile
- **Severity:** Medium
- **Components:**
  - `/src/app/events/[id]/page.tsx` (lines 498-539)
  - `/src/app/categories/[id]/page.tsx` (lines 316-358)
- **Description:** The delete confirmation uses `flex items-center justify-between` which places the warning message and action buttons side-by-side. On narrow screens, this wraps awkwardly with the buttons potentially overlapping or being pushed below.
- **Impact:** Delete confirmation may be hard to interact with on mobile.
- **Recommendation:** Change to `flex flex-col sm:flex-row` pattern.

### 19. ROI Tables Lack Mobile-Friendly Alternative
- **Severity:** Medium
- **Component:** `/src/app/roi/page.tsx` (lines 291-398, 416-538)
- **Description:** Two data tables (ROI by Event Type and Event Performance) use `overflow-x-auto` which is correct for horizontal scrolling, but the tables have 7 columns each with no responsive alternative. On mobile, users must scroll horizontally through the entire table.
- **Impact:** Poor mobile experience for reviewing ROI data. Users may not realize they can scroll horizontally.
- **Recommendation:** Consider a card-based layout for mobile breakpoints, or at minimum add a visual indicator that horizontal scrolling is available.

### 20. Sidebar Transition Creates Content Jump
- **Severity:** Low
- **Component:** `/src/components/layout/AppShell.tsx` (lines 108-110, 416-421)
- **Description:** The sidebar collapse state is read from localStorage on mount (line 76), but until `mounted` is `true`, the sidebar renders as expanded (line 109: `const isCollapsed = mounted ? collapsed : false`). This prevents layout shift from SSR, but causes a brief flash where content appears in its expanded-sidebar position and then jumps when the sidebar collapses.
- **Impact:** Users who prefer collapsed sidebar may see a brief layout shift on every page load.
- **Recommendation:** This is a reasonable trade-off. Could be further improved with a CSS-only approach using a `[data-sidebar-collapsed]` attribute on the html element set by the inline script, similar to the dark mode approach.

---

## Interaction Design Issues

### 21. No Toast/Snackbar System for Success Feedback
- **Severity:** Medium
- **Components:** Most mutation operations across the app
- **Description:** After successful operations (creating events, expenses, categories), the UI provides no explicit success feedback. The form closes and the item appears in the list, but there's no "Event created successfully" confirmation. The Settings page is the exception -- it shows a green success banner (line 321-333).
- **Impact:** Users may be uncertain whether their action succeeded, especially for actions that don't visibly change the current view.
- **Recommendation:** Implement a toast notification system. The Settings page pattern could be extracted into a reusable `useToast` hook + `ToastContainer` component.

### 22. No Loading States on Individual Tab Content
- **Severity:** Low
- **Component:** `/src/app/events/[id]/page.tsx`
- **Description:** When switching between tabs on the event detail page (e.g., from Details to Shipments), each tab component fetches its own data on mount. There's no skeleton/loading state visible during the tab switch itself -- the tab content area goes blank until data arrives.
- **Impact:** Feels sluggish when switching tabs, especially on slower connections.
- **Recommendation:** Individual tab components should show skeleton loaders immediately (many already do, like `EventShipmentsTab`, `EventNotesTab`). Verify all tab components have immediate loading feedback.

### 23. Mobile Menu Overlay Lacks Scroll Lock
- **Severity:** Low
- **Component:** `/src/components/layout/AppShell.tsx` (lines 306-413)
- **Description:** When the mobile menu overlay opens, the body behind it can still scroll. There's no `overflow-hidden` applied to the body element.
- **Impact:** Users may accidentally scroll the page behind the mobile menu overlay, creating a disorienting experience.
- **Recommendation:** Add `useEffect` that toggles `document.body.style.overflow = 'hidden'` when `mobileMenuOpen` is true.

---

## Typography & Readability Issues

### 24. Hardcoded "FY 2026" Across Multiple Components
- **Severity:** Low
- **Components:**
  - `/src/components/dashboard/BudgetOverviewCard.tsx` (line 76): "FY 2026 Overview"
  - `/src/components/dashboard/QuarterSummary.tsx` (line 216): "FY 2026 spending timeline"
  - Multiple page headers: "FY 2026 Events", "FY 2026 Expenses", etc.
  - `/src/app/categories/[id]/page.tsx` (line 574): Hardcoded "2026"
  - `/src/app/events/[id]/page.tsx` (line 1359): Hardcoded "2026"
- **Impact:** When the fiscal year changes, all these strings need manual updating. The fiscal year is configurable in Settings, but the UI doesn't reflect it dynamically.
- **Recommendation:** Derive the fiscal year label from the settings/context rather than hardcoding it.

### 25. Currency Formatting Inconsistency Between Components
- **Severity:** Low
- **Components:** `QuarterSummary.tsx` vs all other components
- **Description:** QuarterSummary uses `minimumFractionDigits: 0, maximumFractionDigits: 0` (line 74), displaying amounts like "$1,234". All other components use `minimumFractionDigits: 2, maximumFractionDigits: 2`, displaying "$1,234.00".
- **Impact:** Inconsistent number formatting between the quarter summary and everything else.
- **Recommendation:** Standardize on 2 decimal places, or create a shared `formatCurrency` utility. Note that the `formatCurrency` function is duplicated in at least 10+ components -- this should be extracted into a shared utility.

---

## Enhancement Opportunities

### 26. Extract Shared `formatCurrency` Utility
- **Severity:** Low (Code Quality)
- **Components:** 10+ files with duplicated `formatCurrency` function
- **Description:** The same currency formatting function is defined locally in BudgetOverviewCard, EventTypeSummary, QuarterSummary, EventCard, ExpenseCard, event detail page, category detail page, expenses page, ROI page, and more.
- **Recommendation:** Create `src/lib/format.ts`:
  ```ts
  export function formatCurrency(amount: number, decimals = 2): string {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  ```

### 27. Create Reusable Tab Component
- **Severity:** Low (Code Quality)
- **Component:** `/src/app/events/[id]/page.tsx` (lines 542-678)
- **Description:** The tab UI pattern on the event detail page is implemented inline with ~130 lines of repeated JSX for 9 tab buttons. Each tab button has identical styling logic.
- **Recommendation:** Extract into a reusable `<Tabs>`, `<TabList>`, `<Tab>`, `<TabPanel>` component set with proper ARIA attributes built in.

### 28. Add Keyboard Navigation to Sidebar
- **Severity:** Low (Enhancement)
- **Component:** `/src/components/layout/AppShell.tsx`
- **Description:** The sidebar navigation items are `<Link>` elements which are keyboard focusable, but there's no visual skip-nav link to bypass the sidebar and jump to main content.
- **Recommendation:** Add a skip link at the top of the page: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>` and `id="main-content"` on the `<main>` element.

### 29. Empty States Could Be More Actionable
- **Severity:** Low (Enhancement)
- **Components:** Multiple list pages
- **Description:** Empty states on list pages (events, categories, expenses) show a simple text message like "No expenses recorded yet." with a description. However, these empty states don't include a clear CTA button.
- **Impact:** Users encountering an empty list may not notice the "Add" button in the header.
- **Recommendation:** Add a primary action button within the empty state card, e.g., "+ Add your first event" styled as a prominent button.

### 30. Pipeline Calendar Lacks Empty State
- **Severity:** Low (Enhancement)
- **Component:** `/src/components/pipeline/PipelineClient.tsx`
- **Description:** When no events exist for the selected month, the calendar grid shows without any helpful messaging.
- **Recommendation:** Add an empty state overlay or message when no events are in the current month view.

---

## Component Quality Notes

### Positive Findings

1. **Design System Foundation**: The CSS variable system in `globals.css` is excellent. Light and dark mode variables are comprehensive with proper semantic mappings. The `.dark` class properly remaps all variables.

2. **Button Component**: Well-structured with `cva` (class-variance-authority), proper loading states, icon support, and `forwardRef` pattern. The `IconButton` convenience wrapper enforces `aria-label`.

3. **Card Component**: Clean, composable compound component pattern (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard). Proper use of `forwardRef`.

4. **ProgressBar Component**: Comprehensive with multiple variants (ProgressBar, BudgetProgress, MiniProgress), color thresholds, labels, and over-budget indicators.

5. **Sidebar Implementation**: Proper collapse/expand with localStorage persistence, mobile drawer pattern, tooltip on collapsed state, and smooth transitions.

6. **Theme Provider**: Properly handles system preference, localStorage persistence, OS preference change listener, and hydration mismatch prevention via inline script in `<head>`.

7. **Loading Skeletons**: Most pages have skeleton loading states with `animate-pulse` patterns that match the page structure.

8. **Victorian Decorative Elements**: Corner flourishes, ledger lines, ink shadows, and paper textures are well-implemented and add character without sacrificing usability.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total issues found** | **30** |
| Critical | 2 |
| High | 4 |
| Medium | 13 |
| Low | 11 |
| **Dark mode issues** | **7** |
| **Accessibility issues** | **5** |
| **Responsiveness issues** | **3** |
| **Consistency issues** | **3** |
| **Interaction design issues** | **3** |
| **Typography/readability** | **2** |
| **Enhancement opportunities** | **5** |

### Files With Most Issues

| File | Issue Count | Severity |
|------|-------------|----------|
| `/src/app/events/[id]/page.tsx` | 5 | Critical, High, Medium |
| `/src/components/ui/Button.tsx` | 1 | Medium (dark mode) |
| `/src/components/events/EventShipmentsTab.tsx` | 1 | Medium (dark mode) |
| `/src/components/dashboard/BudgetOverviewCard.tsx` | 1 | High (responsive) |
| `/src/app/admin/page.tsx` | 1 | Medium (dark mode) |
| Various (18+ files) | 1 each | High (alert() usage) |

### Priority Recommendation Order

1. **Fix tab bar overflow** on event detail page (Critical - functional blocker)
2. **Fix budget overview card responsive grid** (High - dashboard usability)
3. **Replace hardcoded Tailwind colors** with theme colors in 5 components (High - dark mode)
4. **Add ARIA tab attributes** to event detail tabs (High - accessibility)
5. **Replace `alert()` calls** with in-page toast/notification system (High - UX)
6. **Add dark mode variants** to Button component gradients (Medium - dark mode)
7. **Replace `confirm()` calls** with themed confirmation component (Medium - consistency)
8. **Add skip-nav link** and improve keyboard navigation (Medium - accessibility)
9. **Extract shared formatCurrency utility** (Low - code quality)
10. **Extract reusable Tab component** (Low - code quality)
