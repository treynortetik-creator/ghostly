'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bot,
  Zap,
  DollarSign,
  MessageSquare,
  Link2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Waitlist Form — reusable component for hero + footer
// ---------------------------------------------------------------------------

type WaitlistStatus = 'idle' | 'loading' | 'success' | 'error';

function WaitlistForm({ id }: { id: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<WaitlistStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          company: company.trim() || undefined,
          role: role.trim() || undefined,
          source: 'landing-page',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="glass rounded-xl p-8 glass-shadow glass-glow animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
          <p className="text-lg font-semibold text-foreground">
            You&apos;re on the list!
          </p>
          <p className="text-mist text-sm">
            We&apos;ll be in touch soon. Keep an eye on your inbox.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-xl p-6 sm:p-8 glass-shadow space-y-4">
      {/* Error message */}
      {status === 'error' && errorMessage && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Row 1: Name + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text"
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Your name"
          className="w-full px-4 py-3 bg-card border border-border rounded-lg
                     text-foreground placeholder:text-mist/60
                     focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                     transition-all duration-200 glass-inset text-sm"
        />
        <input
          type="email"
          id={`${id}-email`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@company.com"
          className="w-full px-4 py-3 bg-card border border-border rounded-lg
                     text-foreground placeholder:text-mist/60
                     focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                     transition-all duration-200 glass-inset text-sm"
        />
      </div>

      {/* Row 2: Company + Role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text"
          id={`${id}-company`}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company (optional)"
          className="w-full px-4 py-3 bg-card border border-border rounded-lg
                     text-foreground placeholder:text-mist/60
                     focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                     transition-all duration-200 glass-inset text-sm"
        />
        <input
          type="text"
          id={`${id}-role`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (optional)"
          className="w-full px-4 py-3 bg-card border border-border rounded-lg
                     text-foreground placeholder:text-mist/60
                     focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                     transition-all duration-200 glass-inset text-sm"
        />
      </div>

      {/* Row 3: Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={status === 'loading'}
        rightIcon={status !== 'loading' ? <ArrowRight className="w-5 h-5" /> : undefined}
        className="w-full"
      >
        {status === 'loading' ? 'Submitting...' : 'Join the Waitlist'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Feature Cards Data
// ---------------------------------------------------------------------------

interface Feature {
  icon: typeof Bot;
  title: string;
  teaser: string;
  description: string;
  isHero?: boolean;
}

const FEATURES: Feature[] = [
  {
    icon: Bot,
    title: 'AI-Powered Event Agent',
    teaser: 'Your always-on event manager that thinks, plans, and executes.',
    description:
      'Ask questions in natural language, automate repetitive tasks, and get context-aware suggestions across your entire event portfolio. Ghostly\u2019s AI agent understands your events, budgets, contacts, and timelines \u2014 so you can focus on strategy, not spreadsheets.',
    isHero: true,
  },
  {
    icon: Zap,
    title: 'Automated Workflows',
    teaser: 'Notifications, reminders, and digests that run themselves.',
    description:
      'Set up daily and weekly digests, automatic task reminders, and budget alerts. Ghostly proactively keeps your team informed without anyone having to check the dashboard.',
  },
  {
    icon: DollarSign,
    title: 'Budget & Expense Intelligence',
    teaser: 'Real-time tracking with categorization and ROI analysis.',
    description:
      'Track expenses across events, categories, and quarters. Get automatic budget alerts before you overspend, and measure ROI across your entire event portfolio.',
  },
  {
    icon: MessageSquare,
    title: 'Slack & Integrations',
    teaser: 'Meet your team where they already work.',
    description:
      'Connect Slack for instant notifications, slash commands, and direct bot conversations. Route different notification types to different channels, and link events to dedicated Slack channels.',
  },
  {
    icon: Link2,
    title: 'MCP Compatible',
    teaser: 'Connect your own AI agent via Model Context Protocol.',
    description:
      'Ghostly exposes a full MCP server, so you can plug it into Claude Desktop, Cursor, or any MCP-compatible AI agent. Use your own tools to query events, manage budgets, and automate workflows.',
  },
];

// ---------------------------------------------------------------------------
// Feature Card Component
// ---------------------------------------------------------------------------

function FeatureCard({
  feature,
  isExpanded,
  onToggle,
  index,
}: {
  feature: Feature;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const Icon = feature.icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        w-full text-left rounded-xl transition-all duration-300 cursor-pointer
        glass glass-hover glass-shadow
        ${feature.isHero ? 'glass-glow border-spectral/30' : ''}
        ${isExpanded ? 'ring-1 ring-spectral/20' : ''}
      `}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`
              shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
              ${feature.isHero
                ? 'bg-spectral/20 text-spectral-light'
                : 'bg-ghost-light text-mist'
              }
            `}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Title + teaser */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              {feature.title}
              {feature.isHero && (
                <Sparkles className="w-4 h-4 text-spectral-light" />
              )}
            </h3>
            <p className="text-sm text-mist mt-1 leading-relaxed">
              {feature.teaser}
            </p>
          </div>

          {/* Expand chevron */}
          <div className="shrink-0 text-mist mt-1">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Expanded content */}
        <div
          className={`
            overflow-hidden transition-all duration-300
            ${isExpanded ? 'max-h-48 opacity-100 mt-4' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="pl-14 pr-2">
            <p className="text-sm text-mist leading-relaxed">
              {feature.description}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  function toggleCard(index: number) {
    setExpandedCard((prev) => (prev === index ? null : index));
  }

  return (
    <div className="min-h-screen">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-ghost-dark via-background to-ghost-medium" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-spectral/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-ether/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-spectral/3 rounded-full blur-3xl" />
      </div>

      {/* ===== A) Sticky Nav Bar ===== */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + name */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/images/ghostly-logo.jpg"
              alt="Ghostly"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-semibold text-foreground tracking-wide">
              Ghostly
            </span>
          </Link>

          {/* Right: Sign In */}
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      {/* ===== B) Hero Section ===== */}
      <section className="relative px-4 sm:px-6 pt-20 sm:pt-28 pb-8">
        <div className="max-w-3xl mx-auto text-center">
          {/* Logo */}
          <div
            className="inline-flex items-center justify-center mb-8 animate-fade-in"
          >
            <Image
              src="/images/ghostly-logo.jpg"
              alt="Ghostly"
              width={96}
              height={96}
              className="rounded-2xl shadow-lg shadow-spectral/10"
              priority
            />
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-tight animate-fade-in"
            style={{ animationDelay: '80ms' }}
          >
            The Invisible AI Agent{' '}
            <span className="bg-gradient-to-r from-spectral-light to-ether bg-clip-text text-transparent">
              Running Your Events
            </span>
          </h1>

          {/* Subtext */}
          <p
            className="mt-6 text-lg sm:text-xl text-mist max-w-2xl mx-auto leading-relaxed animate-fade-in"
            style={{ animationDelay: '160ms' }}
          >
            Ghostly is an AI-powered event management platform that handles
            budgets, tasks, documents, and communications &mdash; so you can
            focus on what matters.
          </p>

          {/* Ghost divider */}
          <div
            className="mt-8 ghost-divider max-w-md mx-auto animate-fade-in"
            style={{ animationDelay: '240ms' }}
          >
            <span className="text-xs tracking-widest text-mist uppercase">
              Join the Waitlist
            </span>
          </div>

          {/* Waitlist Form */}
          <div
            className="mt-8 max-w-xl mx-auto animate-fade-in"
            style={{ animationDelay: '320ms' }}
          >
            <WaitlistForm id="hero-waitlist" />
          </div>
        </div>
      </section>

      {/* ===== C) Feature Section ===== */}
      <section className="px-4 sm:px-6 py-24">
        <div className="max-w-3xl mx-auto">
          {/* Section heading */}
          <div className="text-center mb-12 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Built for Event Teams
            </h2>
            <p className="mt-3 text-mist text-lg">
              Everything you need, managed from the shadows.
            </p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {FEATURES.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                isExpanded={expandedCard === i}
                onToggle={() => toggleCard(i)}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== D) Footer CTA Section ===== */}
      <section className="px-4 sm:px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Heading */}
          <h2
            className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight animate-fade-in"
          >
            Ready to Transform Your Event Management?
          </h2>
          <p className="mt-4 text-mist text-lg animate-fade-in" style={{ animationDelay: '80ms' }}>
            Get early access to Ghostly and be the first to experience AI-powered event management.
          </p>

          {/* Waitlist Form */}
          <div className="mt-10 max-w-xl mx-auto animate-fade-in" style={{ animationDelay: '160ms' }}>
            <WaitlistForm id="footer-waitlist" />
          </div>

          {/* Divider */}
          <div className="mt-16 ghost-divider max-w-md mx-auto">
            <span className="text-xs tracking-widest text-mist uppercase">ghostly.ai</span>
          </div>

          {/* Copyright */}
          <p className="mt-6 text-xs text-mist/60">
            &copy; 2026 Ghostly. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
