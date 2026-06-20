import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#030712] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-black text-sm">LJ</div>
          <span className="font-black">LUCKY JAMBO</span>
        </Link>

        <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: January 2024</p>

        <div className="card p-8 space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Eligibility</h2>
            <p>You must be at least 18 years old and a resident of Cameroon to use Lucky Jambo. By registering, you confirm that you meet these requirements. We reserve the right to verify your age and identity at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Account Responsibility</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You must not share your account with others or allow others to access your account. Notify us immediately of any unauthorized use.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Skill-Based Gaming</h2>
            <p>Lucky Jambo offers peer-to-peer skill-based gaming. The outcome of games such as Chess and Draughts depends primarily on skill. Some games (Dice, Coin Flip) involve elements of chance. All games comply with applicable Cameroonian law.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Deposits & Withdrawals</h2>
            <p>All transactions are processed in XAF via Mobile Money (MTN MoMo and Orange Money). Deposits are credited after payment confirmation. Withdrawals are processed within 24 hours of admin approval. Minimum deposit: 50 XAF. Minimum withdrawal: 500 XAF.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Platform Fee</h2>
            <p>Lucky Jambo charges a 20% platform fee on all match winnings. This fee covers operational costs, payment processing, and platform maintenance. The fee is clearly displayed before any match begins.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Fair Play</h2>
            <p>Any attempt to cheat, collude, use bots, or manipulate game outcomes is strictly prohibited and will result in immediate account suspension and forfeiture of funds. We employ monitoring tools to detect unfair play.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Responsible Gaming</h2>
            <p>We are committed to responsible gaming. If you feel you may have a gambling problem, please contact us to self-exclude or set deposit limits. Gaming should be entertaining, not a source of financial stress.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Account Suspension</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or are used in a manner harmful to other users or the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Contact</h2>
            <p>For support or questions about these terms, contact us at <a href="mailto:support@luckyjambo.com" className="text-blue-400 hover:underline">support@luckyjambo.com</a> or via WhatsApp at +237 683 187 249.</p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-500 hover:text-white text-sm">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
