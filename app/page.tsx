import Link from "next/link";
import Image from "next/image";
import { Space_Grotesk } from "next/font/google";
import {
  Wallet,
  Trophy,
  ShieldCheck,
  Zap,
  Users,
  Smartphone,
  ArrowRight,
  Percent,
  Lock,
} from "lucide-react";
import { getGameMeta } from "@/components/games/game-meta";

// Scoped to this page only - the rest of the site sets its type
// entirely through Inter (see app/globals.css body{}), so this is a
// deliberate, contained exception: a display face just for the hero
// and section eyebrows, restrained everywhere else.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

// A curated highlight, not the full 14-game catalog - the point of
// this row is "look how much range there is", not an exhaustive list
// (that's what /games is for). Ordered to read Strategy -> Word ->
// Instant, so the range itself tells a story on the way down the row.
const FEATURED_SLUGS = [
  "chess",
  "eight-ball-pool",
  "word-rush",
  "ludo",
  "battleship",
  "dice",
  "coin_flip",
  "rock_paper_scissors",
] as const;

const GAME_LABELS: Record<(typeof FEATURED_SLUGS)[number], string> = {
  chess: "Chess",
  "eight-ball-pool": "8-Ball Pool",
  "word-rush": "Word Rush",
  ludo: "Ludo",
  battleship: "Battleship",
  dice: "Dice Duel",
  coin_flip: "Coin Flip",
  rock_paper_scissors: "Rock Paper Scissors",
};

const FEATURED_GAMES = FEATURED_SLUGS.map((slug) => ({
  slug,
  name: GAME_LABELS[slug],
  ...getGameMeta(slug),
}));

