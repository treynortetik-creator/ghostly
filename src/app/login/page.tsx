'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import {
  isSupabaseAuthEnabled,
  createBrowserSupabaseClient,
} from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Google SVG icon (inline to avoid external dependency)
// ---------------------------------------------------------------------------
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Supabase OAuth & Magic Link section
// ---------------------------------------------------------------------------
function SupabaseAuthSection() {
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState('');
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);

  async function handleGoogleOAuth() {
    setIsOAuthLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        console.error('Google OAuth error:', error.message);
        setIsOAuthLoading(false);
      }
      // If successful, the browser will redirect — no need to reset loading
    } catch {
      setIsOAuthLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setMagicLinkError('');
    setMagicLinkSent(false);
    setIsMagicLinkLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMagicLinkError(error.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setMagicLinkError('An error occurred. Please try again.');
    } finally {
      setIsMagicLinkLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Google OAuth button — primary CTA */}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        isLoading={isOAuthLoading}
        leftIcon={!isOAuthLoading ? <GoogleIcon className="w-5 h-5" /> : undefined}
        onClick={handleGoogleOAuth}
      >
        {isOAuthLoading ? 'Redirecting...' : 'Continue with Google'}
      </Button>

      {/* Magic link form */}
      <form onSubmit={handleMagicLink} className="space-y-3">
        <div className="space-y-2">
          <label
            htmlFor="magic-email"
            className="flex items-center gap-2 text-sm font-medium text-foreground"
          >
            <Mail className="w-4 h-4 text-mist" />
            Email Magic Link
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              id="magic-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="flex-1 px-4 py-2.5 bg-card border border-border rounded-lg
                       text-foreground placeholder:text-mist/60
                       focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                       transition-all duration-200 glass-inset"
              placeholder="you@example.com"
            />
            <Button
              type="submit"
              variant="outline"
              size="md"
              isLoading={isMagicLinkLoading}
              className="shrink-0"
            >
              Send
            </Button>
          </div>
        </div>
      </form>

      {/* Success message */}
      {magicLinkSent && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-md text-sm animate-fade-in">
          Check your email for a sign-in link.
        </div>
      )}

      {/* Error message */}
      {magicLinkError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm animate-fade-in">
          <span className="font-medium">Error:</span> {magicLinkError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy username/password form
// ---------------------------------------------------------------------------
function LegacyAuthForm({ isSecondary }: { isSecondary: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }

      // Redirect to dashboard on success
      router.push('/');
      router.refresh();
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm animate-fade-in">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Username field */}
      <div className="space-y-2">
        <label
          htmlFor="username"
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <User className="w-4 h-4 text-mist" />
          Username
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          className="w-full px-4 py-2.5 bg-card border border-border rounded-lg
                   text-foreground placeholder:text-mist/60
                   focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                   transition-all duration-200 glass-inset"
          placeholder="Enter your username"
        />
      </div>

      {/* Password field */}
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <User className="w-4 h-4 text-mist" />
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-4 py-2.5 bg-card border border-border rounded-lg
                   text-foreground placeholder:text-mist/60
                   focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                   transition-all duration-200 glass-inset"
          placeholder="Enter your password"
        />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        variant={isSecondary ? 'secondary' : 'primary'}
        size={isSecondary ? 'md' : 'lg'}
        isLoading={isLoading}
        className="w-full"
      >
        {isLoading ? 'Authenticating...' : 'Sign In'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Login Page
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const supabaseEnabled = isSupabaseAuthEnabled;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration - dark ethereal */}
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
            Ghostly
          </h1>

          {/* ghost divider */}
          <div className="mt-3 ghost-divider">
            <span className="text-xs tracking-widest text-mist uppercase">ghostly.ai</span>
          </div>

          <p className="mt-4 text-mist text-sm">
            The invisible AI agent running your events.
          </p>
        </div>

        {/* Login card */}
        <div
          className="glass rounded-xl overflow-hidden glass-shadow animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          {/* Card header */}
          <div className="bg-gradient-to-b from-spectral/20 to-transparent px-6 py-4 border-b border-border">
            <h2 className="text-lg text-foreground text-center tracking-wide">
              {supabaseEnabled ? 'Sign In' : 'Enter Your Credentials'}
            </h2>
          </div>

          {/* Auth forms */}
          <div className="p-6 space-y-5">
            {supabaseEnabled ? (
              <>
                {/* Supabase OAuth + magic link — primary */}
                <SupabaseAuthSection />

                {/* Separator */}
                <div className="ghost-divider">
                  <span className="text-xs tracking-widest text-mist uppercase">or</span>
                </div>

                {/* Legacy form — secondary styling */}
                <LegacyAuthForm isSecondary />
              </>
            ) : (
              /* Legacy-only mode */
              <LegacyAuthForm isSecondary={false} />
            )}
          </div>

          {/* Footer decoration */}
          <div className="px-6 py-4 bg-ghost-light/30 border-t border-border">
            <p className="text-xs text-center text-mist/70 italic">
              &ldquo;Your events, managed from the shadows.&rdquo;
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="inline-flex items-center gap-2 text-mist/60 text-xs">
            <span className="w-4 h-px bg-spectral/20" />
            <span>{supabaseEnabled ? 'Secure cloud authentication' : 'Single-user secure access'}</span>
            <span className="w-4 h-px bg-spectral/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
