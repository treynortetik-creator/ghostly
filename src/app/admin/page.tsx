"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Trash2,
  Filter,
  Shield,
  Clock,
  Code,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/* ============================================
   ADMIN PAGE - Error Log Viewer
   ============================================
   Administrative dashboard for viewing and
   managing application error logs.
   Ghostly theme: "The Watchman's Station"
   ============================================ */

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  source: string;
  userId?: string;
  url?: string;
}

const levelConfig = {
  error: {
    icon: AlertCircle,
    label: "Error",
    bgColor: "bg-red-400/10",
    borderColor: "border-destructive/30",
    textColor: "text-destructive",
    badgeBg: "bg-red-400",
  },
  warn: {
    icon: AlertTriangle,
    label: "Warning",
    bgColor: "bg-amber-500/10 dark:bg-amber-900/20",
    borderColor: "border-amber-500/30 dark:border-amber-700/40",
    textColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-500 dark:bg-amber-600",
  },
  info: {
    icon: Info,
    label: "Info",
    bgColor: "bg-blue-500/10 dark:bg-blue-900/20",
    borderColor: "border-blue-500/30 dark:border-blue-700/40",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-500 dark:bg-blue-600",
  },
};

export default function AdminPage() {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ErrorLogEntry | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const detailDialogRef = useRef<HTMLDialogElement>(null);

  // Sync dialog open state with selectedLog
  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if (selectedLog) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [selectedLog]);

  // Filter state
  const [levelFilter, setLevelFilter] = useState<
    "all" | "error" | "warn" | "info"
  >("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Get unique sources from logs
  const uniqueSources = Array.from(new Set(logs.map((l) => l.source))).sort();

  // Fetch error logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);

      const response = await fetch(`/api/admin/errors?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Not authenticated. Please log in to view error logs.",
          );
        }
        throw new Error("Failed to fetch error logs");
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load error logs",
      );
    } finally {
      setIsLoading(false);
    }
  }, [levelFilter, sourceFilter]);

  // Clear all logs
  const handleClearLogs = async () => {
    setShowClearConfirm(false);

    try {
      const response = await fetch("/api/admin/errors", { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Failed to clear logs");
      }

      setLogs([]);
      setSelectedLog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear logs");
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format date for header
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Count logs by level
  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;
  const infoCount = logs.filter((l) => l.level === "info").length;

  return (
    <AppShell>
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear All Error Logs"
        message="Are you sure you want to clear all error logs? This action cannot be undone."
        variant="danger"
        confirmLabel="Clear All"
        onConfirm={handleClearLogs}
        onCancel={() => setShowClearConfirm(false)}
      />
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
       
      >
        <div>
          <h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
           
          >
            <Shield className="w-8 h-8 text-spectral" />
            The Watchman&apos;s Station
          </h1>
          <p className="mt-1 text-muted-foreground">
            Error Log Administration &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
           
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
             
            />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            disabled={isLoading || logs.length === 0}
           
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 mb-6 bg-red-400/10 border border-destructive/30 rounded-lg"
         
        >
          <AlertCircle
            className="w-5 h-5 text-destructive flex-shrink-0"
           
          />
          <p className="text-destructive">
            {error}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6"
       
      >
        <Card className="bg-background">
          <CardContent className="py-4">
            <div
              className="flex items-center justify-between"
             
            >
              <div>
                <p
                  className="text-xs text-muted-foreground uppercase tracking-wider"
                 
                >
                  Total Logs
                </p>
                <p
                  className="text-2xl font-bold text-foreground"
                 
                >
                  {logs.length}
                </p>
              </div>
              <Code
                className="w-8 h-8 text-muted-foreground/50"
               
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${levelConfig.error.bgColor} border ${levelConfig.error.borderColor}`}
         
        >
          <CardContent className="py-4">
            <div
              className="flex items-center justify-between"
             
            >
              <div>
                <p
                  className="text-xs text-muted-foreground uppercase tracking-wider"
                 
                >
                  Errors
                </p>
                <p
                  className={`text-2xl font-bold ${levelConfig.error.textColor}`}
                 
                >
                  {errorCount}
                </p>
              </div>
              <AlertCircle
                className={`w-8 h-8 ${levelConfig.error.textColor} opacity-50`}
               
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${levelConfig.warn.bgColor} border ${levelConfig.warn.borderColor}`}
         
        >
          <CardContent className="py-4">
            <div
              className="flex items-center justify-between"
             
            >
              <div>
                <p
                  className="text-xs text-muted-foreground uppercase tracking-wider"
                 
                >
                  Warnings
                </p>
                <p
                  className={`text-2xl font-bold ${levelConfig.warn.textColor}`}
                 
                >
                  {warnCount}
                </p>
              </div>
              <AlertTriangle
                className={`w-8 h-8 ${levelConfig.warn.textColor} opacity-50`}
               
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${levelConfig.info.bgColor} border ${levelConfig.info.borderColor}`}
         
        >
          <CardContent className="py-4">
            <div
              className="flex items-center justify-between"
             
            >
              <div>
                <p
                  className="text-xs text-muted-foreground uppercase tracking-wider"
                 
                >
                  Info
                </p>
                <p
                  className={`text-2xl font-bold ${levelConfig.info.textColor}`}
                 
                >
                  {infoCount}
                </p>
              </div>
              <Info
                className={`w-8 h-8 ${levelConfig.info.textColor} opacity-50`}
               
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
           
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span
                className="text-sm font-medium text-foreground"
               
              >
                Filters:
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Level Filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="level-filter"
                  className="text-sm text-muted-foreground"
                 
                >
                  Level:
                </label>
                <select
                  id="level-filter"
                  value={levelFilter}
                  onChange={(e) =>
                    setLevelFilter(e.target.value as typeof levelFilter)
                  }
                  className="px-3 py-1.5 text-sm bg-background border border-border rounded
                           text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50"
                 
                >
                  <option value="all">
                    All Levels
                  </option>
                  <option value="error">
                    Errors Only
                  </option>
                  <option value="warn">
                    Warnings Only
                  </option>
                  <option value="info">
                    Info Only
                  </option>
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="source-filter"
                  className="text-sm text-muted-foreground"
                 
                >
                  Source:
                </label>
                <select
                  id="source-filter"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-background border border-border rounded
                           text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50"
                 
                >
                  <option value="all">
                    All Sources
                  </option>
                  {uniqueSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div
          className="flex items-center justify-center py-16"
         
        >
          <div className="text-center">
            <RefreshCw
              className="w-8 h-8 text-spectral animate-spin mx-auto mb-3"
             
            />
            <p className="text-muted-foreground">
              Loading error logs...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && logs.length === 0 && (
        <Card className="border-dashed">
          <CardContent>
            <EmptyState
              icon={<Shield className="w-12 h-12 text-emerald-400/50" />}
              title="All Clear, Watchman"
              description="No error logs have been recorded. The ledgers are in good order, and all systems appear to be functioning properly."
            />
          </CardContent>
        </Card>
      )}

      {/* Error Logs Table */}
      {!isLoading && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Error Log Entries</CardTitle>
            <CardDescription>
              Showing {logs.length} log entr{logs.length === 1 ? "y" : "ies"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b border-border bg-card/50"
                   
                  >
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                     
                    >
                      Level
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                     
                    >
                      Timestamp
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                     
                    >
                      Source
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                     
                    >
                      Message
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                     
                    >
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y divide-border"
                 
                >
                  {logs.map((log) => {
                    const config = levelConfig[log.level];
                    const Icon = config.icon;

                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-card/30 transition-colors ${config.bgColor}`}
                       
                      >
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                         
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-phantom ${config.badgeBg}`}
                           
                          >
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                         
                        >
                          <div
                            className="flex items-center gap-1.5 text-sm text-foreground"
                           
                          >
                            <Clock
                              className="w-3.5 h-3.5 text-muted-foreground"
                             
                            />
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                         
                        >
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-spectral/10 text-foreground border border-border"
                           
                          >
                            {log.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className="text-sm text-foreground max-w-md truncate"
                            title={log.message}
                           
                          >
                            {log.message}
                          </p>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                         
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                           
                          >
                            View
                          </Button>
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

      {/* Detail Modal */}
      {selectedLog && (
        <dialog
          ref={detailDialogRef}
          className="fixed inset-0 z-50 m-auto w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-border bg-card p-0 shadow-xl glass-shadow backdrop:bg-black/50"
          onClose={() => setSelectedLog(null)}
        >
          <Card
            className="w-full max-h-[80vh] overflow-hidden border-0"
          >
            <CardHeader
              className="flex flex-row items-start justify-between"
             
            >
              <div>
                <CardTitle
                  className="flex items-center gap-2"
                 
                >
                  {(() => {
                    const config = levelConfig[selectedLog.level];
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon
                          className={`w-5 h-5 ${config.textColor}`}
                         
                        />
                        <span className={config.textColor}>
                          {config.label} Details
                        </span>
                      </>
                    );
                  })()}
                </CardTitle>
                <CardDescription>
                  ID: {selectedLog.id}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
               
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent
              className="overflow-y-auto max-h-[60vh] space-y-4"
             
            >
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                   
                  >
                    Timestamp
                  </p>
                  <p className="text-sm text-foreground">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                   
                  >
                    Source
                  </p>
                  <p className="text-sm text-foreground">
                    {selectedLog.source}
                  </p>
                </div>
                {selectedLog.url && (
                  <div className="col-span-2">
                    <p
                      className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                     
                    >
                      URL
                    </p>
                    <p
                      className="text-sm text-foreground break-all"
                     
                    >
                      {selectedLog.url}
                    </p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div>
                    <p
                      className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                     
                    >
                      User ID
                    </p>
                    <p className="text-sm text-foreground">
                      {selectedLog.userId}
                    </p>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <p
                  className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                 
                >
                  Message
                </p>
                <p
                  className="text-sm text-foreground bg-background p-3 rounded border border-border"
                 
                >
                  {selectedLog.message}
                </p>
              </div>

              {/* Stack Trace */}
              {selectedLog.stack && (
                <div>
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                   
                  >
                    Stack Trace
                  </p>
                  <pre
                    className="text-xs text-foreground bg-background p-3 rounded border border-border overflow-x-auto whitespace-pre-wrap font-mono"
                   
                  >
                    {selectedLog.stack}
                  </pre>
                </div>
              )}

              {/* Context */}
              {selectedLog.context &&
                Object.keys(selectedLog.context).length > 0 && (
                  <div>
                    <p
                      className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                     
                    >
                      Context
                    </p>
                    <pre
                      className="text-xs text-foreground bg-background p-3 rounded border border-border overflow-x-auto whitespace-pre-wrap font-mono"
                     
                    >
                      {JSON.stringify(selectedLog.context, null, 2)}
                    </pre>
                  </div>
                )}
            </CardContent>
          </Card>
        </dialog>
      )}

      {/* Footer */}
      <div
        className="text-center py-6 mt-8 border-t border-border"
       
      >
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;Vigilance is the price of a well-ordered house.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
