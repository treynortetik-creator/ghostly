'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 p-4">
      {/* Victorian-style card container */}
      <div className="w-full max-w-md">
        {/* Decorative header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-stone-800 dark:text-amber-100 tracking-wide">
            The Counting House
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-12 bg-amber-600/50"></span>
            <span className="text-amber-700 dark:text-amber-500 text-sm italic">Est. MMXXIV</span>
            <span className="h-px w-12 bg-amber-600/50"></span>
          </div>
          <p className="mt-3 text-stone-600 dark:text-stone-400 text-sm">
            A Ledger for the Modern Bookkeeper
          </p>
        </div>

        {/* Login form card */}
        <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
          {/* Card header with subtle pattern */}
          <div className="bg-gradient-to-r from-amber-700 to-amber-800 dark:from-amber-900 dark:to-amber-950 px-6 py-4">
            <h2 className="text-lg font-serif text-amber-50 text-center tracking-wide">
              Enter Your Credentials
            </h2>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-4 py-2.5 border border-stone-300 dark:border-stone-600 rounded-md
                         bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100
                         focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                         placeholder:text-stone-400 dark:placeholder:text-stone-500
                         transition-colors"
                placeholder="Enter your username"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-stone-300 dark:border-stone-600 rounded-md
                         bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100
                         focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                         placeholder:text-stone-400 dark:placeholder:text-stone-500
                         transition-colors"
                placeholder="Enter your password"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-700
                       hover:from-amber-700 hover:to-amber-800
                       disabled:from-stone-400 disabled:to-stone-500 disabled:cursor-not-allowed
                       text-white font-medium rounded-md shadow-md
                       transition-all duration-200 ease-in-out
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Sign In to the Ledger'
              )}
            </button>
          </form>

          {/* Footer decoration */}
          <div className="px-6 py-3 bg-stone-50 dark:bg-stone-900/50 border-t border-stone-200 dark:border-stone-700">
            <p className="text-xs text-center text-stone-500 dark:text-stone-400 italic">
              &ldquo;Keep careful accounts, and the shillings shall mind themselves.&rdquo;
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-600 text-xs">
            <span className="text-lg">&#9758;</span>
            <span>Single-user secure access</span>
          </div>
        </div>
      </div>
    </div>
  );
}
