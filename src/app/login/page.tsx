"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, KeyRound, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }

      // Redirect to dashboard on success
      router.push("/");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      data-oid="mc1imwu"
    >
      {/* Background decoration - subtle radial gradient */}
      <div className="fixed inset-0 -z-10" data-oid="24f9tv2">
        <div
          className="absolute inset-0 bg-gradient-to-br from-parchment via-parchment to-parchment-dark"
          data-oid="i3xdrd1"
        />
        <div
          className="absolute top-0 left-1/4 w-96 h-96 bg-ink-gold/5 rounded-full blur-3xl"
          data-oid="iwx10ig"
        />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-wood-medium/5 rounded-full blur-3xl"
          data-oid="1--re2a"
        />
      </div>

      <div className="w-full max-w-md" data-oid="q5f.xzc">
        {/* Decorative header */}
        <div className="text-center mb-8 animate-fade-in" data-oid="5zdn8pq">
          {/* Logo */}
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-wood-dark border-4 border-wood-medium/50 shadow-lg mb-4"
            data-oid="hj82hot"
          >
            <BookOpen className="w-10 h-10 text-ink-gold" data-oid="pr9oxgd" />
          </div>

          <h1
            className="text-4xl font-serif font-bold text-wood-dark tracking-wide"
            data-oid=".:occcn"
          >
            The Counting House
          </h1>

          {/* Victorian flourish */}
          <div className="mt-3 flourish" data-oid=".dmw5ax">
            <span
              className="text-xs tracking-widest text-sepia uppercase"
              data-oid="zei08h_"
            >
              Est. MMXXIV
            </span>
          </div>

          <p className="mt-4 text-sepia text-sm italic" data-oid="b_:5-6t">
            A Ledger for the Modern Bookkeeper
          </p>
        </div>

        {/* Login card */}
        <div
          className="bg-parchment-dark rounded-lg border border-wood-medium/40 overflow-hidden parchment-shadow corner-flourish animate-fade-in"
          style={{ animationDelay: "100ms" }}
          data-oid="1.c1efl"
        >
          {/* Card header */}
          <div
            className="bg-gradient-to-b from-wood-dark to-[#2d1a0e] px-6 py-4 border-b border-wood-medium/30"
            data-oid="kk6bs26"
          >
            <h2
              className="text-lg font-serif text-parchment text-center tracking-wide"
              data-oid="_3hsw1g"
            >
              Enter Your Credentials
            </h2>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-5"
            data-oid="r_dj_l_"
          >
            {/* Error message */}
            {error && (
              <div
                className="bg-ink-red/10 border border-ink-red/30 text-ink-red px-4 py-3 rounded-md text-sm animate-fade-in"
                data-oid=".4o-cm6"
              >
                <span className="font-medium" data-oid="tch9a-9">
                  Error:
                </span>{" "}
                {error}
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2" data-oid="gji77a3">
              <label
                htmlFor="username"
                className="flex items-center gap-2 text-sm font-medium text-ink-black"
                data-oid="c1c12zu"
              >
                <User className="w-4 h-4 text-sepia" data-oid="3n9ohog" />
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
                data-oid="2sll1oh"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2" data-oid=".t-pra0">
              <label
                htmlFor="password"
                className="flex items-center gap-2 text-sm font-medium text-ink-black"
                data-oid="5ydpd66"
              >
                <KeyRound className="w-4 h-4 text-sepia" data-oid="eaw.6re" />
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
                data-oid="b-.:afy"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
              data-oid="23k._ip"
            >
              {isLoading ? "Authenticating..." : "Sign In to the Ledger"}
            </Button>
          </form>

          {/* Footer decoration */}
          <div
            className="px-6 py-4 bg-parchment/50 border-t border-wood-medium/20"
            data-oid="wzp:3gl"
          >
            <p
              className="text-xs text-center text-sepia/70 italic"
              data-oid="jk2evml"
            >
              &ldquo;Keep careful accounts, and the shillings shall mind
              themselves.&rdquo;
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div
          className="mt-6 text-center animate-fade-in"
          style={{ animationDelay: "200ms" }}
          data-oid="9aj5m84"
        >
          <div
            className="inline-flex items-center gap-2 text-sepia/60 text-xs"
            data-oid="womknqb"
          >
            <span className="w-4 h-px bg-wood-medium/30" data-oid="3z8kixi" />
            <span data-oid="_l0up6f">Single-user secure access</span>
            <span className="w-4 h-px bg-wood-medium/30" data-oid="ehzz64c" />
          </div>
        </div>
      </div>
    </div>
  );
}
