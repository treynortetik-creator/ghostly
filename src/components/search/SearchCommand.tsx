"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  Receipt,
  X,
  Loader2,
  Command,
} from "lucide-react";

/* ============================================
   SEARCH COMMAND PALETTE
   ============================================
   Cmd+K / Ctrl+K activated search across events
   and expenses. Ghostly glass-morphism overlay.
   ============================================ */

interface EventResult {
  id: string;
  name: string;
  location: string | null;
  quarter: string | null;
  date_start: string | null;
  match_field: string;
  snippet: string;
}

interface ExpenseResult {
  id: string;
  vendor: string | null;
  memo: string | null;
  amount: number;
  expense_date: string;
  event_id: string | null;
  category_id: string | null;
  match_field: string;
  snippet: string;
}

interface SearchResults {
  results: {
    events: EventResult[];
    expenses: ExpenseResult[];
  };
  meta: {
    query: string;
    total: number;
  };
}

interface SearchCommandProps {
  /** When true, show compact icon-only trigger (for collapsed sidebar) */
  collapsed?: boolean;
}

export function SearchCommand({ collapsed = false }: SearchCommandProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // All results as a flat list for keyboard nav
  const allResults: { type: "event" | "expense"; item: EventResult | ExpenseResult }[] = [];
  if (results) {
    results.results.events.forEach((item) =>
      allResults.push({ type: "event", item })
    );
    results.results.expenses.forEach((item) =>
      allResults.push({ type: "expense", item })
    );
  }

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&types=events,expenses&limit=10`
      );
      if (res.ok) {
        const data: SearchResults = await res.json();
        setResults(data);
        setSelectedIndex(0);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Navigate to result
  const navigateToResult = (result: { type: "event" | "expense"; item: EventResult | ExpenseResult }) => {
    setOpen(false);
    if (result.type === "event") {
      router.push(`/events/${result.item.id}`);
    } else {
      const expense = result.item as ExpenseResult;
      if (expense.event_id) {
        router.push(`/events/${expense.event_id}`);
      } else {
        router.push(`/expenses?vendor=${encodeURIComponent(expense.vendor || "")}`);
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && allResults.length > 0) {
      e.preventDefault();
      navigateToResult(allResults[selectedIndex]);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md
          text-sidebar-foreground/50 hover:bg-spectral/5 hover:text-sidebar-foreground
          transition-all duration-200 w-full"
        title={collapsed ? "Search (Cmd+K)" : undefined}
      >
        <Search className="w-5 h-5 shrink-0" />
        <span
          className={`
            whitespace-nowrap overflow-hidden transition-all duration-300
            ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
          `}
        >
          Search
        </span>
        {!collapsed && (
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-sidebar-foreground/10 rounded text-sidebar-foreground/40">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        )}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 rounded bg-ghost-light text-phantom text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
            Search
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-spectral animate-spin shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search events and expenses..."
              className="flex-1 py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm"
            />
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {query.length > 0 && query.length < 2 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
              </div>
            )}

            {!isLoading && results && allResults.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {results && results.results.events.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider bg-background/50">
                  Events
                </div>
                {results.results.events.map((event, i) => {
                  const flatIndex = i;
                  return (
                    <button
                      key={event.id}
                      onClick={() => navigateToResult({ type: "event", item: event })}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === flatIndex
                          ? "bg-spectral/10"
                          : "hover:bg-spectral/5"
                      }`}
                    >
                      <Calendar className="w-4 h-4 text-spectral mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {event.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {event.match_field !== "name" && (
                            <span className="text-spectral/70 mr-1">
                              {event.match_field.replace(/_/g, " ")}:
                            </span>
                          )}
                          {event.snippet}
                        </div>
                        {event.location && (
                          <div className="text-xs text-muted-foreground/60 mt-0.5">
                            {event.location} {event.quarter && `· ${event.quarter}`}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {results && results.results.expenses.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider bg-background/50">
                  Expenses
                </div>
                {results.results.expenses.map((expense, i) => {
                  const flatIndex = results.results.events.length + i;
                  return (
                    <button
                      key={expense.id}
                      onClick={() => navigateToResult({ type: "expense", item: expense })}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === flatIndex
                          ? "bg-spectral/10"
                          : "hover:bg-spectral/5"
                      }`}
                    >
                      <Receipt className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {expense.vendor || "Unknown Vendor"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {expense.snippet}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5">
                          ${typeof expense.amount === 'number' ? expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : expense.amount}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer hints */}
          <div className="px-4 py-2 border-t border-border bg-background/50 flex items-center gap-4 text-xs text-muted-foreground/50">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted-foreground/10 rounded text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted-foreground/10 rounded text-[10px]">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted-foreground/10 rounded text-[10px]">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchCommand;
