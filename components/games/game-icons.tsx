/**
 * Hand-built vector icons for each game, used in place of emoji
 * (which render inconsistently across devices/OSes and look
 * unpolished on a real-money product). Each icon is drawn flat in
 * white/translucent-white so it sits cleanly on the gradient tiles
 * used by GameCard and the game lobby header.
 */

type IconProps = { className?: string };

export function ChessIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M24 6c-2.2 0-4 1.8-4 4 0 1.2.5 2.2 1.3 3-1.9 1.3-3.3 3.4-3.3 6 0 2 .8 3.7 2 5-2.4 1.7-4 5-4 8.5V34h16v-1.5c0-3.5-1.6-6.8-4-8.5 1.2-1.3 2-3 2-5 0-2.6-1.4-4.7-3.3-6 .8-.8 1.3-1.8 1.3-3 0-2.2-1.8-4-4-4Z"
        fill="currentColor"
      />
      <rect x="14" y="36" width="20" height="4" rx="1" fill="currentColor" />
      <rect x="11" y="41" width="26" height="4" rx="1" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function DraughtsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="22" r="15" fill="currentColor" opacity="0.35" />
      <circle cx="24" cy="20" r="15" fill="currentColor" />
      <circle cx="24" cy="20" r="10" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
    </svg>
  );
}

export function TicTacToeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M17 6v36M31 6v36M6 17h36M6 31h36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M11 12l6 6M17 12l-6 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity="0.8" />
      <circle cx="37" cy="15" r="4.2" stroke="currentColor" strokeWidth="3.2" opacity="0.8" />
      <path d="M11 37l6-6M11 31l6 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function DiceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="7" y="15" width="20" height="20" rx="4" fill="currentColor" opacity="0.5" transform="rotate(-8 17 25)" />
      <rect x="21" y="9" width="20" height="20" rx="4" fill="currentColor" transform="rotate(8 31 19)" />
      <circle cx="27" cy="15" r="1.8" fill="white" />
      <circle cx="35" cy="15" r="1.8" fill="white" />
      <circle cx="31" cy="19" r="1.8" fill="white" />
      <circle cx="27" cy="23" r="1.8" fill="white" />
      <circle cx="35" cy="23" r="1.8" fill="white" />
    </svg>
  );
}

export function RockPaperScissorsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M17 21v-6a2.3 2.3 0 0 1 4.6 0v5M21.6 20v-7a2.3 2.3 0 0 1 4.6 0v7M26.2 20.5v-5a2.3 2.3 0 0 1 4.6 0v9.5M30.8 22v-2.5a2.2 2.2 0 0 1 4.4 0v9c0 5-3.6 9-9.4 9-3.6 0-5.7-1.3-7.6-4l-3.6-5.2c-.8-1.1-.4-2.6.8-3.2 1-.5 2.2-.2 2.9.7l2.1 2.7"
        fill="currentColor"
      />
    </svg>
  );
}

export function CoinFlipIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <ellipse cx="24" cy="30" rx="15" ry="6" fill="currentColor" opacity="0.35" />
      <circle cx="24" cy="20" r="15" fill="currentColor" />
      <circle cx="24" cy="20" r="10.5" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <path d="M20 16.5c0-2.5 1.8-4 4-4s4 1.5 4 4-1.8 3-4 4-4 1.5-4 4M24 27.5v.01" stroke="white" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const GAME_ICON: Record<string, (props: IconProps) => React.JSX.Element> = {
  chess: ChessIcon,
  draughts: DraughtsIcon,
  "tic-tac-toe": TicTacToeIcon,
  dice: DiceIcon,
  rock_paper_scissors: RockPaperScissorsIcon,
  coin_flip: CoinFlipIcon,
};

export function GameIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = GAME_ICON[slug] ?? DiceIcon;
  return <Icon className={className} />;
}
