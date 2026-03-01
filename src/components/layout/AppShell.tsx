"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Workflow,
  FolderOpen,
  Receipt,
  TrendingUp,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Users,
  Contact2,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Webhook,
  ScrollText,
  Bot,
  FileText,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/components/providers";
import type { Theme } from "@/components/providers";
import { SearchCommand } from "@/components/search/SearchCommand";
import FloatingDock from "@/components/layout/FloatingDock";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Pipeline", href: "/pipeline", icon: Workflow },
  { name: "Categories", href: "/categories", icon: FolderOpen },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Team", href: "/team", icon: Users },
  { name: "Contacts", href: "/contacts", icon: Contact2 },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "ROI", href: "/roi", icon: TrendingUp },
  { name: "Webhooks", href: "/webhooks", icon: Webhook },
  { name: "Integrations", href: "/integrations", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Agent", href: "/settings/agent", icon: Bot },
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Audit Log", href: "/admin/audit", icon: ScrollText },
];

const SIDEBAR_KEY = "sidebar-collapsed";

const themeOrder: Theme[] = ["light", "dark", "system"];
const themeIcons: Record<Theme, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};
const themeLabels: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Extract event_id from URL if on an event detail page (e.g. /events/[uuid])
  const eventIdMatch = pathname.match(/^\/events\/([0-9a-f-]{36})/);
  const currentEventId = eventIdMatch ? eventIdMatch[1] : null;

  // Read collapse state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
    setMounted(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  const cycleTheme = useCallback(() => {
    const idx = themeOrder.indexOf(theme);
    const next = themeOrder[(idx + 1) % themeOrder.length];
    setTheme(next);
  }, [theme, setTheme]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const ThemeIcon = themeIcons[theme];

  // Prevent layout shift: render with expanded sidebar until mounted
  const isCollapsed = mounted ? collapsed : false;

  return (
    <div className="min-h-screen">
      {/* ===== Desktop Sidebar ===== */}
      <aside
        className={`
          hidden md:flex flex-col fixed top-0 left-0 h-screen z-40
          bg-sidebar spectral-shadow
          text-sidebar-foreground
          border-r border-sidebar-border
          transition-all duration-300 overflow-hidden
          ${isCollapsed ? "w-[68px]" : "w-64"}
        `}
      >
        {/* Top decorative border */}
        <div className="h-1 bg-gradient-to-r from-transparent via-spectral/30 to-transparent shrink-0" />

        {/* Logo section */}
        <div className="flex items-center gap-3 px-4 py-4 shrink-0">
          <Image src="/images/ghostly-logo.jpg" alt="Ghostly" width={28} height={28} className="rounded shrink-0" />
          <div
            className={`
              flex flex-col overflow-hidden transition-all duration-300
              ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
            `}
          >
            <h1 className="text-lg font-semibold tracking-wide text-sidebar-foreground whitespace-nowrap">
              Ghostly
            </h1>
            <span className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase -mt-0.5 whitespace-nowrap">
              ghostly.ai
            </span>
          </div>
        </div>

        {/* Decorative divider */}
        <div className="px-3 shrink-0">
          <div className="h-px bg-gradient-to-r from-transparent via-spectral/20 to-transparent" />
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const isExact = pathname === item.href;
            const isPrefix =
              item.href !== "/" && pathname.startsWith(item.href + "/");
            // Don't highlight a parent route if a more specific child nav item matches
            const hasMoreSpecificMatch =
              isPrefix &&
              navItems.some(
                (other) =>
                  other.href !== item.href &&
                  other.href.startsWith(item.href + "/") &&
                  (pathname === other.href ||
                    pathname.startsWith(other.href + "/"))
              );
            const isActive = isExact || (isPrefix && !hasMoreSpecificMatch);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`
                  group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-spectral/10 text-spectral border-l-2 border-spectral"
                      : "text-sidebar-foreground/60 hover:bg-spectral/5 hover:text-sidebar-foreground"
                  }
                `}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span
                  className={`
                    whitespace-nowrap transition-all duration-300 overflow-hidden
                    ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
                  `}
                >
                  {item.name}
                </span>

                {/* Tooltip on hover when collapsed */}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 rounded bg-ghost-light text-phantom text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-3 pb-3 space-y-1 shrink-0">
          <div className="h-px bg-gradient-to-r from-transparent via-spectral/15 to-transparent mb-2" />

          {/* Search (Cmd+K) */}
          <SearchCommand collapsed={isCollapsed} />

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            title={isCollapsed ? `Theme: ${themeLabels[theme]}` : undefined}
            className="group relative w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
              text-sidebar-foreground/50 hover:bg-spectral/5 hover:text-sidebar-foreground
              transition-all duration-200"
          >
            <ThemeIcon className="w-5 h-5 shrink-0" />
            <span
              className={`
                whitespace-nowrap transition-all duration-300 overflow-hidden
                ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
              `}
            >
              {themeLabels[theme]}
            </span>
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-ghost-light text-phantom text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                Theme: {themeLabels[theme]}
              </span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="group relative w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
              text-sidebar-foreground/50 hover:bg-spectral/5 hover:text-sidebar-foreground
              transition-all duration-200"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 shrink-0" />
            ) : (
              <ChevronLeft className="w-5 h-5 shrink-0" />
            )}
            <span
              className={`
                whitespace-nowrap transition-all duration-300 overflow-hidden
                ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
              `}
            >
              Collapse
            </span>
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-ghost-light text-phantom text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                Expand sidebar
              </span>
            )}
          </button>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className="group relative w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
              text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10
              transition-all duration-200"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span
              className={`
                whitespace-nowrap transition-all duration-300 overflow-hidden
                ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
              `}
            >
              Sign Out
            </span>
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 rounded bg-ghost-light text-phantom text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ===== Mobile Top Bar ===== */}
      <header className="md:hidden sticky top-0 z-40 bg-sidebar spectral-shadow text-sidebar-foreground">
        <div className="h-1 bg-gradient-to-r from-transparent via-spectral/30 to-transparent" />
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-md
              text-sidebar-foreground/60 hover:bg-spectral/5 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold tracking-wide text-sidebar-foreground">
            Ghostly
          </h1>
          {/* Spacer for centering */}
          <div className="w-10" />
        </div>
      </header>

      {/* ===== Mobile Sidebar Overlay ===== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar drawer */}
          <aside className="relative flex flex-col w-64 h-full bg-sidebar text-sidebar-foreground spectral-shadow animate-fade-in">
            {/* Top decorative border */}
            <div className="h-1 bg-gradient-to-r from-transparent via-spectral/30 to-transparent shrink-0" />

            {/* Logo + close */}
            <div className="flex items-center justify-between px-4 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <Image src="/images/ghostly-logo.jpg" alt="Ghostly" width={28} height={28} className="rounded" />
                <div className="flex flex-col">
                  <h1 className="text-lg font-semibold tracking-wide text-sidebar-foreground">
                    Ghostly
                  </h1>
                  <span className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase -mt-0.5">
                    ghostly.ai
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-spectral/5 transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Decorative divider */}
            <div className="px-3 shrink-0">
              <div className="h-px bg-gradient-to-r from-transparent via-spectral/20 to-transparent" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {navItems.map((item) => {
                const isExact = pathname === item.href;
                const isPrefix =
                  item.href !== "/" && pathname.startsWith(item.href + "/");
                const hasMoreSpecificMatch =
                  isPrefix &&
                  navItems.some(
                    (other) =>
                      other.href !== item.href &&
                      other.href.startsWith(item.href + "/") &&
                      (pathname === other.href ||
                        pathname.startsWith(other.href + "/"))
                  );
                const isActive = isExact || (isPrefix && !hasMoreSpecificMatch);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
                      transition-all duration-200
                      ${
                        isActive
                          ? "bg-spectral/10 text-spectral border-l-2 border-spectral"
                          : "text-sidebar-foreground/60 hover:bg-spectral/5 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom section */}
            <div className="mt-auto px-3 pb-3 space-y-1 shrink-0">
              <div className="h-px bg-gradient-to-r from-transparent via-spectral/15 to-transparent mb-2" />

              {/* Search (Cmd+K) */}
              <SearchCommand />

              {/* Theme toggle */}
              <button
                onClick={cycleTheme}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
                  text-sidebar-foreground/50 hover:bg-spectral/5 hover:text-sidebar-foreground
                  transition-all duration-200"
              >
                <ThemeIcon className="w-5 h-5" />
                <span>{themeLabels[theme]}</span>
              </button>

              {/* Sign Out */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
                  text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10
                  transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ===== Main Content Area ===== */}
      <div
        className={
          isCollapsed
            ? "transition-all duration-300 md:ml-[68px]"
            : "transition-all duration-300 md:ml-64"
        }
      >
        <main className="flex-1">
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-card border-t border-border">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground/60 italic">
                &ldquo;The invisible hand managing your events.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground/40">
                Ghostly &middot; FY {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* ===== Floating Dock (Notifications + Chat) ===== */}
      <FloatingDock eventId={currentEventId} />
    </div>
  );
}

export default AppShell;
