export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="max-w-md rounded-lg border bg-white p-6 text-center">
        <h1 className="mb-4 text-2xl font-bold">Verify Your Email</h1>

        <p className="text-gray-600">
          We've sent a verification link to your email address. Please check
          your inbox and click the verification link before logging in.
        </p>
      </div>
    </main>
  );
}
