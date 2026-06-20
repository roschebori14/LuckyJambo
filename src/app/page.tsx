import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold text-lg">LJ</div>
          <span className="text-xl font-bold">Lucky <span className="text-blue-400">Jambo</span></span>
        </div>
        <div className="flex gap-3">
          <Link href="/auth/login" className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:bg-white/10 transition">
            Login
          </Link>
          <Link href="/auth/register" className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 transition font-medium">
            Register
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-24 px-6">
        <div className="inline-block px-4 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-blue-300 text-sm mb-6">
          🎮 Cameroon&apos;s #1 Skill Gaming Platform
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6">
          PLAY <span className="text-blue-400">•</span> COMPETE <span className="text-blue-400">•</span> WIN
        </h1>
        <p className="text-gray-300 text-xl max-w-2xl mx-auto mb-10">
          Challenge friends, play skill-based games, and win real money via Mobile Money. 100% secure, instant payouts.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/auth/register" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-bold transition card-glow">
            Start Playing Free →
          </Link>
          <Link href="#games" className="px-8 py-4 border border-white/20 hover:bg-white/10 rounded-xl text-lg transition">
            View Games
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto px-6 mb-20">
        {[
          { label: "Players", value: "500+" },
          { label: "Matches Played", value: "2,000+" },
          { label: "Paid Out (XAF)", value: "5M+" },
          { label: "Games Available", value: "5" },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-3xl font-black text-blue-400">{s.value}</div>
            <div className="text-gray-400 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Games */}
      <section id="games" className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-black text-center mb-10">Available Games</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Chess", emoji: "♟️", desc: "Classic chess with legal move validation, checkmate detection & time controls", badge: "Strategy" },
            { name: "Draughts", emoji: "🔴", desc: "International draughts — capture your opponent's pieces to win", badge: "Strategy" },
            { name: "Tic Tac Toe", emoji: "⭕", desc: "Fast-paced, best of 3 rounds. Perfect for quick matches", badge: "Classic" },
            { name: "Two Dice", emoji: "🎲", desc: "Roll the dice and bet on the outcome. Pure luck meets strategy", badge: "Luck" },
            { name: "Coin Flip", emoji: "🪙", desc: "Heads or tails — the fastest way to double your stake", badge: "Quick" },
          ].map((g) => (
            <div key={g.name} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition">
              <div className="text-4xl mb-3">{g.emoji}</div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold">{g.name}</h3>
                <span className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded-full">{g.badge}</span>
              </div>
              <p className="text-gray-400 text-sm">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-black text-center mb-10">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: "1", title: "Register", desc: "Create your free account in 30 seconds" },
            { step: "2", title: "Deposit", desc: "Fund your wallet via MTN or Orange Money" },
            { step: "3", title: "Challenge", desc: "Challenge friends or join public matches" },
            { step: "4", title: "Win & Withdraw", desc: "Winners receive 80% of the pot instantly" },
          ].map((h) => (
            <div key={h.step} className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-3">
                {h.step}
              </div>
              <h3 className="font-bold mb-1">{h.title}</h3>
              <p className="text-gray-400 text-sm">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-20 px-6 bg-blue-900/20 border-y border-white/5">
        <h2 className="text-4xl font-black mb-4">Ready to Win?</h2>
        <p className="text-gray-300 mb-8">Join hundreds of players competing for real money today</p>
        <Link href="/auth/register" className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-xl font-bold transition">
          Create Free Account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center py-10 px-6 text-gray-500 text-sm">
        <div className="flex gap-6 justify-center mb-4">
          <Link href="/legal/terms" className="hover:text-white transition">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-white transition">Privacy</Link>
          <Link href="/legal/responsible-gaming" className="hover:text-white transition">Responsible Gaming</Link>
          <a href="https://t.me/luckyjambo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Telegram</a>
        </div>
        <p>© {new Date().getFullYear()} Lucky Jambo. All rights reserved. 18+ only. Play responsibly.</p>
        <p className="mt-1">WhatsApp: +237683187249 | support@luckyjambo.cm</p>
      </footer>
    </div>
  );
}
