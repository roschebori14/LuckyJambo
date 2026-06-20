import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#030712] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-black text-sm">LJ</div>
          <span className="font-black">LUCKY JAMBO</span>
        </Link>
        <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: January 2024</p>

        <div className="card p-8 space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Information We Collect</h2>
            <p>We collect your name, email, phone number, and transaction data when you register and use Lucky Jambo. We also collect device and usage data to improve our platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-3">How We Use Your Data</h2>
            <p>Your data is used to operate your account, process payments, prevent fraud, send notifications, and provide customer support. We do not sell your personal data to third parties.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Payment Data</h2>
            <p>Payment transactions are processed by Fapshi. Your Mobile Money details are used only for transaction processing and are not stored on our servers beyond what is necessary.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Data Security</h2>
            <p>We use industry-standard encryption and security practices. Your password is hashed and never stored in plain text. All data is stored on secure Supabase infrastructure.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Your Rights</h2>
            <p>You may request deletion of your account and personal data at any time by contacting <a href="mailto:support@luckyjambo.com" className="text-blue-400 hover:underline">support@luckyjambo.com</a>. We will process your request within 30 days.</p>
          </section>
        </div>
        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-500 hover:text-white text-sm">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
