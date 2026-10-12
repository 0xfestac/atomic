import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-mist-dim">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-white">Subject not found</h1>
      <p className="mt-2 max-w-sm text-sm text-mist">
        The address or page you requested is not in the dataset. Verify the address format (0x + 40 hex characters).
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to Discover
      </Link>
    </div>
  );
}
