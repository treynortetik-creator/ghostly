'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
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
              Enter Your Credentials
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
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>

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
            <span>Single-user secure access</span>
            <span className="w-4 h-px bg-spectral/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
