'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, KeyRound, User } from 'lucide-react';
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
      {/* Background decoration - subtle radial gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-parchment via-parchment to-parchment-dark" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-ink-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-wood-medium/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Decorative header */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-wood-dark border-4 border-wood-medium/50 shadow-lg mb-4">
            <BookOpen className="w-10 h-10 text-ink-gold" />
          </div>

          <h1 className="text-4xl font-serif font-bold text-wood-dark tracking-wide">
            The Counting House
          </h1>

          {/* Victorian flourish */}
          <div className="mt-3 flourish">
            <span className="text-xs tracking-widest text-sepia uppercase">Est. MMXXIV</span>
          </div>

          <p className="mt-4 text-sepia text-sm italic">
            A Ledger for the Modern Bookkeeper
          </p>
        </div>

        {/* Login card */}
        <div
          className="bg-parchment-dark rounded-lg border border-wood-medium/40 overflow-hidden parchment-shadow corner-flourish animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          {/* Card header */}
          <div className="bg-gradient-to-b from-wood-dark to-[#2d1a0e] px-6 py-4 border-b border-wood-medium/30">
            <h2 className="text-lg font-serif text-parchment text-center tracking-wide">
              Enter Your Credentials
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-ink-red/10 border border-ink-red/30 text-ink-red px-4 py-3 rounded-md text-sm animate-fade-in">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="flex items-center gap-2 text-sm font-medium text-ink-black"
              >
                <User className="w-4 h-4 text-sepia" />
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-4 py-2.5 bg-parchment border border-wood-medium/50 rounded-md
                         text-ink-black placeholder:text-sepia/50
                         focus:ring-2 focus:ring-ink-gold/30 focus:border-ink-gold
                         transition-all duration-200 inset-shadow"
                placeholder="Enter your username"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="flex items-center gap-2 text-sm font-medium text-ink-black"
              >
                <KeyRound className="w-4 h-4 text-sepia" />
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 bg-parchment border border-wood-medium/50 rounded-md
                         text-ink-black placeholder:text-sepia/50
                         focus:ring-2 focus:ring-ink-gold/30 focus:border-ink-gold
                         transition-all duration-200 inset-shadow"
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
              {isLoading ? 'Authenticating...' : 'Sign In to the Ledger'}
            </Button>
          </form>

          {/* Footer decoration */}
          <div className="px-6 py-4 bg-parchment/50 border-t border-wood-medium/20">
            <p className="text-xs text-center text-sepia/70 italic">
              &ldquo;Keep careful accounts, and the shillings shall mind themselves.&rdquo;
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="inline-flex items-center gap-2 text-sepia/60 text-xs">
            <span className="w-4 h-px bg-wood-medium/30" />
            <span>Single-user secure access</span>
            <span className="w-4 h-px bg-wood-medium/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
