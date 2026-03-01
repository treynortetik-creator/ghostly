# Sidebar Navigation Redesign

**Date:** 2026-03-01
**Status:** Approved

## Problem

The sidebar has 15 flat navigation items with equal visual weight. It feels overwhelming and overcrowded. Items like "Agent" (`/settings/agent`) and "Audit Log" (`/admin/audit`) are child routes pretending to be top-level.

## Solution

Group items into labeled sections with nested children. Everything stays visible — no collapsing or hiding. Section labels provide visual hierarchy.

## Grouping

**[Primary — no label]**
- Dashboard
- Events
- Pipeline

**Manage**
- Expenses
- Categories
- Contacts
- Team
- Documents
- ROI

**System**
- Integrations
- Webhooks
- Settings → Agent (nested child)
- Admin → Audit Log (nested child)

## Visual Treatment

- **Section labels:** `text-[10px]`, muted, uppercase, tracking-widest — barely there, just enough to separate groups
- **Collapsed sidebar:** Section labels replaced by thin spectral dividers between groups
- **Nested children (expanded):** Indented (`pl-11`), smaller text (`text-[13px]`), smaller icon (`w-3.5`), reduced opacity
- **Nested children (collapsed):** Render as normal icon items (same as parents)
- **Item padding:** Reduced from `py-2.5` to `py-2` to compensate for added section headers

## Files

- Modify: `src/components/layout/AppShell.tsx` — data structure + desktop + mobile rendering
