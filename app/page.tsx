"use client";

import Link from "next/link";
import Image from "next/image";
import { Space_Grotesk } from "next/font/google";
import { useEffect, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
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
  ChevronLeft,
  ChevronRight,
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

// Spotlight slides - three real games, three real hooks. Not stock
// "testimonial" content: each slide states what the game actually is
// and why it plays differently on Lucky Jambo (turn-based vs. timed,
// stake range), so the slider is doing informational work, not just
// decoration.
const SPOTLIGHT_SLIDES = [
  {
    slug: "chess",
    eyebrow: "Turn-based · No time limit",
    title: "Chess, played for real stakes",
    body: "Full rules, drag-and-drop on desktop, tap-to-move on mobile. Take your time — matches run at your own pace, not a clock.",
  },
  {
    slug: "word-rush",
    eyebrow: "Instant · 80-second rounds",
    title: "Word Rush — race the clock together",
    body: "Both players get the same scrambled letters and the same 80-second countdown. Find more real words than your opponent, win the pot.",
  },
  {
    slug: "ludo",
    eyebrow: "Turn-based · Classic four-token play",
    title: "Ludo, the way it's always been played",
    body: "Roll, race, and send opponents home — the board game everyone grew up with, now with a wallet attached.",
  },
] as const;

export default function HomePage() {
  return (
    <main
      className={`${display.variable} min-h-screen text-[var(--lj-text)] selection:bg-[var(--lj-blue)] selection:text-white`}
      style={{ background: "var(--lj-navy)" }}
    >
      <PageAnimationStyles />

      {/* Ambient glow field - one atmosphere, set once, not repeated
          per-section, so it reads as lighting rather than decoration.
          Given a slow, ambient drift so the page feels alive without
          calling attention to itself. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="lj-orb-a absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--lj-blue)]/20 blur-[120px]" />
        <div className="lj-orb-b absolute top-[420px] -right-40 h-[420px] w-[420px] rounded-full bg-[var(--lj-cyan)]/10 blur-[100px]" />
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
            <Link href="/register" className="lj-btn-primary lj-pulse text-sm">
              Play now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28">
        <Reveal className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--lj-border)] bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--lj-cyan)]">
            <Zap size={12} className="lj-flicker" />
            Cameroon based platform &middot; Payment through MTN MOMO &amp;
            Orange Money
          </div>
          <h1
            className="mx-auto text-5xl leading-[1.05] font-bold tracking-tight text-white sm:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Stake your skill.
            <br />
            <span className="lj-gradient-text lj-shimmer-text">
              Win real cash.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[var(--lj-muted)] sm:text-lg">
            Challenge real players in Chess, Ludo, 8-Ball, and 11 more games.
            Every match is a real stake, every win pays out straight to your
            Mobile Money wallet — no admin queue, no waiting.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="lj-btn-primary flex items-center gap-2 px-8 py-4 text-base transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              Create your account <ArrowRight size={18} />
            </Link>
            <Link
              href="/games"
              className="group flex items-center gap-2 px-4 py-4 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              See all 14 games
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </Reveal>

        {/* Signature element: the stake flow itself. Not a generic
            stat block - this is the actual mechanic that makes the
            product trustworthy (transparent fee, instant settlement),
            shown as a single concrete match rather than described in
            prose. Each figure counts up into place the first time it
            scrolls into view. */}
        <Reveal delay={150} className="mx-auto mt-20 max-w-3xl">
          <div className="lj-card lj-card-hover px-6 py-6 sm:px-10 sm:py-8">
            <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-widest text-[var(--lj-muted)]">
              How a match settles
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <StakeStep
                label="Two stakes"
                value={1000}
                suffix=" XAF"
                sub="each player"
              />
              <Connector />
              <StakeStep
                label="Pot"
                value={2000}
                suffix=" XAF"
                sub="winner takes it"
                accent
              />
              <Connector />
              <StakeStep
                label="Platform fee"
                value={5}
                suffix="%"
                sub="the only cut taken"
                icon={<Percent size={14} className="text-[var(--lj-gold)]" />}
              />
              <Connector />
              <StakeStep
                label="Paid out"
                value={1900}
                suffix=" XAF"
                sub="to Mobile Money, instantly"
                success
              />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Why here / mechanics strip */}
      <section className="border-y border-[var(--lj-border)] bg-white/[0.02] px-6 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            {
              icon: <Smartphone size={20} />,
              label: "Fapshi-powered deposits & withdrawals",
            },
            {
              icon: <Lock size={20} />,
              label: "Every payout server-verified before crediting",
            },
            {
              icon: <Percent size={20} />,
              label: "Flat 5% platform fee, always",
            },
            {
              icon: <Users size={20} />,
              label: "Real opponents, real-time matches",
            },
          ].map((fact, i) => (
            <Reveal key={fact.label} delay={i * 90}>
              <Fact icon={fact.icon} label={fact.label} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Game spotlight slider - real product content, auto-rotating,
          pausable on hover/focus, keyboard + dot navigable. This is
          the "slides" element: each slide explains one game's actual
          mechanic rather than repeating generic marketing copy. */}
      <section className="px-6 pt-24 sm:pt-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <p
              className="text-sm font-semibold uppercase tracking-widest text-[var(--lj-cyan)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Spotlight
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Three ways to play
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <GameSpotlightSlider />
          </Reveal>
        </div>
      </section>

      {/* Featured games */}
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
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
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4">
            {FEATURED_GAMES.map((game, i) => (
              <Reveal key={game.slug} delay={(i % 4) * 90}>
                <Link
                  href={`/games/${game.slug}`}
                  className="lj-card lj-card-hover lj-game-tile group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden p-5"
                >
                  <Image
                    src={`/images/${game.slug}.png`}
                    alt={game.name}
                    fill
                    className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60 transition-all duration-500 group-hover:scale-110 group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--lj-navy)] via-[var(--lj-navy)]/30 to-transparent" />
                  <span className="lj-shine pointer-events-none absolute inset-0 -z-[5]" />
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
                  <h3 className="text-lg font-bold text-white transition-transform duration-300 group-hover:-translate-y-1">
                    {game.name}
                  </h3>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150} className="mt-10 text-center">
            <Link
              href="/games"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-[var(--lj-cyan)] hover:text-white"
            >
              View the full lineup
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--lj-border)] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <p
              className="text-sm font-semibold uppercase tracking-widest text-[var(--lj-cyan)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Three steps
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From deposit to payout
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                icon: <Wallet size={26} />,
                title: "Fund your wallet",
                body: "Deposit instantly via MTN or Orange Money through our Fapshi integration — no card, no bank account needed.",
              },
              {
                n: "02",
                icon: <Trophy size={26} />,
                title: "Stake and play",
                body: "Open a match or join one in the lobby. Both stakes go into the pot; whoever wins the game takes it.",
              },
              {
                n: "03",
                icon: <ShieldCheck size={26} />,
                title: "Withdraw instantly",
                body: "No approval queue. Winnings land in your Mobile Money wallet as soon as the match settles, 24/7.",
              },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 120}>
                <StepCard {...step} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 pb-24">
        <Reveal className="mx-auto max-w-4xl">
          <div className="lj-card lj-cta-glow relative overflow-hidden px-8 py-14 text-center sm:px-16">
            <h2
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your next opponent is already online.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[var(--lj-muted)]">
              Fund your wallet, pick a game, and put your skill on the line.
            </p>
            <Link
              href="/register"
              className="lj-btn-primary mt-8 inline-flex items-center gap-2 px-8 py-4 text-base transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              Create your account <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
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

