import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-4xl font-bold text-foreground mb-2">404</h2>
        <p className="text-xl text-foreground mb-4">Page not found</p>
        <p className="text-mist mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2.5 bg-spectral text-white rounded-lg hover:bg-spectral/90 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
