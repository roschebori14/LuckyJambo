import Link from "next/link";
import Image from "next/image";
import { Wallet, Trophy, ShieldCheck, Zap } from "lucide-react";

const FEATURED_GAMES = [
  { name: "Chess", slug: "chess", type: "Strategy" },
  { name: "Draughts", slug: "draughts", type: "Strategy" },
  { name: "Tic Tac Toe", slug: "tic-tac-toe", type: "Quick" },
  { name: "Dice Duel", slug: "dice", type: "Instant" },
  { name: "Rock Paper Scissors", slug: "rock_paper_scissors", type: "Instant" },
  { name: "Coin Flip", slug: "coin_flip", type: "Instant" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 selection:bg-blue-200">
      
      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <Image 
            src="/images/logo.png" 
            alt="Lucky Jambo Logo" 
            width={48} 
            height={48} 
            className="rounded-xl shadow-sm drop-shadow"
          />
          <span className="text-xl font-black tracking-tight text-blue-900">Lucky Jambo</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="hidden sm:block rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Login
          </Link>
          <Link href="/register" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5">
            Play Now
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-gray-50"></div>
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 sm:text-7xl">
            Cameroon’s Premier <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Skill Gaming</span> Platform
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Challenge real players in classic games like Chess, Draughts, and Dice. Put your skills to the test and win real cash instantly with automated Mobile Money payouts.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/register" className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-blue-600/20 transition-all hover:scale-105 hover:bg-blue-700">
              Start Winning Today
            </Link>
            <Link href="/games" className="text-base font-semibold leading-6 text-gray-900 hover:text-blue-600 flex items-center gap-2">
              Explore Games <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Games (Ads of Site) */}
      <section className="bg-white py-24 sm:py-32 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">The Arena</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Games you know and love</p>
            <p className="mt-4 text-gray-600">Choose your battlefield. Whether you prefer deep strategy or instant action, we have the perfect game for you.</p>
          </div>
          
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {FEATURED_GAMES.map((game) => (
              <div key={game.slug} className="group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-gray-900 px-8 pb-8 pt-60 sm:pt-48 lg:pt-60 transition-transform hover:scale-[1.02] cursor-pointer shadow-xl">
                <Image 
                  src={`/images/${game.slug}.png`} 
                  alt={game.name} 
                  fill 
                  className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-70 group-hover:opacity-100" 
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/40"></div>
                <div className="absolute inset-0 -z-10 rounded-2xl ring-1 ring-inset ring-gray-900/10"></div>

                <div className="flex flex-wrap items-center gap-y-1 overflow-hidden text-sm leading-6 text-gray-300">
                  <span className="mr-8 flex items-center gap-1">
                    {game.type === "Instant" ? <Zap size={14} className="text-yellow-400" /> : <Trophy size={14} className="text-blue-400" />}
                    {game.type}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-bold text-white">
                  <Link href={`/games/${game.slug}`}>
                    <span className="absolute inset-0"></span>
                    {game.name}
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works & Features */}
      <section className="py-24 sm:py-32 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">How Lucky Jambo Works</h2>
            <p className="mt-4 text-gray-600">Start playing and earning in three simple steps.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-sm">
                <Wallet size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">1. Fund your Wallet</h3>
              <p className="text-gray-600">Instantly deposit via MTN Mobile Money or Orange Money directly through our Fapshi integration.</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 shadow-sm">
                <Trophy size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">2. Play against Real People</h3>
              <p className="text-gray-600">Create a match or join an open lobby. Put your stake in the pot, winner takes all (minus a small 5% platform fee).</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-600 shadow-sm">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">3. Withdraw Instantly</h3>
              <p className="text-gray-600">No waiting for admin approvals. Cash out your winnings instantly 24/7 straight to your mobile wallet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="Lucky Jambo" width={32} height={32} className="rounded-lg shadow-sm" />
            <span className="font-bold text-gray-900 tracking-tight">Lucky Jambo</span>
          </div>
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} Lucky Jambo. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="#" className="hover:text-gray-900 transition-colors">Terms</Link>
            <Link href="#" className="hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-gray-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