export default function HomePage() {
  return (
    <main
      className={`${display.variable} min-h-screen text-[var(--lj-text)] selection:bg-[var(--lj-blue)] selection:text-white`}
      style={{ background: "var(--lj-navy)" }}
    >
      {/* Ambient glow field - one atmosphere, set once, not repeated
          per-section, so it reads as lighting rather than decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--lj-blue)]/20 blur-[120px]" />
        <div className="absolute top-[420px] -right-40 h-[420px] w-[420px] rounded-full bg-[var(--lj-cyan)]/10 blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-30 border-b border-[var(--lj-border)] bg-[var(--lj-navy)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Lucky Jambo Logo"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span
              className="text-lg font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Lucky Jambo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--lj-muted)] transition-colors hover:text-white sm:block"
            >
              Log in
            </Link>
            <Link href="/register" className="lj-btn-primary text-sm">
              Play now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--lj-border)] bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--lj-cyan)]">
            <Zap size={12} />
            Cameroon based platform &middot; Payment through MTN MOMO &amp;
            Orange Money
          </div>
          <h1
            className="mx-auto text-5xl leading-[1.05] font-bold tracking-tight text-white sm:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Stake your skill.
            <br />
            <span className="lj-gradient-text">Win real cash.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[var(--lj-muted)] sm:text-lg">
            Challenge real players in Chess, Ludo, 8-Ball, and 11 more games.
            Every match is a real stake, every win pays out straight to your
            Mobile Money wallet — no admin queue, no waiting.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="lj-btn-primary flex items-center gap-2 px-8 py-4 text-base"
            >
              Create your account <ArrowRight size={18} />
            </Link>
            <Link
              href="/games"
              className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              See all 14 games <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Signature element: the stake flow itself. Not a generic
            stat block - this is the actual mechanic that makes the
            product trustworthy (transparent fee, instant settlement),
            shown as a single concrete match rather than described in
            prose. */}
        <div className="mx-auto mt-20 max-w-3xl">
          <div className="lj-card px-6 py-6 sm:px-10 sm:py-8">
            <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-widest text-[var(--lj-muted)]">
              How a match settles
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <StakeStep
                label="Two stakes"
                value="1,000 XAF"
                sub="each player"
              />
              <Connector />
              <StakeStep
                label="Pot"
                value="2,000 XAF"
                sub="winner takes it"
                accent
              />
              <Connector />
              <StakeStep
                label="Platform fee"
                value="5%"
                sub="the only cut taken"
                icon={<Percent size={14} className="text-[var(--lj-gold)]" />}
              />
              <Connector />
              <StakeStep
                label="Paid out"
                value="1,900 XAF"
                sub="to Mobile Money, instantly"
                success
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why here / mechanics strip */}
      <section className="border-y border-[var(--lj-border)] bg-white/[0.02] px-6 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
          <Fact
            icon={<Smartphone size={20} />}
            label="Fapshi-powered deposits & withdrawals"
          />
          <Fact
            icon={<Lock size={20} />}
            label="Every payout server-verified before crediting"
          />
          <Fact
            icon={<Percent size={20} />}
            label="Flat 5% platform fee, always"
          />
          <Fact
            icon={<Users size={20} />}
            label="Real opponents, real-time matches"
          />
        </div>
      </section>

      {/* Featured games */}
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p
              className="text-sm font-semibold uppercase tracking-widest text-[var(--lj-cyan)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The arena
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Deep strategy or instant action — your call
            </h2>
            <p className="mt-4 text-[var(--lj-muted)]">
              Fourteen games, one wallet. Turn-based games play out at your own
              pace; Instant games settle in seconds.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4">
            {FEATURED_GAMES.map((game) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                className="lj-card lj-card-hover group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden p-5"
              >
                <Image
                  src={`/images/${game.slug}.png`}
                  alt={game.name}
                  fill
                  className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60 transition-all duration-500 group-hover:scale-110 group-hover:opacity-90"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--lj-navy)] via-[var(--lj-navy)]/30 to-transparent" />
                <span
                  className={`absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm ${
                    game.type === "Instant"
                      ? "bg-[var(--lj-gold)]/25 text-[var(--lj-gold)]"
                      : "bg-[var(--lj-blue)]/25 text-[var(--lj-cyan)]"
                  }`}
                >
                  {game.type === "Instant" ? (
                    <Zap size={8} />
                  ) : (
                    <Trophy size={8} />
                  )}
                  {game.type}
                </span>
                <h3 className="text-lg font-bold text-white">{game.name}</h3>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/games"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--lj-cyan)] hover:text-white"
            >
              View the full lineup <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--lj-border)] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p
              className="text-sm font-semibold uppercase tracking-widest text-[var(--lj-cyan)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Three steps
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From deposit to payout
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              n="01"
              icon={<Wallet size={26} />}
              title="Fund your wallet"
              body="Deposit instantly via MTN or Orange Money through our Fapshi integration — no card, no bank account needed."
            />
            <StepCard
              n="02"
              icon={<Trophy size={26} />}
              title="Stake and play"
              body="Open a match or join one in the lobby. Both stakes go into the pot; whoever wins the game takes it."
            />
            <StepCard
              n="03"
              icon={<ShieldCheck size={26} />}
              title="Withdraw instantly"
              body="No approval queue. Winnings land in your Mobile Money wallet as soon as the match settles, 24/7."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--lj-border)] px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Lucky Jambo"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-bold tracking-tight text-white">
              Lucky Jambo
            </span>
          </div>
          <p className="text-sm text-[var(--lj-muted)]">
            © {new Date().getFullYear()} Lucky Jambo. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-[var(--lj-muted)]">
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-white"
            >
              Terms
            </Link>
            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-white"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function StakeStep({
  label,
  value,
  sub,
  accent,
  success,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  success?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--lj-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 flex items-center gap-1 text-xl font-bold sm:text-2xl ${
          success
            ? "text-[var(--lj-success)]"
            : accent
              ? "text-white"
              : "text-white"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {icon}
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--lj-muted)]">{sub}</p>
    </div>
  );
}

function Connector() {
  return (
    <div className="hidden h-px w-8 flex-shrink-0 bg-gradient-to-r from-[var(--lj-border)] to-[var(--lj-blue)]/40 sm:block" />
  );
}

function Fact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--lj-blue)]/15 text-[var(--lj-cyan)]">
        {icon}
      </div>
      <p className="text-sm font-medium text-[var(--lj-text)]">{label}</p>
    </div>
  );
}

function StepCard({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="lj-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lj-blue)]/15 text-[var(--lj-cyan)]">
          {icon}
        </div>
        <span
          className="text-3xl font-bold text-white/10"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {n}
        </span>
      </div>
      <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
      <p className="text-sm leading-6 text-[var(--lj-muted)]">{body}</p>
    </div>
  );
}