/* ---------------------------------------------------------------
   Reveal: fade+rise on first scroll-into-view, via IntersectionObserver.
   Fires once (triggerOnce) so re-scrolling past a section doesn't
   replay it. Falls back to fully visible if IntersectionObserver is
   unavailable (older WebViews) rather than hiding content forever.
------------------------------------------------------------------ */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`lj-reveal ${visible ? "lj-reveal-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Game spotlight slider: autoplay every 6s, pauses on hover/focus so
   it never fights someone trying to read it, dot + arrow navigation.
------------------------------------------------------------------ */
function GameSpotlightSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % SPOTLIGHT_SLIDES.length),
    [],
  );
  const prev = useCallback(
    () =>
      setIndex(
        (i) => (i - 1 + SPOTLIGHT_SLIDES.length) % SPOTLIGHT_SLIDES.length,
      ),
    [],
  );

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [paused, next]);

  const slide = SPOTLIGHT_SLIDES[index];

  return (
    <div
      className="lj-card relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
        {SPOTLIGHT_SLIDES.map((s, i) => (
          <div
            key={s.slug}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: i === index ? 1 : 0 }}
            aria-hidden={i !== index}
          >
            <Image
              src={`/images/${s.slug}.png`}
              alt=""
              fill
              className="object-cover"
              priority={i === 0}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--lj-navy)] via-[var(--lj-navy)]/50 to-[var(--lj-navy)]/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--lj-navy)]/80 sm:from-[var(--lj-navy)]/70 sm:via-transparent" />
          </div>
        ))}

        <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:justify-center sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--lj-cyan)]">
            {slide.eyebrow}
          </p>
          <h3
            className="mt-2 max-w-md text-2xl font-bold text-white sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {slide.title}
          </h3>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--lj-muted)] sm:text-base">
            {slide.body}
          </p>
          <Link
            href={`/games/${slide.slug}`}
            className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-[var(--lj-cyan)]"
          >
            Play {GAME_LABELS[slide.slug] ?? slide.slug}{" "}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous game"
        className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next game"
        className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {SPOTLIGHT_SLIDES.map((s, i) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show ${GAME_LABELS[s.slug] ?? s.slug} slide`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   StakeStep: counts its value up from 0 the first time it scrolls
   into view, instead of appearing as static text - makes the "how a
   match settles" strip feel like a live calculation rather than a
   printed table.
