'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  FolderOpen,
  Receipt,
  Upload,
  Download,
  Settings,
  LogOut,
  BookOpen,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Categories', href: '/categories', icon: FolderOpen },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Export', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navigation Bar */}
      <header className="bg-wood-dark text-parchment ink-shadow sticky top-0 z-50">
        {/* Top decorative border */}
        <div className="h-1 bg-gradient-to-r from-transparent via-ink-gold/40 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded bg-wood-medium/50 border border-wood-light/20">
                <BookOpen className="w-5 h-5 text-ink-gold" />
              </div>
              <div className="flex flex-col">
                <h1 className="font-serif text-xl font-semibold tracking-wide text-parchment">
                  The Counting House
                </h1>
                <span className="text-[10px] text-parchment/50 tracking-widest uppercase -mt-0.5">
                  Est. MMXXIV
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md
                      transition-all duration-200
                      ${isActive
                        ? 'bg-wood-medium text-ink-gold'
                        : 'text-parchment/80 hover:bg-wood-medium/50 hover:text-parchment'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Logout Button */}
            <div className="hidden md:flex items-center">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md
                  text-parchment/60 hover:text-ink-red hover:bg-wood-medium/30
                  transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-md
                text-parchment/80 hover:bg-wood-medium/50 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom decorative border with flourish */}
        <div className="h-px bg-gradient-to-r from-transparent via-wood-medium to-transparent" />
        <div className="flex items-center justify-center -mt-px">
          <div className="flex items-center gap-2">
            <span className="w-8 h-px bg-gradient-to-r from-transparent to-ink-gold/30" />
            <span className="text-ink-gold/40 text-xs">&#9830;</span>
            <span className="w-8 h-px bg-gradient-to-l from-transparent to-ink-gold/30" />
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-wood-dark border-t border-wood-medium/50 animate-fade-in">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md
                      transition-all duration-200
                      ${isActive
                        ? 'bg-wood-medium text-ink-gold'
                        : 'text-parchment/80 hover:bg-wood-medium/50 hover:text-parchment'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md
                  text-parchment/60 hover:text-ink-red hover:bg-wood-medium/30
                  transition-all duration-200 mt-2 border-t border-wood-medium/30 pt-4"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-parchment-dark border-t border-wood-medium/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-sepia/60 italic">
              &ldquo;Keep careful accounts, and the shillings shall mind themselves.&rdquo;
            </p>
            <p className="text-xs text-sepia/40">
              The Counting House &middot; FY 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AppShell;
