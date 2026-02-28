"use client";

/**
 * Ghostly - Notification Panel
 *
 * Slide-out panel for viewing and managing notifications.
 * Matches ChatPanel slide-in pattern with glass-morphism styling.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Bot,
  DollarSign,
  Clock,
  X,
  Check,
  CheckCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

/* ============================================
   Types
   ============================================ */

interface Notification {
  id: string;
  type: "agent_message" | "budget_alert" | "task_reminder" | "custom_reminder";
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  dismissed_at: string | null;
  created_at: string;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

/* ============================================
   Helpers
   ============================================ */

const TYPE_CONFIG: Record<
  Notification["type"],
  { icon: typeof Bot; label: string; color: string }
> = {
  agent_message: { icon: Bot, label: "Agent", color: "text-spectral" },
  budget_alert: { icon: DollarSign, label: "Budget", color: "text-amber-400" },
  task_reminder: { icon: Bell, label: "Reminder", color: "text-blue-400" },
  custom_reminder: { icon: Clock, label: "Reminder", color: "text-emerald-400" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ============================================
   Notification Item
   ============================================ */

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;
  const eventId = notification.metadata?.event_id as string | undefined;

  const handleClick = () => {
    setExpanded(!expanded);
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
  };

  return (
    <div
      className={`
        group relative rounded-lg border transition-colors cursor-pointer
        ${notification.is_read
          ? "border-border/50 bg-background/30"
          : "border-spectral/20 bg-spectral/5"
        }
      `}
    >
      {/* Unread dot */}
      {!notification.is_read && (
        <div className="absolute top-3 left-2 w-2 h-2 rounded-full bg-spectral animate-pulse" />
      )}

      {/* Main content — clickable */}
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left p-3 pl-6"
      >
        <div className="flex items-start gap-3">
          <div className={`p-1.5 rounded-md bg-background/50 ${config.color} shrink-0 mt-0.5`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-sm truncate ${
                  notification.is_read
                    ? "text-foreground/80"
                    : "text-foreground font-medium"
                }`}
              >
                {notification.title}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {timeAgo(notification.created_at)}
              </span>
            </div>
            {!expanded && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            )}
          </div>
          <div className="shrink-0 text-muted-foreground/50">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-3 space-y-3">
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {notification.message}
          </p>

          {/* Context link */}
          {eventId && (
            <a
              href={`/events/${eventId}`}
              className="inline-flex items-center gap-1.5 text-xs text-spectral hover:text-spectral/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View Event
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            {!notification.is_read && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-spectral/10"
              >
                <Check className="w-3 h-3" />
                Mark read
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-spectral/10"
            >
              <X className="w-3 h-3" />
              Dismiss
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10 ml-auto"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================
   Main Panel
   ============================================ */

export default function NotificationPanel({
  isOpen,
  onClose,
  onUnreadCountChange,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?status=${filter}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      onUnreadCountChange?.(data.unread_count || 0);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setIsLoading(false);
    }
  }, [filter, onUnreadCountChange]);

  // Fetch on open or filter change
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Poll for unread count when panel is closed (every 60s)
  useEffect(() => {
    if (isOpen) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/notifications?status=unread&limit=1");
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
        onUnreadCountChange?.(data.unread_count || 0);
      } catch {
        // Silently fail
      }
    };
    poll();
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [isOpen, onUnreadCountChange]);

  /* ---------- Actions ---------- */

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // Revert on failure
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    onUnreadCountChange?.(0);
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      fetchNotifications();
    }
  };

  const handleDismiss = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    }
    try {
      await fetch(`/api/notifications/${id}/dismiss`, { method: "PATCH" });
    } catch {
      fetchNotifications();
    }
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    }
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    } catch {
      fetchNotifications();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-screen z-50
          w-full sm:w-[400px]
          bg-background/95 backdrop-blur-xl
          border-l border-border shadow-2xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-sm border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-spectral" />
            <h2 className="font-semibold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-xs bg-spectral/20 text-spectral px-1.5 py-0.5 rounded-full font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-spectral/10"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-spectral/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-2 bg-card/40 border-b border-border/50 shrink-0">
          {(["all", "unread"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`
                px-3 py-1 text-xs font-medium rounded-full transition-colors
                ${filter === tab
                  ? "bg-spectral/20 text-spectral"
                  : "text-muted-foreground hover:text-foreground hover:bg-spectral/10"
                }
              `}
            >
              {tab === "all" ? "All" : "Unread"}
            </button>
          ))}
          <button
            onClick={() => { setIsLoading(true); fetchNotifications(); }}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-spectral animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 rounded-full bg-spectral/10 mb-3">
                <Bell className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "Notifications from your agent, budget alerts, and reminders will appear here."
                }
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
