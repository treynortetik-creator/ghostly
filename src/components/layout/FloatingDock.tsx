"use client";

/**
 * Ghostly - Floating Action Dock
 *
 * Two round buttons stacked vertically in the bottom-right:
 *   - Bell (notifications) on top
 *   - Chat on bottom
 *
 * Auto-hides after 5 seconds of inactivity. Pops up automatically
 * when new notifications or chat messages arrive, with a pulse
 * animation and badge counts on both icons.
 */

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Bell, MessageCircle, ChevronUp } from "lucide-react";
import NotificationPanel from "@/components/notifications/NotificationPanel";

const ChatPanel = lazy(() => import("@/components/agent/ChatPanel"));

const HIDE_DELAY = 5000; // 5 seconds
const PROXIMITY_BOTTOM = 120; // px from bottom edge
const PROXIMITY_RIGHT = 80; // px from right edge
const POLL_INTERVAL = 30000; // 30s polling for chat unread
const CHAT_UI_STATE_KEY = "ghostly-chat-ui-state-v1";
const CHAT_SEEN_STATE_KEY = "ghostly-chat-seen-v1";

interface ChatSessionSummary {
  id: string;
  updated_at: string | null;
  last_message_role: string | null;
  message_count: number;
}

type SeenMap = Record<string, string>;

function readSeenMap(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHAT_SEEN_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as SeenMap;
  } catch {
    return {};
  }
}

function writeSeenMap(map: SeenMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_SEEN_STATE_KEY, JSON.stringify(map));
}

function getUnreadSessionCount(sessions: ChatSessionSummary[], seenMap: SeenMap): number {
  return sessions.filter((session) => {
    if (session.last_message_role !== "assistant" || session.message_count <= 0) {
      return false;
    }
    const updatedAt = session.updated_at ? new Date(session.updated_at).getTime() : 0;
    const seenAt = seenMap[session.id] ? new Date(seenMap[session.id]).getTime() : 0;
    return Number.isFinite(updatedAt) && updatedAt > seenAt;
  }).length;
}

interface FloatingDockProps {
  eventId?: string | null;
}

