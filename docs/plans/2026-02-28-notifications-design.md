# Notifications System Design

## Overview

In-app notification system for Ghostly. Notifications surface agent messages, budget alerts, task reminders, and custom agent-created reminders via a floating bell icon and slide-out panel.

## Floating Action Dock

Two round buttons (`w-14 h-14`) stacked vertically, bottom-right corner:
- **Bell** (top) — opens notification panel, shows unread count badge
- **Chat** (bottom) — existing chat panel behavior

Auto-hide after 15 seconds of no mouse activity in the bottom-right area. A translucent chevron indicator remains visible so users know the dock is there. Mouse proximity (bottom 120px, right 80px) slides buttons back in. Buttons stay visible when either panel is open.

## Notification Panel

Slide-out panel from right (~400px wide), glass-morphism styling matching ChatPanel.

- Header: "Notifications" + "Mark all read" button
- Filter tabs: "All" / "Unread"
- Scrollable notification list (load 50, "Load more" button)
- Each notification: type icon, bold title (if unread), message preview (2-3 lines), relative timestamp, unread dot, expand on click, dismiss/delete buttons
- Empty state: ghost icon + "No notifications yet"
- Linked context: "View Event" link when notification references an event

## Notification Types

| Type | Icon | Source |
|------|------|--------|
| `agent_message` | Bot | Heartbeat results, scheduled task results, agent insights |
| `budget_alert` | DollarSign | Over-budget events, expense thresholds |
| `task_reminder` | Bell | Event reminders, checklist deadlines, milestones |
| `custom_reminder` | Clock | Agent-created one-off reminders |

## Database

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('agent_message','budget_alert','task_reminder','custom_reminder')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  metadata jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Main query: unread first, newest first, exclude dismissed
CREATE INDEX idx_notifications_org_read ON notifications(organization_id, is_read, created_at DESC);
-- Fast filter for non-dismissed
CREATE INDEX idx_notifications_not_dismissed ON notifications(organization_id, created_at DESC) WHERE dismissed_at IS NULL;
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/notifications` | GET | List (status=unread\|all, limit, offset). Returns `{ notifications, unread_count }` |
| `/api/notifications` | POST | Create notification `{ type, title, message, metadata? }` |
| `/api/notifications` | DELETE | Bulk delete `{ ids }` or `{ dismissed: true }` |
| `/api/notifications/read` | PATCH | Bulk mark read `{ ids }` or `{ all: true }` |
| `/api/notifications/[id]/dismiss` | PATCH | Soft-delete (set dismissed_at) |
| `/api/notifications/[id]` | DELETE | Hard-delete single notification |

All routes use `withApiHandler` + `getOrgId` pattern.

## Components

1. **FloatingDock** — Replaces inline chat button in AppShell. Auto-hide timer, mouse proximity, translucent indicator. Renders both panels.
2. **NotificationPanel** — Slide-out panel. Fetches/displays notifications, handles actions. Polls unread count every 60s when closed.
3. **NotificationItem** — Individual notification card with expand/collapse, type icons, relative timestamps, action buttons.

## Implementation Order

1. Database migration
2. API routes + database types
3. NotificationPanel component
4. FloatingDock component
5. AppShell integration
6. Build verification
