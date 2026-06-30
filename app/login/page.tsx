import Image from "next/image";
import Link from "next/link";
import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #04091a 0%, #0a1428 50%, #04091a 100%)" }}>
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Lucky Jambo" width={80} height={80} className="drop-shadow-2xl" />
          <h1 className="text-2xl font-black tracking-wide text-white">LUCKY <span style={{color:"var(--lj-cyan)"}}>JAMBO</span></h1>
          <p className="text-xs tracking-[0.3em] text-[var(--lj-muted)] uppercase">Play · Compete · Win</p>
        </div>

        {/* Card */}
        <div className="lj-card p-8">
          <h2 className="mb-1 text-xl font-bold text-white">Welcome back</h2>
          <p className="mb-6 text-sm text-[var(--lj-muted)]">Sign in to your account to continue</p>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--lj-muted)]">
          By signing in you agree to our{" "}
          <Link href="/terms" className="text-[var(--lj-blue-2)] hover:underline">Terms</Link>
          {" & "}
          <Link href="/privacy" className="text-[var(--lj-blue-2)] hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </main>
  );
}
