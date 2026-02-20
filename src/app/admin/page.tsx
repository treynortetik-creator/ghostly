"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";

/* ============================================
   ADMIN PAGE - Error Log Viewer
   ============================================
   Administrative dashboard for viewing and
   managing application error logs.
   Victorian theme: "The Watchman's Station"
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
    bgColor: "bg-ink-red/10",
    borderColor: "border-ink-red/30",
    textColor: "text-ink-red",
    badgeBg: "bg-ink-red",
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
    if (
      !confirm(
        "Are you sure you want to clear all error logs? This action cannot be undone.",
      )
    ) {
      return;
    }

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
    <AppShell data-oid=":t9od5r">
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        data-oid="b_x-ld7"
      >
        <div data-oid="qelzfzf">
          <h1
            className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3"
            data-oid="c-kjg24"
          >
            <Shield className="w-8 h-8 text-ink-gold" data-oid="j2_usnr" />
            The Watchman&apos;s Station
          </h1>
          <p className="mt-1 text-sepia" data-oid="d_-:r7b">
            Error Log Administration &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3" data-oid="qtp7nrn">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            data-oid="-et2d.h"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              data-oid="znid2:l"
            />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearLogs}
            disabled={isLoading || logs.length === 0}
            data-oid="et9phwm"
          >
            <Trash2 className="w-4 h-4 mr-2" data-oid="yhx.ci6" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 mb-6 bg-ink-red/10 border border-ink-red/30 rounded-lg"
          data-oid="ozxardi"
        >
          <AlertCircle
            className="w-5 h-5 text-ink-red flex-shrink-0"
            data-oid="5bm3j4q"
          />
          <p className="text-ink-red" data-oid="m8:eiz_">
            {error}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6"
        data-oid="uyg8vgf"
      >
        <Card className="bg-parchment" data-oid="pt.wyr3">
          <CardContent className="py-4" data-oid="66fry_a">
            <div
              className="flex items-center justify-between"
              data-oid="cl.8uag"
            >
              <div data-oid="m6d_u4q">
                <p
                  className="text-xs text-sepia uppercase tracking-wider"
                  data-oid="eb688yu"
                >
                  Total Logs
                </p>
                <p
                  className="text-2xl font-serif font-bold text-wood-dark"
                  data-oid="kxk.p9t"
                >
                  {logs.length}
                </p>
              </div>
              <Code
                className="w-8 h-8 text-wood-medium/50"
                data-oid="i-1mdd0"
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${levelConfig.error.bgColor} border ${levelConfig.error.borderColor}`}
          data-oid="0d7bzs4"
        >
          <CardContent className="py-4" data-oid="qdy4kqq">
            <div
              className="flex items-center justify-between"
              data-oid="apuacrg"
            >
              <div data-oid=".9yrvom">
                <p
                  className="text-xs text-sepia uppercase tracking-wider"
                  data-oid="q..x..z"
                >
                  Errors
                </p>
                <p
                  className={`text-2xl font-serif font-bold ${levelConfig.error.textColor}`}
                  data-oid="df5_mcf"
                >
                  {errorCount}
                </p>
              </div>
              <AlertCircle
                className={`w-8 h-8 ${levelConfig.error.textColor} opacity-50`}
                data-oid="lak6gb."
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${levelConfig.warn.bgColor} border ${levelConfig.warn.borderColor}`}
          data-oid="p7442_l"
        >
          <CardContent className="py-4" data-oid="4pwd:p6">
            <div
              className="flex items-center justify-between"
              data-oid="9g.6htl"
            >
              <div data-oid="n-s5h3:">
                <p
                  className="text-xs text-sepia uppercase tracking-wider"
                  data-oid="3q_sc4b"
                >
                  Warnings
                </p>
                <p
                  className={`text-2xl font-serif font-bold ${levelConfig.warn.textColor}`}
                  data-oid="zp.6_ci"
                >
                  {warnCount}
                </p>
              </div>
              <AlertTriangle
                className={`w-8 h-8 ${levelConfig.warn.textColor} opacity-50`}
                data-oid="mi082._"
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${levelConfig.info.bgColor} border ${levelConfig.info.borderColor}`}
          data-oid="hpy6itu"
        >
          <CardContent className="py-4" data-oid="5qpqj0l">
            <div
              className="flex items-center justify-between"
              data-oid="g_xiwob"
            >
              <div data-oid="i--vagd">
                <p
                  className="text-xs text-sepia uppercase tracking-wider"
                  data-oid="xtqrpyp"
                >
                  Info
                </p>
                <p
                  className={`text-2xl font-serif font-bold ${levelConfig.info.textColor}`}
                  data-oid="l_nhhyd"
                >
                  {infoCount}
                </p>
              </div>
              <Info
                className={`w-8 h-8 ${levelConfig.info.textColor} opacity-50`}
                data-oid="w78b:vm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6" data-oid="t_kq25.">
        <CardContent className="py-4" data-oid="1:.o_59">
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
            data-oid="c9..ccx"
          >
            <div className="flex items-center gap-2" data-oid="wwpprxm">
              <Filter className="w-4 h-4 text-sepia" data-oid="ca_0a.r" />
              <span
                className="text-sm font-medium text-wood-dark"
                data-oid="_6liic_"
              >
                Filters:
              </span>
            </div>

            <div className="flex flex-wrap gap-3" data-oid="012a_.a">
              {/* Level Filter */}
              <div className="flex items-center gap-2" data-oid="nbkeqyp">
                <label
                  htmlFor="level-filter"
                  className="text-sm text-sepia"
                  data-oid="oeio-k8"
                >
                  Level:
                </label>
                <select
                  id="level-filter"
                  value={levelFilter}
                  onChange={(e) =>
                    setLevelFilter(e.target.value as typeof levelFilter)
                  }
                  className="px-3 py-1.5 text-sm bg-parchment border border-wood-medium/30 rounded
                           text-wood-dark focus:outline-none focus:ring-2 focus:ring-ink-gold/50"
                  data-oid="quv9ndc"
                >
                  <option value="all" data-oid="rje-vww">
                    All Levels
                  </option>
                  <option value="error" data-oid="prh0gi_">
                    Errors Only
                  </option>
                  <option value="warn" data-oid="-bw:5k1">
                    Warnings Only
                  </option>
                  <option value="info" data-oid="noqe4pc">
                    Info Only
                  </option>
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-2" data-oid="cv:fpml">
                <label
                  htmlFor="source-filter"
                  className="text-sm text-sepia"
                  data-oid="qore_vf"
                >
                  Source:
                </label>
                <select
                  id="source-filter"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-parchment border border-wood-medium/30 rounded
                           text-wood-dark focus:outline-none focus:ring-2 focus:ring-ink-gold/50"
                  data-oid="_nov_8j"
                >
                  <option value="all" data-oid="0j7f4c7">
                    All Sources
                  </option>
                  {uniqueSources.map((source) => (
                    <option key={source} value={source} data-oid="fxcbx2h">
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
          data-oid="fd4az:p"
        >
          <div className="text-center" data-oid="ws42zrj">
            <RefreshCw
              className="w-8 h-8 text-ink-gold animate-spin mx-auto mb-3"
              data-oid="cxtyfoa"
            />
            <p className="text-sepia" data-oid="ydsb330">
              Loading error logs...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && logs.length === 0 && (
        <Card className="border-dashed" data-oid="f0qzire">
          <CardContent className="py-16" data-oid="lwz:bs2">
            <div className="text-center" data-oid="-fky0ks">
              <Shield
                className="w-12 h-12 text-ink-green/50 mx-auto mb-4"
                data-oid="hxh3b.a"
              />
              <h3
                className="font-serif text-lg font-medium text-wood-dark mb-2"
                data-oid="h8ry7wa"
              >
                All Clear, Watchman
              </h3>
              <p
                className="text-sepia text-sm max-w-md mx-auto"
                data-oid="fxqy5rk"
              >
                No error logs have been recorded. The ledgers are in good order,
                and all systems appear to be functioning properly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Logs Table */}
      {!isLoading && logs.length > 0 && (
        <Card data-oid="tw0j_kw">
          <CardHeader data-oid="6.4z6yq">
            <CardTitle data-oid="_mlijl:">Error Log Entries</CardTitle>
            <CardDescription data-oid=":yboo49">
              Showing {logs.length} log entr{logs.length === 1 ? "y" : "ies"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0" data-oid="qlwonqc">
            <div className="overflow-x-auto" data-oid="ww.oxii">
              <table className="w-full" data-oid="39zya0k">
                <thead data-oid="hujgh0q">
                  <tr
                    className="border-b border-wood-medium/20 bg-parchment-dark/50"
                    data-oid="8o3pk0g"
                  >
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-sepia uppercase tracking-wider"
                      data-oid="4ttruok"
                    >
                      Level
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-sepia uppercase tracking-wider"
                      data-oid=":z-w7l:"
                    >
                      Timestamp
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-sepia uppercase tracking-wider"
                      data-oid="l6qigia"
                    >
                      Source
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-sepia uppercase tracking-wider"
                      data-oid="ngda5sx"
                    >
                      Message
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-sepia uppercase tracking-wider"
                      data-oid="yxzel_:"
                    >
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y divide-wood-medium/10"
                  data-oid="21efpkd"
                >
                  {logs.map((log) => {
                    const config = levelConfig[log.level];
                    const Icon = config.icon;

                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-parchment-dark/30 transition-colors ${config.bgColor}`}
                        data-oid="luff4ue"
                      >
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          data-oid="byr-9u-"
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-parchment ${config.badgeBg}`}
                            data-oid="o_xulpc"
                          >
                            <Icon className="w-3 h-3" data-oid="4g6::8b" />
                            {config.label}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          data-oid="jawjz6:"
                        >
                          <div
                            className="flex items-center gap-1.5 text-sm text-wood-dark"
                            data-oid="6_kg9o8"
                          >
                            <Clock
                              className="w-3.5 h-3.5 text-sepia"
                              data-oid="ugw-3ao"
                            />
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          data-oid="b9mjlsl"
                        >
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-wood-medium/10 text-wood-dark border border-wood-medium/20"
                            data-oid="tf--ier"
                          >
                            {log.source}
                          </span>
                        </td>
                        <td className="px-4 py-3" data-oid="3fs7.u0">
                          <p
                            className="text-sm text-wood-dark max-w-md truncate"
                            title={log.message}
                            data-oid="r_u_e.j"
                          >
                            {log.message}
                          </p>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          data-oid="act_1ad"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            data-oid="_7xiywq"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-black/50"
          data-oid="inj35:6"
        >
          <Card
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
            data-oid="-g.2du3"
          >
            <CardHeader
              className="flex flex-row items-start justify-between"
              data-oid="qvl8s6t"
            >
              <div data-oid="mq1c0:1">
                <CardTitle
                  className="flex items-center gap-2"
                  data-oid="1sw58ye"
                >
                  {(() => {
                    const config = levelConfig[selectedLog.level];
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon
                          className={`w-5 h-5 ${config.textColor}`}
                          data-oid="ldbw86a"
                        />
                        <span className={config.textColor} data-oid="ericlzq">
                          {config.label} Details
                        </span>
                      </>
                    );
                  })()}
                </CardTitle>
                <CardDescription data-oid="dcevzug">
                  ID: {selectedLog.id}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
                data-oid="8g_frl:"
              >
                <X className="w-4 h-4" data-oid="9quv386" />
              </Button>
            </CardHeader>
            <CardContent
              className="overflow-y-auto max-h-[60vh] space-y-4"
              data-oid="oaginb."
            >
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4" data-oid=".7k:s7e">
                <div data-oid="y20nlal">
                  <p
                    className="text-xs text-sepia uppercase tracking-wider mb-1"
                    data-oid="zz0:yje"
                  >
                    Timestamp
                  </p>
                  <p className="text-sm text-wood-dark" data-oid="wv0szna">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                <div data-oid="fasxue0">
                  <p
                    className="text-xs text-sepia uppercase tracking-wider mb-1"
                    data-oid="ey58smm"
                  >
                    Source
                  </p>
                  <p className="text-sm text-wood-dark" data-oid="155v4fg">
                    {selectedLog.source}
                  </p>
                </div>
                {selectedLog.url && (
                  <div className="col-span-2" data-oid="rqzaa2z">
                    <p
                      className="text-xs text-sepia uppercase tracking-wider mb-1"
                      data-oid="p3lh3r9"
                    >
                      URL
                    </p>
                    <p
                      className="text-sm text-wood-dark break-all"
                      data-oid="hdzxle7"
                    >
                      {selectedLog.url}
                    </p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div data-oid="g_pv3eu">
                    <p
                      className="text-xs text-sepia uppercase tracking-wider mb-1"
                      data-oid="mcvky5p"
                    >
                      User ID
                    </p>
                    <p className="text-sm text-wood-dark" data-oid="1b2:cvd">
                      {selectedLog.userId}
                    </p>
                  </div>
                )}
              </div>

              {/* Message */}
              <div data-oid="w_hxfn5">
                <p
                  className="text-xs text-sepia uppercase tracking-wider mb-1"
                  data-oid="zdn-0iw"
                >
                  Message
                </p>
                <p
                  className="text-sm text-wood-dark bg-parchment p-3 rounded border border-wood-medium/20"
                  data-oid="6e764mc"
                >
                  {selectedLog.message}
                </p>
              </div>

              {/* Stack Trace */}
              {selectedLog.stack && (
                <div data-oid="z1znvq4">
                  <p
                    className="text-xs text-sepia uppercase tracking-wider mb-1"
                    data-oid="xr.:cn6"
                  >
                    Stack Trace
                  </p>
                  <pre
                    className="text-xs text-wood-dark bg-parchment p-3 rounded border border-wood-medium/20 overflow-x-auto whitespace-pre-wrap font-mono"
                    data-oid="witq41o"
                  >
                    {selectedLog.stack}
                  </pre>
                </div>
              )}

              {/* Context */}
              {selectedLog.context &&
                Object.keys(selectedLog.context).length > 0 && (
                  <div data-oid="c_uu5ps">
                    <p
                      className="text-xs text-sepia uppercase tracking-wider mb-1"
                      data-oid="3je0iel"
                    >
                      Context
                    </p>
                    <pre
                      className="text-xs text-wood-dark bg-parchment p-3 rounded border border-wood-medium/20 overflow-x-auto whitespace-pre-wrap font-mono"
                      data-oid="3_upq0k"
                    >
                      {JSON.stringify(selectedLog.context, null, 2)}
                    </pre>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div
        className="text-center py-6 mt-8 border-t border-wood-medium/20"
        data-oid="efzsy0k"
      >
        <p className="text-xs text-sepia/60 italic" data-oid="v8bcgk-">
          &ldquo;Vigilance is the price of a well-ordered house.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