------------------------------------------------------------------ */
function StakeStep({
  label,
  value,
  suffix = "",
  sub,
  accent,
  success,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  accent?: boolean;
  success?: boolean;
  icon?: ReactNode;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setDisplayValue(value);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const duration = 900;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--lj-muted)]">
        {label}
      </p>
      <p
        ref={ref}
        className={`mt-1 flex items-center gap-1 text-xl font-bold tabular-nums sm:text-2xl ${
          success ? "text-[var(--lj-success)]" : "text-white"
        } ${accent ? "lj-pot-glow" : ""}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {icon}
        {displayValue.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--lj-muted)]">{sub}</p>
    </div>
  );
}

function Connector() {
  return (
    <div className="lj-connector-flow hidden h-px w-8 flex-shrink-0 sm:block" />
  );
}

function Fact({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="group flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--lj-blue)]/15 text-[var(--lj-cyan)] transition-transform duration-300 group-hover:scale-110 group-hover:bg-[var(--lj-blue)]/25">
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
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="lj-card lj-card-hover group p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lj-blue)]/15 text-[var(--lj-cyan)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          {icon}
        </div>
        <span
          className="text-3xl font-bold text-white/10 transition-colors duration-300 group-hover:text-white/20"
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

/* ---------------------------------------------------------------
   All keyframes/animation-only CSS lives here, scoped to this page via
   styled-jsx, so nothing here leaks into or overrides the shared
   design system in app/globals.css. Every animated rule is wrapped in
   prefers-reduced-motion so motion-sensitive visitors get the same
   content instantly, with no transforms.
------------------------------------------------------------------ */
function PageAnimationStyles() {
  return (
    <style jsx global>{`
      .lj-reveal {
        opacity: 0;
        transform: translateY(24px);
      }
      @media (prefers-reduced-motion: no-preference) {
        .lj-reveal {
          transition:
            opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
      }
      .lj-reveal-in {
        opacity: 1;
        transform: translateY(0);
      }
      @media (prefers-reduced-motion: reduce) {
        .lj-reveal {
          opacity: 1;
          transform: none;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .lj-orb-a {
          animation: lj-float-a 14s ease-in-out infinite;
        }
        .lj-orb-b {
          animation: lj-float-b 18s ease-in-out infinite;
        }
        .lj-flicker {
          animation: lj-flicker 2.4s ease-in-out infinite;
        }
        .lj-pulse {
          animation: lj-pulse 3.2s ease-in-out infinite;
        }
        .lj-shimmer-text {
          background-size: 200% auto;
          animation: lj-shimmer 5s linear infinite;
        }
        .lj-connector-flow {
          background: linear-gradient(
            90deg,
            var(--lj-border),
            var(--lj-cyan),
            var(--lj-border)
          );
          background-size: 200% auto;
          animation: lj-shimmer 3.5s linear infinite;
        }
        .lj-pot-glow {
          text-shadow: 0 0 18px var(--lj-glow);
        }
        .lj-cta-glow::before {
          content: "";
          position: absolute;
          inset: -2px;
          background: conic-gradient(
            from 0deg,
            var(--lj-blue),
            var(--lj-cyan),
            var(--lj-gold),
            var(--lj-blue)
          );
          opacity: 0.15;
          animation: lj-spin 8s linear infinite;
          z-index: -1;
        }
        .lj-shine {
          background: linear-gradient(
            115deg,
            transparent 40%,
            rgba(255, 255, 255, 0.08) 50%,
            transparent 60%
          );
          background-size: 250% 250%;
          background-position: 200% 0;
          transition: background-position 0.8s ease;
        }
        .lj-game-tile:hover .lj-shine {
          background-position: -50% 0;
        }
      }

      @keyframes lj-float-a {
        0%,
        100% {
          transform: translate(-50%, 0);
        }
        50% {
          transform: translate(-50%, 24px);
        }
      }
      @keyframes lj-float-b {
        0%,
        100% {
          transform: translate(0, 0);
        }
        50% {
          transform: translate(-16px, -20px);
        }
      }
      @keyframes lj-flicker {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }
      @keyframes lj-pulse {
        0%,
        100% {
          box-shadow: 0 4px 15px var(--lj-glow);
        }
        50% {
          box-shadow:
            0 4px 25px var(--lj-glow),
            0 0 0 6px rgba(26, 86, 255, 0.08);
        }
      }
      @keyframes lj-shimmer {
        to {
          background-position: 200% center;
        }
      }
      @keyframes lj-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  );
}
