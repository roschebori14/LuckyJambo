import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h1 className="mb-6 text-5xl font-bold">Lucky Jambo</h1>

        <p className="mb-8 text-lg text-gray-600">
          Cameroon’s peer-to-peer skill gaming platform.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded bg-blue-600 px-6 py-3 text-white"
          >
            Get Started
          </Link>

          <Link href="/login" className="rounded border px-6 py-3">
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}
