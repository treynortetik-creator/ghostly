"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bookmark, Plus, Trash2, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/* ============================================
   SAVED FILTER PRESETS
   ============================================
   Allows users to save and load filter
   combinations as named presets. Stored in org
   settings JSONB under saved_filters key.
   ============================================ */

export interface SavedFilter {
  name: string;
  page: string;
  params: Record<string, string>;
}

interface SavedFiltersProps {
  /** Current page identifier (e.g. "events", "expenses") */
  page: string;
  /** Current filter params to save */
  currentParams: Record<string, string>;
  /** Called when a saved preset is applied */
  onApply: (params: Record<string, string>) => void;
}

export function SavedFilters({ page, currentParams, onApply }: SavedFiltersProps) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch saved filters from settings
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.saved_filters && Array.isArray(data.saved_filters)) {
          setFilters(data.saved_filters);
        }
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only show filters relevant to this page
  const pageFilters = filters.filter((f) => f.page === page);

  // Check if current params have any active filters worth saving
  const hasActiveParams = Object.keys(currentParams).some(
    (k) => currentParams[k] && currentParams[k] !== "all"
  );

  const handleSave = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);

    const newFilter: SavedFilter = {
      name: newName.trim(),
      page,
      params: { ...currentParams },
    };

    const updatedFilters = [...filters, newFilter];

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_filters: updatedFilters }),
      });

      if (res.ok) {
        setFilters(updatedFilters);
        setNewName("");
        setShowSaveDialog(false);
      }
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (index: number) => {
    // Find the actual index in the full filters array
    const filterToDelete = pageFilters[index];
    const globalIndex = filters.indexOf(filterToDelete);
    if (globalIndex === -1) return;

    const updatedFilters = filters.filter((_, i) => i !== globalIndex);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_filters: updatedFilters }),
      });

      if (res.ok) {
        setFilters(updatedFilters);
      }
    } catch {
      // silently fail
    }
  };

  const handleApply = (filter: SavedFilter) => {
    onApply(filter.params);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        {/* Saved filters dropdown */}
        {pageFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="text-muted-foreground"
          >
            <Bookmark className="w-3.5 h-3.5 mr-1" />
            Presets
            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        )}

        {/* Save current filter */}
        {hasActiveParams && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            className="text-muted-foreground"
            title="Save current filters as a preset"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Save
          </Button>
        )}
      </div>

      {/* Dropdown: saved presets */}
      {isOpen && pageFilters.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[200px]">
          {pageFilters.map((filter, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 hover:bg-spectral/10 transition-colors group"
            >
              <button
                onClick={() => handleApply(filter)}
                className="flex-1 text-left text-sm text-foreground truncate"
              >
                {filter.name}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(i);
                }}
                className="p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Delete preset"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[240px]">
          <div className="flex items-center gap-2 mb-2">
            <Bookmark className="w-4 h-4 text-spectral shrink-0" />
            <span className="text-sm font-medium text-foreground">Save Filter Preset</span>
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Preset name..."
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors mb-2"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowSaveDialog(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!newName.trim() || isSaving}
              isLoading={isSaving}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SavedFilters;
