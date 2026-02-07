"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { FiscalYear } from "@/types/database";

/* ============================================
   FISCAL YEAR SELECTOR COMPONENT
   ============================================
   Dropdown to select the current fiscal year
   with option to create new fiscal years.
   Victorian theme: "The Annual Registry"
   ============================================ */

interface FiscalYearSelectorProps {
  /** Currently selected fiscal year ID */
  value: string;
  /** Callback when fiscal year selection changes */
  onChange: (fiscalYearId: string) => void;
  /** Disable the selector */
  disabled?: boolean;
}

export function FiscalYearSelector({
  value,
  onChange,
  disabled = false,
}: FiscalYearSelectorProps) {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newYear, setNewYear] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch fiscal years
  useEffect(() => {
    const fetchFiscalYears = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/fiscal-years");
        if (!response.ok) throw new Error("Failed to fetch fiscal years");
        const data = await response.json();
        setFiscalYears(data.fiscal_years);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load fiscal years",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiscalYears();
  }, []);

  // Get selected fiscal year
  const selectedYear = fiscalYears.find((fy) => fy.id === value);

  // Handle create fiscal year
  const handleCreateFiscalYear = async () => {
    if (!newYear) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/fiscal-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(newYear, 10) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create fiscal year");
      }

      const newFiscalYear = await response.json();
      setFiscalYears((prev) =>
        [newFiscalYear, ...prev].sort((a, b) => b.year - a.year),
      );
      setShowCreateForm(false);
      setNewYear("");
      onChange(newFiscalYear.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create fiscal year",
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".fiscal-year-selector")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Card className="fiscal-year-selector" data-oid="9fbvzrq">
      <CardHeader divider={false} className="pb-2" data-oid="4ce:ph_">
        <CardTitle
          className="text-lg flex items-center gap-2"
          data-oid="di8qxbs"
        >
          <Calendar className="w-5 h-5 text-ink-gold" data-oid="uxd1zvz" />
          Fiscal Year
        </CardTitle>
        <p className="text-sm text-sepia mt-1" data-oid="48:ywgn">
          Select the active fiscal year for budgeting
        </p>
      </CardHeader>

      <CardContent data-oid="a9j.43k">
        {/* Dropdown Trigger */}
        <div className="relative" data-oid="w_agvvm">
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled || isLoading}
            className={`
              w-full flex items-center justify-between px-4 py-3
              bg-parchment border border-wood-medium/40 rounded-md
              text-wood-dark font-medium
              transition-all duration-200
              ${
                disabled || isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-wood-medium cursor-pointer"
              }
              ${isOpen ? "border-ink-gold ring-1 ring-ink-gold/30" : ""}
            `}
            data-oid="rb7g-4m"
          >
            <span className="flex items-center gap-2" data-oid="737ggr1">
              {isLoading ? (
                <span className="text-sepia" data-oid="223v9un">
                  Loading...
                </span>
              ) : selectedYear ? (
                <>
                  <span className="font-serif text-lg" data-oid=".grkgw1">
                    FY {selectedYear.year}
                  </span>
                  <span
                    className="text-xs text-sepia bg-wood-medium/10 px-2 py-0.5 rounded"
                    data-oid="bpr0boh"
                  >
                    Current
                  </span>
                </>
              ) : (
                <span className="text-sepia" data-oid="ewk2dnx">
                  Select fiscal year
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-sepia transition-transform ${isOpen ? "rotate-180" : ""}`}
              data-oid="evo8q_w"
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 z-10
              bg-parchment border border-wood-medium/40 rounded-md shadow-lg
              max-h-64 overflow-y-auto"
              data-oid="3:8g0ip"
            >
              {/* Fiscal Year Options */}
              {fiscalYears.map((fy) => (
                <button
                  key={fy.id}
                  type="button"
                  onClick={() => {
                    onChange(fy.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-4 py-3
                    text-left transition-colors
                    ${
                      fy.id === value
                        ? "bg-ink-gold/10 text-wood-dark"
                        : "hover:bg-wood-medium/10 text-wood-dark"
                    }
                  `}
                  data-oid="_jj1m0o"
                >
                  <span className="font-serif" data-oid="54ceyq5">
                    FY {fy.year}
                  </span>
                  {fy.id === value && (
                    <Check
                      className="w-4 h-4 text-ink-gold"
                      data-oid=":h8is01"
                    />
                  )}
                </button>
              ))}

              {/* Divider */}
              <div
                className="border-t border-wood-medium/20 my-1"
                data-oid="f8n8bin"
              />

              {/* Create New Option */}
              {!showCreateForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(true);
                    setNewYear(String(new Date().getFullYear() + 1));
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3
                    text-ink-gold hover:bg-ink-gold/10 transition-colors"
                  data-oid="rdoxa5i"
                >
                  <Plus className="w-4 h-4" data-oid="gz_2nuj" />
                  <span data-oid="4j6-c3v">Create New Fiscal Year</span>
                </button>
              ) : (
                <div className="p-4 space-y-3" data-oid="rc99r0c">
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    min="2000"
                    max="2100"
                    placeholder="Enter year (e.g., 2027)"
                    className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/40
                      rounded text-wood-dark focus:outline-none focus:ring-1 focus:ring-ink-gold"
                    data-oid="6l.frxk"
                  />

                  <div className="flex gap-2" data-oid="8w.uatk">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleCreateFiscalYear}
                      isLoading={isCreating}
                      disabled={!newYear}
                      data-oid="1sfeps_"
                    >
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewYear("");
                      }}
                      data-oid="p8ila5m"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p className="mt-2 text-sm text-ink-red" data-oid="bxikt3s">
            {error}
          </p>
        )}

        {/* Help Text */}
        <p className="mt-3 text-xs text-sepia/70" data-oid="7zp_jn6">
          The fiscal year determines which budget periods are displayed
          throughout the application.
        </p>
      </CardContent>
    </Card>
  );
}

export default FiscalYearSelector;
