'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Link as LinkIcon, Copy, Check, Key, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

/**
 * Auto-generate a URL-friendly slug from an org name.
 * Strips non-alphanumerics, lowercases, collapses hyphens.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                 bg-spectral/10 hover:bg-spectral/20 border border-spectral/30
                 text-spectral-light rounded-md transition-all duration-200"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label || 'Copy'}
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Success state — API key + MCP config
// ---------------------------------------------------------------------------
function OnboardingSuccess({
  organization,
  apiKey,
}: {
  organization: { id: string; name: string; slug: string };
  apiKey: string;
}) {
  const router = useRouter();

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        ghostly: {
          command: 'npx',
          args: ['-y', 'ghostly-mcp'],
          env: {
            GHOSTLY_URL: typeof window !== 'undefined' ? window.location.origin : 'https://your-ghostly-url.com',
            GHOSTLY_API_KEY: apiKey,
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
          <Image src="/images/ghostly-logo.jpg" alt="Ghostly" width={96} height={96} className="rounded-2xl" />
        </div>

        <h1 className="text-4xl font-bold text-foreground tracking-wide">
          You&apos;re In
        </h1>

        <div className="mt-3 ghost-divider">
          <span className="text-xs tracking-widest text-mist uppercase">organization created</span>
        </div>

        <p className="mt-4 text-mist text-sm">
          <span className="text-foreground font-medium">{organization.name}</span> is ready to go.
          Save your API key below — you won&apos;t see it again.
        </p>
      </div>

      {/* API Key Card */}
      <div
        className="glass rounded-xl overflow-hidden glass-shadow animate-fade-in mb-6"
        style={{ animationDelay: '100ms' }}
      >
        <div className="bg-gradient-to-b from-spectral/20 to-transparent px-6 py-4 border-b border-border">
          <h2 className="text-lg text-foreground text-center tracking-wide flex items-center justify-center gap-2">
            <Key className="w-5 h-5 text-spectral-light" />
            Your API Key
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-md text-sm">
            <span className="font-semibold">Save this key now.</span> It is only displayed once and cannot be retrieved later.
          </div>

          {/* API Key display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">API Key</label>
              <CopyButton text={apiKey} label="Copy Key" />
            </div>
            <div className="w-full px-4 py-3 bg-card border border-border rounded-lg
                          text-foreground font-mono text-sm break-all glass-inset select-all">
              {apiKey}
            </div>
          </div>

          {/* MCP Config */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">MCP Configuration</label>
              <CopyButton text={mcpConfig} label="Copy Config" />
            </div>
            <p className="text-xs text-mist">
              Add this to your Claude Desktop or MCP client config:
            </p>
            <pre className="w-full px-4 py-3 bg-card border border-border rounded-lg
                          text-foreground font-mono text-xs overflow-x-auto glass-inset whitespace-pre">
              {mcpConfig}
            </pre>
          </div>
        </div>
      </div>

      {/* Go to Dashboard */}
      <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          rightIcon={<ArrowRight className="w-5 h-5" />}
          onClick={() => {
            router.push('/dashboard');
            router.refresh();
          }}
        >
          Go to Dashboard
        </Button>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="inline-flex items-center gap-2 text-mist/60 text-xs">
          <span className="w-4 h-px bg-spectral/20" />
          <span>Welcome to Ghostly, {organization.name}</span>
          <span className="w-4 h-px bg-spectral/20" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Onboarding Page
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Success state
  const [success, setSuccess] = useState(false);
  const [createdOrg, setCreatedOrg] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [createdApiKey, setCreatedApiKey] = useState('');

  // Auto-generate slug from org name (unless user manually edited it)
  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(orgName));
    }
  }, [orgName, slugTouched]);

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    // Only allow lowercase letters, numbers, and hyphens
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = orgName.trim();

    if (!trimmedName) {
      setError('Organization name is required.');
      return;
    }

    const currentSlug = slugTouched ? slug.trim() : slugify(trimmedName);
    if (!currentSlug || currentSlug.length < 3) {
      setError('Slug must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(currentSlug) && currentSlug.length >= 3) {
      setError('Slug must start and end with a letter or number.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: trimmedName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create organization.');
        return;
      }

      // Transition to success state
      setCreatedOrg(data.organization);
      setCreatedApiKey(data.apiKey);
      setSuccess(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render success state
  // ---------------------------------------------------------------------------
  if (success && createdOrg && createdApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-ghost-dark via-background to-ghost-medium" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-spectral/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-ether/5 rounded-full blur-3xl" />
        </div>
        <OnboardingSuccess organization={createdOrg} apiKey={createdApiKey} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render form state
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration - dark ethereal (same as login) */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-ghost-dark via-background to-ghost-medium" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-spectral/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-ether/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Decorative header */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
            <Image src="/images/ghostly-logo.jpg" alt="Ghostly" width={96} height={96} className="rounded-2xl" />
          </div>

          <h1 className="text-4xl font-bold text-foreground tracking-wide">
            Welcome to Ghostly
          </h1>

          {/* ghost divider */}
          <div className="mt-3 ghost-divider">
            <span className="text-xs tracking-widest text-mist uppercase">set up your organization</span>
          </div>

          <p className="mt-4 text-mist text-sm">
            Create your organization to get started managing events.
          </p>
        </div>

        {/* Onboarding card */}
        <div
          className="glass rounded-xl overflow-hidden glass-shadow animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          {/* Card header */}
          <div className="bg-gradient-to-b from-spectral/20 to-transparent px-6 py-4 border-b border-border">
            <h2 className="text-lg text-foreground text-center tracking-wide">
              New Organization
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm animate-fade-in">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* Organization name */}
            <div className="space-y-2">
              <label
                htmlFor="org-name"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Building2 className="w-4 h-4 text-mist" />
                Organization Name
              </label>
              <input
                type="text"
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-card border border-border rounded-lg
                         text-foreground placeholder:text-mist/60
                         focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                         transition-all duration-200 glass-inset"
                placeholder="Acme Events Inc."
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <label
                htmlFor="org-slug"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <LinkIcon className="w-4 h-4 text-mist" />
                URL Slug
              </label>
              <input
                type="text"
                id="org-slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-card border border-border rounded-lg
                         text-foreground placeholder:text-mist/60
                         focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                         transition-all duration-200 glass-inset"
                placeholder="acme-events"
              />
              {slug && (
                <p className="text-xs text-mist/70">
                  Your workspace URL: <span className="text-ether">{slug}</span>.ghostly.ai
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
            >
              {isLoading ? 'Creating...' : 'Create Organization'}
            </Button>
          </form>

          {/* Footer decoration */}
          <div className="px-6 py-4 bg-ghost-light/30 border-t border-border">
            <p className="text-xs text-center text-mist/70 italic">
              &ldquo;Every great event starts with a great team.&rdquo;
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="inline-flex items-center gap-2 text-mist/60 text-xs">
            <span className="w-4 h-px bg-spectral/20" />
            <span>You&apos;ll be the organization owner</span>
            <span className="w-4 h-px bg-spectral/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