export default function FloatingDock({ eventId }: FloatingDockProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [uiStateHydrated, setUiStateHydrated] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  // Pulse animation when new items arrive
  const [notificationPulse, setNotificationPulse] = useState(false);
  const [chatPulse, setChatPulse] = useState(false);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const prevUnreadNotifications = useRef(0);
  const prevUnreadChats = useRef(0);
  const mountedRef = useRef(false);

  const panelOpen = chatOpen || notificationsOpen;

  // Restore chat open/minimized state across navigation.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_UI_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { chat_open?: boolean; chat_minimized?: boolean };
        if (typeof parsed.chat_open === "boolean") setChatOpen(parsed.chat_open);
        if (typeof parsed.chat_minimized === "boolean") setChatMinimized(parsed.chat_minimized);
      }
    } catch {
      // Ignore malformed local state
    } finally {
      setUiStateHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!uiStateHydrated) return;
    localStorage.setItem(
      CHAT_UI_STATE_KEY,
      JSON.stringify({
        chat_open: chatOpen,
        chat_minimized: chatMinimized,
      })
    );
  }, [chatOpen, chatMinimized, uiStateHydrated]);

  /* ---------- Auto-hide logic ---------- */

  const showDock = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setDockVisible(true);
  }, []);

  const resetHideTimer = useCallback(() => {
    showDock();
    if (!panelOpen) {
      hideTimerRef.current = setTimeout(() => {
        setDockVisible(false);
      }, HIDE_DELAY);
    }
  }, [panelOpen, showDock]);

  useEffect(() => {
    resetHideTimer();
    mountedRef.current = true;
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  useEffect(() => {
    if (panelOpen) {
      showDock();
    } else {
      resetHideTimer();
    }
  }, [panelOpen, resetHideTimer, showDock]);

  /* ---------- Mouse proximity ---------- */

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nearBottom = window.innerHeight - e.clientY < PROXIMITY_BOTTOM;
      const nearRight = window.innerWidth - e.clientX < PROXIMITY_RIGHT;
      if (nearBottom && nearRight) {
        resetHideTimer();
      }
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [resetHideTimer]);

  /* ---------- Poll for unread chat messages ---------- */

  const markAllChatsSeen = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/sessions");
      if (!res.ok) return;
      const data = await res.json();
      const sessions = (data.sessions || []) as ChatSessionSummary[];
      const seenMap = readSeenMap();
      for (const session of sessions) {
        if (session.updated_at) {
          seenMap[session.id] = session.updated_at;
        }
      }
      writeSeenMap(seenMap);
    } catch {
      // Silently fail
    } finally {
      setUnreadChats(0);
    }
  }, []);

  useEffect(() => {
    if (chatOpen) return;

    const pollChats = async () => {
      try {
        const res = await fetch("/api/agent/sessions");
        if (!res.ok) return;
        const data = await res.json();
        const sessions = (data.sessions || []) as ChatSessionSummary[];
        const seenMap = readSeenMap();
        const count = getUnreadSessionCount(sessions, seenMap);
        setUnreadChats(count);
      } catch {
        // Silently fail
      }
    };

    pollChats();
    const interval = setInterval(pollChats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [chatOpen]);

  // Mark all chats seen when panel opens
  useEffect(() => {
    if (!chatOpen) return;
    setChatMinimized(false);
    markAllChatsSeen();
  }, [chatOpen, markAllChatsSeen]);

  /* ---------- Auto-show + pulse on new items ---------- */

  useEffect(() => {
    // Skip the initial mount — only trigger on actual increases
    if (!mountedRef.current) return;
    if (unreadNotifications > prevUnreadNotifications.current) {
      showDock();
      setNotificationPulse(true);
      resetHideTimer();
      const t = setTimeout(() => setNotificationPulse(false), 2000);
      return () => clearTimeout(t);
    }
    prevUnreadNotifications.current = unreadNotifications;
  }, [unreadNotifications, showDock, resetHideTimer]);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (unreadChats > prevUnreadChats.current) {
      showDock();
      setChatPulse(true);
      resetHideTimer();
      const t = setTimeout(() => setChatPulse(false), 2000);
      return () => clearTimeout(t);
    }
    prevUnreadChats.current = unreadChats;
  }, [unreadChats, showDock, resetHideTimer]);

  /* ---------- Button handlers ---------- */

  const handleBellClick = () => {
    setNotificationsOpen((prev) => !prev);
    if (chatOpen) setChatOpen(false);
  };

  const handleChatClick = () => {
    setChatOpen((prev) => {
      const next = !prev;
      if (next) setChatMinimized(false);
      return next;
    });
    if (notificationsOpen) setNotificationsOpen(false);
  };

  return (
    <>
      {/* Floating dock */}
      <div
        ref={dockRef}
        className={`
          fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3
          transition-all duration-500 ease-in-out
          ${dockVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0 pointer-events-none"
          }
        `}
      >
        {/* Bell button */}
        <button
          onClick={handleBellClick}
          className={`
            relative w-14 h-14 rounded-full shadow-lg
            flex items-center justify-center
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:ring-offset-2 focus:ring-offset-background
            ${notificationsOpen
              ? "bg-spectral text-white scale-95"
              : "bg-spectral text-white hover:bg-spectral/90 hover:scale-105"
            }
          `}
          aria-label="Toggle notifications"
        >
          <Bell className={`w-6 h-6 ${notificationPulse ? "animate-bounce" : ""}`} />
          {unreadNotifications > 0 && !notificationsOpen && (
            <span
              className={`
                absolute -top-1 -right-1 min-w-[20px] h-5
                flex items-center justify-center rounded-full
                bg-red-500 text-white text-xs font-bold px-1.5 shadow-md
                ${notificationPulse ? "animate-pulse ring-2 ring-red-400/50" : ""}
              `}
            >
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </button>

        {/* Chat button */}
        <button
          onClick={handleChatClick}
          className={`
            relative w-14 h-14 rounded-full shadow-lg
            flex items-center justify-center
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:ring-offset-2 focus:ring-offset-background
            ${chatOpen
              ? "bg-spectral text-white scale-95"
              : "bg-spectral text-white hover:bg-spectral/90 hover:scale-105"
            }
          `}
          aria-label="Toggle AI chat"
        >
          <MessageCircle className={`w-6 h-6 ${chatPulse ? "animate-bounce" : ""}`} />
          {unreadChats > 0 && !chatOpen && (
            <span
              className={`
                absolute -top-1 -right-1 min-w-[20px] h-5
                flex items-center justify-center rounded-full
                bg-red-500 text-white text-xs font-bold px-1.5 shadow-md
                ${chatPulse ? "animate-pulse ring-2 ring-red-400/50" : ""}
              `}
            >
              {unreadChats > 99 ? "99+" : unreadChats}
            </span>
          )}
        </button>
      </div>

      {/* Minimized chat card */}
      {chatMinimized && !chatOpen && (
        <button
          onClick={() => {
            setChatOpen(true);
            setChatMinimized(false);
          }}
          className="
            fixed bottom-24 right-6 z-40 w-[220px]
            rounded-xl border border-border bg-card/95 backdrop-blur-sm
            px-3 py-2 text-left shadow-xl
            hover:border-spectral/40 transition-colors
          "
          aria-label="Reopen chat"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="w-4 h-4 text-spectral shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                Chat minimized
              </span>
            </div>
            {unreadChats > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Click to resume your conversation
          </p>
        </button>
      )}

      {/* Translucent indicator — visible when dock is hidden */}
      <div
        className={`
          fixed bottom-3 right-6 z-30 flex flex-col items-center
          transition-all duration-500 ease-in-out cursor-pointer
          ${dockVisible
            ? "opacity-0 pointer-events-none"
            : "opacity-100"
          }
        `}
        onClick={() => resetHideTimer()}
        onMouseEnter={() => resetHideTimer()}
      >
        <ChevronUp className="w-5 h-5 text-spectral/30 animate-bounce" />
        <div className="w-8 h-1 rounded-full bg-spectral/15 mt-0.5" />
      </div>

      {/* Notification panel */}
      <NotificationPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadCountChange={setUnreadNotifications}
      />

      {/* Chat panel */}
      <Suspense fallback={null}>
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setChatMinimized(false);
          }}
          onMinimize={() => {
            setChatOpen(false);
            setChatMinimized(true);
          }}
          eventId={eventId}
        />
      </Suspense>
    </>
  );
}
