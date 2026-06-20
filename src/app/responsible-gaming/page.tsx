import Link from 'next/link';

export default function ResponsibleGamingPage() {
  const signs = [
    'Spending more than you can afford to lose',
    'Chasing losses by playing more',
    'Neglecting work, family, or responsibilities',
    'Borrowing money to play',
    'Feeling anxious, irritable, or stressed when not playing',
    'Lying about how much time or money you spend gaming',
  ];

  const tips = [
    { icon: '⏱️', title: 'Set Time Limits', desc: 'Decide how long you will play before you start and stick to it.' },
    { icon: '💰', title: 'Set Deposit Limits', desc: 'Only deposit what you can afford to lose. Never play with essential funds.' },
    { icon: '🧘', title: 'Take Breaks', desc: 'Regular breaks help you stay in control and make clearer decisions.' },
    { icon: '🚫', title: 'Self-Exclude', desc: 'If you feel gaming is becoming a problem, contact us to disable your account.' },
    { icon: '👨‍👩‍👧', title: 'Talk to Someone', desc: 'Share your concerns with a trusted friend or family member.' },
    { icon: '📞', title: 'Seek Help', desc: 'Professional help is available if you need it.' },
  ];

  return (
    <div className="min-h-screen bg-[#030712] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-black text-sm">LJ</div>
          <span className="font-black">LUCKY JAMBO</span>
        </Link>

        <div className="card p-6 bg-yellow-500/10 border-yellow-500/30 mb-8">
          <div className="flex items-center gap-3 text-yellow-400 font-bold text-lg mb-2">
            ⚠️ Play Responsibly
          </div>
          <p className="text-gray-300 text-sm">Gaming should be fun and entertaining. If it stops being fun, stop playing. Lucky Jambo is committed to promoting safe and responsible gaming.</p>
        </div>

        <h1 className="text-4xl font-black mb-8">Responsible Gaming</h1>

        <div className="card p-8 space-y-8 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-4">Signs of Problem Gaming</h2>
            <ul className="space-y-2">
              {signs.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Tips for Safe Gaming</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tips.map((tip) => (
                <div key={tip.title} className="bg-white/5 rounded-xl p-4">
                  <div className="text-2xl mb-2">{tip.icon}</div>
                  <div className="font-bold text-white mb-1">{tip.title}</div>
                  <div className="text-xs text-gray-400">{tip.desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Self-Exclusion</h2>
            <p className="mb-4">If you want to take a break from gaming, contact us and we will immediately suspend your account. We will not allow you to create a new account during the exclusion period.</p>
            <a href="mailto:support@luckyjambo.com?subject=Self-Exclusion Request"
              className="btn-primary inline-block text-sm py-2 px-6">Request Self-Exclusion</a>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Get Help</h2>
            <p>If you or someone you know needs help with gambling addiction, reach out to us at <a href="mailto:support@luckyjambo.com" className="text-blue-400 hover:underline">support@luckyjambo.com</a> or contact a local mental health professional.</p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-500 hover:text-white text-sm">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
