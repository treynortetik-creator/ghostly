"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, ChevronDown } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrgSwitcherProps {
  isCollapsed?: boolean;
}

export function OrgSwitcher({ isCollapsed = false }: OrgSwitcherProps) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read the active org ID from the cookie
  const getActiveOrgId = useCallback((): string | null => {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("ghostly-active-org="));
    return match ? match.split("=")[1] : null;
  }, []);

  // Fetch orgs on mount
  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await fetch("/api/organizations");
        if (!res.ok) return;
        const data = await res.json();
        const orgList: Organization[] = data.organizations || [];
        setOrgs(orgList);

        // Determine active org from cookie
        const activeId = getActiveOrgId();
        const current = orgList.find((o) => o.id === activeId) || orgList[0] || null;
        setActiveOrg(current);
      } catch (err) {
        console.error("Failed to fetch organizations:", err);
      }
    }

    fetchOrgs();
  }, [getActiveOrgId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [open]);

  const handleSwitch = async (org: Organization) => {
    if (org.id === activeOrg?.id || switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id }),
      });

      if (res.ok) {
        // Reload the page to refresh all data with the new org context
        window.location.reload();
      } else {
        console.error("Failed to switch org");
        setSwitching(false);
      }
    } catch (err) {
      console.error("Switch org error:", err);
      setSwitching(false);
    }
  };

  // Don't render until we have data
  if (orgs.length === 0) return null;

  const hasMultipleOrgs = orgs.length > 1;

  // Collapsed state: just show icon with tooltip
  if (isCollapsed) {
    return (
      <div className="relative px-3 py-2" ref={dropdownRef}>
        <button
          onClick={() => hasMultipleOrgs && setOpen(!open)}
          aria-expanded={open}
          className={`
            group relative flex items-center justify-center w-full py-1.5 rounded-md
            text-sidebar-foreground/60 transition-all duration-200
            ${hasMultipleOrgs ? "hover:bg-spectral/5 hover:text-sidebar-foreground cursor-pointer" : "cursor-default"}
          `}
          title={activeOrg?.name || "Organization"}
        >
          <Building2 className="w-5 h-5 shrink-0" />
          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 rounded bg-ghost-light text-phantom text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
            {activeOrg?.name || "Organization"}
          </span>
        </button>

        {/* Dropdown for collapsed sidebar */}
        {open && hasMultipleOrgs && (
          <div className="absolute left-full top-0 ml-2 w-48 bg-sidebar border border-sidebar-border rounded-md shadow-lg z-50 py-1">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org)}
                disabled={switching}
                className={`
                  w-full text-left px-3 py-2 text-sm transition-colors duration-150
                  ${
                    org.id === activeOrg?.id
                      ? "text-spectral bg-spectral/10"
                      : "text-sidebar-foreground/70 hover:bg-spectral/5 hover:text-sidebar-foreground"
                  }
                `}
              >
                <span className="block truncate">{org.name}</span>
                <span className="block text-[10px] text-sidebar-foreground/40 uppercase">{org.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Expanded state
  return (
    <div className="relative px-3 py-2" ref={dropdownRef}>
      <button
        onClick={() => hasMultipleOrgs && setOpen(!open)}
        disabled={switching}
        aria-expanded={open}
        className={`
          flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm
          text-sidebar-foreground/70 transition-all duration-200
          ${hasMultipleOrgs ? "hover:bg-spectral/5 hover:text-sidebar-foreground cursor-pointer" : "cursor-default"}
          ${switching ? "opacity-50" : ""}
        `}
      >
        <Building2 className="w-4 h-4 shrink-0 text-sidebar-foreground/50" />
        <span className="truncate flex-1 text-left text-sidebar-foreground/70 text-[13px]">
          {switching ? "Switching..." : activeOrg?.name || "Select org"}
        </span>
        {hasMultipleOrgs && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {/* Dropdown */}
      {open && hasMultipleOrgs && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-sidebar border border-sidebar-border rounded-md shadow-lg z-50 py-1">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org)}
              disabled={switching}
              className={`
                w-full text-left px-3 py-2 text-sm transition-colors duration-150
                ${
                  org.id === activeOrg?.id
                    ? "text-spectral bg-spectral/10"
                    : "text-sidebar-foreground/70 hover:bg-spectral/5 hover:text-sidebar-foreground"
                }
              `}
            >
              <span className="block truncate">{org.name}</span>
              <span className="block text-[10px] text-sidebar-foreground/40 uppercase">{org.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrgSwitcher;
