import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-lg font-semibold text-ink">Not found</h1>
      <p className="mt-2 text-sm text-ink/45">That page does not exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-leaf">
        Home
      </Link>
    </div>
  );
}
