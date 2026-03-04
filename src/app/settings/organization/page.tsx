"use client";

/**
 * Ghostly Organization Settings Page
 *
 * View and edit organization details, and see the member roster.
 * "The Organization Chambers"
 */

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Users,
  Shield,
  Crown,
  User,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/Card";

/* ============================================
   Types
   ============================================ */

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface OrgMember {
  id: string;
  user_id: string | null;
  email: string | null;
  role: string;
  legacy_username: string | null;
  accepted_at: string | null;
  invited_at: string | null;
  display_name: string;
}

/* ============================================
   Helpers
   ============================================ */

const inputClasses = `
  w-full px-4 py-2.5 rounded-md
  bg-background border border-border
  text-foreground placeholder:text-muted-foreground/50
  focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
  transition-colors duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
`;

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    owner: {
      icon: <Crown className="w-3 h-3" />,
      className:
        "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    admin: {
      icon: <Shield className="w-3 h-3" />,
      className:
        "bg-spectral/10 text-spectral border-spectral/30",
    },
    member: {
      icon: <User className="w-3 h-3" />,
      className:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
  };

  const { icon, className } = config[role] || config.member;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {icon}
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

/* ============================================
   Main Page Component
   ============================================ */

export default function OrganizationSettingsPage() {
  // Org state
  const [org, setOrg] = useState<Organization | null>(null);
  const [editName, setEditName] = useState("");
  const [originalName, setOriginalName] = useState("");

  // Members state
  const [members, setMembers] = useState<OrgMember[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasChanges = editName !== originalName;

  // Fetch org details and members
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [orgRes, membersRes] = await Promise.all([
        fetch("/api/organizations/current"),
        fetch("/api/organizations/members"),
      ]);

      if (!orgRes.ok) {
        throw new Error("Failed to load organization details");
      }

      const orgData = await orgRes.json();
      setOrg(orgData.organization);
      setEditName(orgData.organization.name);
      setOriginalName(orgData.organization.name);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save org name
  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/organizations/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update organization");
      }

      const data = await res.json();
      setOrg(data.organization);
      setEditName(data.organization.name);
      setOriginalName(data.organization.name);
      setSuccessMessage("Organization updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Format date
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Building2 className="w-8 h-8 text-spectral" />
            Organization Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your organization &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={isLoading || isSaving}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-spectral animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading organization...</p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-400/10 border border-destructive/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-3 p-4 bg-emerald-400/10 border border-emerald-400/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400">{successMessage}</p>
            </div>
          )}

          {/* Organization Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-spectral/10 text-spectral">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>
                    View and edit your organization information
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Org Name */}
              <div>
                <label
                  htmlFor="org_name"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Organization Name
                </label>
                <input
                  type="text"
                  id="org_name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClasses}
                  placeholder="My Organization"
                  disabled={isSaving}
                />
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Slug
                  </label>
                  <div className="px-4 py-2.5 rounded-md bg-background border border-border text-muted-foreground text-sm">
                    {org?.slug || "--"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Plan
                  </label>
                  <div className="px-4 py-2.5 rounded-md bg-background border border-border text-muted-foreground text-sm capitalize">
                    {org?.plan_tier || "Free"}
                  </div>
                </div>
              </div>

              {org?.created_at && (
                <p className="text-xs text-muted-foreground">
                  Created{" "}
                  {new Date(org.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditName(originalName);
                  setError(null);
                  setSuccessMessage(null);
                }}
                disabled={!hasChanges || isSaving}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!hasChanges || isSaving || !editName.trim()}
                isLoading={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save
              </Button>
            </CardFooter>
          </Card>

          {/* Members Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-spectral/10 text-spectral">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>
                    Members ({members.length})
                  </CardTitle>
                  <CardDescription>
                    People with access to this organization
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No members found.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-background"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground truncate">
                            {member.display_name}
                          </span>
                          <RoleBadge role={member.role} />
                        </div>
                        {member.email && member.email !== member.display_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {member.email}
                          </p>
                        )}
                        {member.accepted_at && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            Joined{" "}
                            {new Date(member.accepted_at).toLocaleDateString()}
                          </p>
                        )}
                        {!member.accepted_at && member.invited_at && (
                          <p className="text-xs text-amber-400/80 mt-0.5">
                            Invited{" "}
                            {new Date(member.invited_at).toLocaleDateString()}{" "}
                            &middot; Pending
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;An organization well-structured is a spirit well-anchored.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
