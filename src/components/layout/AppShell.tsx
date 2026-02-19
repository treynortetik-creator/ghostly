"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Workflow,
  FolderOpen,
  Receipt,
  TrendingUp,
  Upload,
  Download,
  Settings,
  Shield,
  LogOut,
  BookOpen,
  Menu,
  X,
  Users,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Pipeline", href: "/pipeline", icon: Workflow },
  { name: "Categories", href: "/categories", icon: FolderOpen },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Team", href: "/team", icon: Users },
  { name: "ROI", href: "/roi", icon: TrendingUp },
  { name: "Import", href: "/import", icon: Upload },
  { name: "Export", href: "/export", icon: Download },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Admin", href: "/admin", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" data-oid="2p6g1y6">
      {/* Header / Navigation Bar */}
      <header
        className="bg-wood-dark text-parchment ink-shadow sticky top-0 z-50"
        data-oid="8ihwvsk"
      >
        {/* Top decorative border */}
        <div
          className="h-1 bg-gradient-to-r from-transparent via-ink-gold/40 to-transparent"
          data-oid="yzl_niq"
        />

        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          data-oid="7o6c4pc"
        >
          <div
            className="flex items-center justify-between h-16"
            data-oid="kk088cp"
          >
            {/* Logo / Title */}
            <div className="flex items-center gap-3" data-oid="eb6ocjb">
              <div
                className="flex items-center justify-center w-10 h-10 rounded bg-wood-medium/50 border border-wood-light/20"
                data-oid="1owlpwg"
              >
                <BookOpen
                  className="w-5 h-5 text-ink-gold"
                  data-oid="4e28dxs"
                />
              </div>
              <div className="flex flex-col" data-oid="werbpcx">
                <h1
                  className="font-serif text-xl font-semibold tracking-wide text-parchment"
                  data-oid="q.5y:uo"
                >
                  The Counting House
                </h1>
                <span
                  className="text-[10px] text-parchment/50 tracking-widest uppercase -mt-0.5"
                  data-oid="n:smh-1"
                >
                  Est. MMXXIV
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav
              className="hidden md:flex items-center gap-1"
              data-oid="p:e7mlt"
            >
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md
                      transition-all duration-200
                      ${
                        isActive
                          ? "bg-wood-medium text-ink-gold"
                          : "text-parchment/80 hover:bg-wood-medium/50 hover:text-parchment"
                      }
                    `}
                    data-oid="-7hnsfa"
                  >
                    <Icon className="w-4 h-4" data-oid="ems4y69" />
                    <span data-oid="90r880:">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Logout Button */}
            <div className="hidden md:flex items-center" data-oid="y_cm9yd">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md
                  text-parchment/60 hover:text-ink-red hover:bg-wood-medium/30
                  transition-all duration-200"
                data-oid="2v-ko1n"
              >
                <LogOut className="w-4 h-4" data-oid="8.:eg-w" />
                <span data-oid="f_j3:6g">Sign Out</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-md
                text-parchment/80 hover:bg-wood-medium/50 transition-colors"
              aria-label="Toggle navigation menu"
              data-oid=":ubvont"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" data-oid="ksnf0u1" />
              ) : (
                <Menu className="w-5 h-5" data-oid="nv9p9_d" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom decorative border with flourish */}
        <div
          className="h-px bg-gradient-to-r from-transparent via-wood-medium to-transparent"
          data-oid="26igcf4"
        />
        <div
          className="flex items-center justify-center -mt-px"
          data-oid="kv6e63v"
        >
          <div className="flex items-center gap-2" data-oid="k140lha">
            <span
              className="w-8 h-px bg-gradient-to-r from-transparent to-ink-gold/30"
              data-oid="4p-v7yd"
            />
            <span className="text-ink-gold/40 text-xs" data-oid="c8a6.4e">
              &#9830;
            </span>
            <span
              className="w-8 h-px bg-gradient-to-l from-transparent to-ink-gold/30"
              data-oid="c285-me"
            />
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div
            className="md:hidden bg-wood-dark border-t border-wood-medium/50 animate-fade-in"
            data-oid="ot3c9ei"
          >
            <nav className="px-4 py-3 space-y-1" data-oid="pm6gb7j">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md
                      transition-all duration-200
                      ${
                        isActive
                          ? "bg-wood-medium text-ink-gold"
                          : "text-parchment/80 hover:bg-wood-medium/50 hover:text-parchment"
                      }
                    `}
                    data-oid="z4_b81x"
                  >
                    <Icon className="w-5 h-5" data-oid=":t.bjw0" />
                    <span data-oid="ug5zz2s">{item.name}</span>
                  </Link>
                );
              })}

              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md
                  text-parchment/60 hover:text-ink-red hover:bg-wood-medium/30
                  transition-all duration-200 mt-2 border-t border-wood-medium/30 pt-4"
                data-oid="de4d5eb"
              >
                <LogOut className="w-5 h-5" data-oid="ksdy__w" />
                <span data-oid="vjeduja">Sign Out</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1" data-oid="d8z1q_c">
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
          data-oid="nuzriu."
        >
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="bg-parchment-dark border-t border-wood-medium/20"
        data-oid="gp7nhw0"
      >
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"
          data-oid="2kxuk0z"
        >
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-2"
            data-oid="nf7ljsl"
          >
            <p className="text-xs text-sepia/60 italic" data-oid="mx69dwo">
              &ldquo;Keep careful accounts, and the shillings shall mind
              themselves.&rdquo;
            </p>
            <p className="text-xs text-sepia/40" data-oid="ut-_ccl">
              The Counting House &middot; FY {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AppShell;
