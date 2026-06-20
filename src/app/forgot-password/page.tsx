'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Password reset email sent!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center font-black text-lg">LJ</div>
            <span className="font-black text-2xl">LUCKY <span className="text-[#00c6ff]">JAMBO</span></span>
          </Link>
          <h1 className="text-3xl font-black mb-2">Reset Password</h1>
          <p className="text-gray-400">{"Enter your email and we'll send a reset link"}</p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="font-bold text-lg mb-2">Check your email</h2>
              <p className="text-gray-400 text-sm mb-6">We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.</p>
              <Link href="/login" className="btn-primary text-sm py-2 px-6 inline-block">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" className="input-field" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center text-sm text-gray-500">
                <Link href="/login" className="text-blue-400 hover:text-blue-300">← Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
