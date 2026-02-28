"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ScrollText,
  RefreshCw,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/* ============================================
   AUDIT LOG VIEWER PAGE
   ============================================
   Read-only audit log viewer with filtering,
   pagination, and expandable change details.
   Ghostly theme: "The Chronicle"
   ============================================ */

interface AuditLogEntry {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  actor_type: string;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogResponse {
  entries: AuditLogEntry[];
  meta: { total: number };
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface AuditFilters {
  entity_type: string;
  action: string;
  actor: string;
  from: string;
  to: string;
}

const defaultFilters: AuditFilters = {
  entity_type: "",
  action: "",
  actor: "",
  from: "",
  to: "",
};

// Known entity types and actions for filter dropdowns
const ENTITY_TYPES = [
  "event",
  "expense",
  "category",
  "webhook",
  "document",
  "team_member",
  "settings",
];
const ACTIONS = ["create", "update", "delete"];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 50;

  // Fetch audit log entries
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", String(perPage));

      if (filters.entity_type) params.set("entity_type", filters.entity_type);
      if (filters.action) params.set("action", filters.action);
      if (filters.actor) params.set("actor", filters.actor);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Not authenticated. Please log in.");
        }
        throw new Error("Failed to fetch audit log");
      }

      const data: AuditLogResponse = await res.json();
      setEntries(data.entries || []);
      setTotalPages(data.pagination.total_pages);
      setTotalEntries(data.pagination.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load audit log",
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Reset page when filters change
  const handleFilterChange = (field: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Format timestamp
  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Render change details
  const renderChanges = (entry: AuditLogEntry) => {
    const details: Record<string, unknown> = {};
    if (entry.changes) details.changes = entry.changes;
    if (entry.metadata) details.metadata = entry.metadata;

    if (Object.keys(details).length === 0) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No change details recorded.
        </p>
      );
    }

    return (
      <pre className="text-xs text-foreground bg-background p-3 rounded border border-border overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  };

  // Pagination info
  const startItem =
    totalEntries === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, totalEntries);

  // Shared input classes
  const selectClasses = `
    px-3 py-2 rounded-md
    bg-background border border-border
    text-foreground text-sm
    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
    transition-colors duration-200
    cursor-pointer
  `;

  const inputClasses = `
    px-3 py-2 rounded-md
    bg-background border border-border
    text-foreground text-sm placeholder-muted-foreground/50
    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
    transition-colors duration-200
  `;

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-spectral" />
            The Chronicle
          </h1>
          <p className="mt-1 text-muted-foreground">
            Audit Log &middot; {totalEntries} entr
            {totalEntries === 1 ? "y" : "ies"} recorded
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEntries}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-400/10 border border-destructive/30 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <div className="flex flex-wrap gap-3 flex-1">
                {/* Entity Type */}
                <select
                  value={filters.entity_type}
                  onChange={(e) =>
                    handleFilterChange("entity_type", e.target.value)
                  }
                  className={selectClasses}
                >
                  <option value="">All Entity Types</option>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>

                {/* Action */}
                <select
                  value={filters.action}
                  onChange={(e) =>
                    handleFilterChange("action", e.target.value)
                  }
                  className={selectClasses}
                >
                  <option value="">All Actions</option>
                  {ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>

                {/* Actor */}
                <input
                  type="text"
                  placeholder="Filter by actor..."
                  value={filters.actor}
                  onChange={(e) =>
                    handleFilterChange("actor", e.target.value)
                  }
                  className={`${inputClasses} max-w-48`}
                />

                {/* Clear filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground shrink-0">
                  From:
                </label>
                <input
                  type="datetime-local"
                  value={filters.from}
                  onChange={(e) => handleFilterChange("from", e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground shrink-0">
                  To:
                </label>
                <input
                  type="datetime-local"
                  value={filters.to}
                  onChange={(e) => handleFilterChange("to", e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-spectral animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">
              Loading audit log...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && entries.length === 0 && (
        <Card className="border-dashed">
          <CardContent>
            <EmptyState
              icon={<ScrollText className="w-12 h-12" />}
              title="No Audit Entries Found"
              description={
                hasActiveFilters
                  ? "No entries match your current filters. Try adjusting your search criteria."
                  : "No audit log entries have been recorded yet."
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      {!isLoading && !error && entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
            <CardDescription>
              Showing {startItem}-{endItem} of {totalEntries} entries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-card/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">
                      {/* Expand toggle */}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Entity Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Entity ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => {
                    const isExpanded = expandedId === entry.id;
                    const actionColor =
                      entry.action === "create"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : entry.action === "delete"
                          ? "bg-red-400/10 text-red-400"
                          : "bg-spectral/10 text-spectral";

                    return (
                      <tr key={entry.id} className="group">
                        <td colSpan={6} className="p-0">
                          {/* Main row */}
                          <div
                            className="flex items-center cursor-pointer hover:bg-card/30 transition-colors"
                            onClick={() =>
                              setExpandedId(
                                isExpanded ? null : entry.id,
                              )
                            }
                          >
                            <div className="px-4 py-3 w-8">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                              {formatTimestamp(entry.created_at)}
                            </div>
                            <div className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm text-foreground">
                                {entry.actor}
                              </span>
                              {entry.actor_type && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  ({entry.actor_type})
                                </span>
                              )}
                            </div>
                            <div className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor}`}
                              >
                                {entry.action}
                              </span>
                            </div>
                            <div className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-spectral/10 text-foreground border border-border">
                                {entry.entity_type.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="px-4 py-3 whitespace-nowrap">
                              <span
                                className="text-sm text-muted-foreground font-mono max-w-32 truncate inline-block"
                                title={entry.entity_id}
                              >
                                {entry.entity_id.substring(0, 8)}...
                              </span>
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="px-12 py-4 bg-background/50 border-t border-border">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                    Full Entity ID
                                  </p>
                                  <p className="text-sm text-foreground font-mono break-all">
                                    {entry.entity_id}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                    Actor
                                  </p>
                                  <p className="text-sm text-foreground">
                                    {entry.actor} ({entry.actor_type})
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                  Changes / Metadata
                                </p>
                                {renderChanges(entry)}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalEntries > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-4 mt-4 bg-card rounded-lg border border-border">
          {/* Page info */}
          <span className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {startItem}-{endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {totalEntries}
            </span>
          </span>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page{" "}
              <span className="font-semibold text-foreground">
                {currentPage}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {totalPages}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;Every action leaves a trace in the chronicle.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
