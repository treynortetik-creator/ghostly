'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Link as LinkIcon } from 'lucide-react';
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

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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
    const trimmedSlug = slug.trim();

    if (!trimmedName) {
      setError('Organization name is required.');
      return;
    }
    if (!trimmedSlug || trimmedSlug.length < 3) {
      setError('Slug must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmedSlug) && trimmedSlug.length >= 3) {
      setError('Slug must start and end with a letter or number.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, slug: trimmedSlug }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create organization.');
        return;
      }

      // Org created — redirect to dashboard
      router.push('/');
      router.refresh();
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

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
