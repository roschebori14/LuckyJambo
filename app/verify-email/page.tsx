import Image from "next/image";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #04091a 0%, #0a1428 50%, #04091a 100%)" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Lucky Jambo" width={80} height={80} className="drop-shadow-2xl" />
          <h1 className="text-2xl font-black tracking-wide text-white">LUCKY <span style={{color:"var(--lj-cyan)"}}>JAMBO</span></h1>
        </div>

        <div className="lj-card p-8 text-center">
          <h2 className="mb-3 text-xl font-bold text-white">Verify your email</h2>
          <p className="text-sm text-[var(--lj-muted)]">
            We&apos;ve sent a verification link to your email address. Please check
            your inbox and click the link before logging in.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--lj-muted)]">
          <Link href="/login" className="text-[var(--lj-blue-2)] hover:underline">Back to login</Link>
        </p>
      </div>
    </main>
  );
}
