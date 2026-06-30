import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-lg border bg-white p-6">
        <h1 className="mb-6 text-center text-2xl font-bold">Forgot Password</h1>

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
