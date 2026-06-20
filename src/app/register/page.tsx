'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', username: '', fullName: '', phone: '', password: '', confirmPassword: '', age: false, terms: false });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (!form.age) return toast.error('You must confirm you are 18 or older');
    if (!form.terms) return toast.error('Please accept the Terms of Service');

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            username: form.username.toLowerCase().trim(),
            full_name: form.fullName.trim(),
            phone: form.phone.trim(),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      toast.success('Account created! Check your email to verify.');
      router.push('/login');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 py-12">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center font-black text-lg">LJ</div>
            <span className="font-black text-2xl">LUCKY <span className="text-[#00c6ff]">JAMBO</span></span>
          </Link>
          <h1 className="text-3xl font-black mb-2">Create your account</h1>
          <p className="text-gray-400">Join and start winning today</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <input name="fullName" type="text" value={form.fullName} onChange={handleChange} placeholder="John Doe" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input name="username" type="text" value={form.username} onChange={handleChange} placeholder="johndoe" className="input-field" required pattern="[a-zA-Z0-9_]{3,20}" title="3-20 chars, letters/numbers/underscore" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className="input-field" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone (Mobile Money)</label>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+237 6XX XXX XXX" className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 8 characters" className="input-field" required minLength={8} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat your password" className="input-field" required />
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input name="age" type="checkbox" checked={form.age} onChange={handleChange} className="mt-1 w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-gray-400">I confirm I am 18 years or older</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input name="terms" type="checkbox" checked={form.terms} onChange={handleChange} className="mt-1 w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-gray-400">
                  I agree to the{' '}
                  <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-center disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
