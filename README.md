# 3D Archery (R3F + Rapier) — integrated into LuckyJambo

Drop these files into the repo root at matching paths, then:

```bash
npm install three @react-three/fiber @react-three/drei @react-three/rapier
```

(`zustand` is already a dependency.) Visit `/archery-3d` — it's a standalone,
single-player prototype route under `(protected)`, not wired into
matchmaking. Verified versions: `@react-three/fiber@9.7.0`,
`@react-three/drei@10.7.7`, `@react-three/rapier@2.2.0`, `three@0.185.1` —
picked specifically for React 19/Next 16 compatibility (fiber v8 targets
React 18 only; this repo needed v9).

## File map (matches this repo's actual conventions, not generic ones)

```
types/archery-3d.ts                       (avoids colliding with types/archery.ts, the Phaser board's types)
store/archery-3d-store.ts                 (singular store/, matching store/auth-store.ts)
hooks/use-archery-3d-aim.ts               (kebab-case, matching use-match-realtime.ts)
components/games/archery-3d/
  game.tsx        client wrapper, dynamic(ssr:false) + HUD overlay
  experience.tsx   <Canvas>: lighting, Sky, Physics, arrow lifecycle
  overlay.tsx      Tailwind HUD: score, wind compass, arrow ticks
  target.tsx       fixed RigidBody, manifold-based hit scoring
  bow.tsx          visual-only, reads aim ref every frame
  arrow.tsx        dynamic RigidBody, velocity-aligned rotation
app/(protected)/archery-3d/page.tsx        matches the lj-page-header/max-w-4xl convention (see leaderboard/page.tsx)
```

Auth is already handled — every route under `(protected)/` gets
`requireAuth()` from that segment's own `layout.tsx`, so this page needed no
auth code of its own.

## Verified against this repo's real environment, not written from memory

Typechecked with `npx tsc --noEmit -p tsconfig.json` against this repo's
actual installed packages (not a scratch project) — all 10 new files check
completely clean.

**Two important things found and fixed along the way, worth knowing about:**

1. This zip's `node_modules/csstype/index.d.ts` was truncated mid-file
   (cut off at exactly line 3876, mid-sentence) — a packaging/upload
   artifact, not a real project issue, but it was silently swallowing
   *all* semantic type errors repo-wide (a fatal parse error in one
   dependency can abort the rest of a `tsc` run). Fixed locally by
   reinstalling `csstype`, which is what made the check above trustworthy.
2. `node_modules/zustand` in this zip was missing its `.d.ts` files
   entirely (present in `package.json`'s `"types"` field, absent on disk) -
   same category of issue, affecting the *pre-existing* `store/auth-store.ts`
   too, not just this new code. Also fixed locally by reinstalling.

Neither of these is something I changed in your source — they're artifacts
of how this particular zip's `node_modules` got exported. Your real dev
environment almost certainly has complete installs already, but if you ever
see `tsc` go suspiciously quiet (one lone unrelated error, nothing else) run
`rm -rf node_modules && npm install` before trusting the result — that's
the actual tell. (A third, same-category issue was spotted but *not*
touched: `react-chessboard`'s types are also incomplete in this zip,
producing errors in the pre-existing `chess-board.tsx` — unrelated to this
work, left alone.)

## Three implementation calls worth knowing before extending this

1. **Score comes from the real collision manifold**
   (`payload.manifold.localContactPoint1/2`), not an approximation from the
   arrow's whole-body position — already in the target's local face-plane
   coordinates, no extra projection math needed. See `target.tsx`.
2. **Arrow rotation uses `Quaternion.setFromUnitVectors`, not a literal
   `.lookAt()`** — the mesh is authored tip-along-+Y, and a raw `.lookAt()`
   assumes -Z-forward; `setFromUnitVectors` is the correct generalization.
   Explained inline in `arrow.tsx`.
3. **Wind is a continuous per-frame force**, not baked into the launch
   impulse — read via `getState()` (no subscription) inside `useFrame`, so
   it curves the arc over the flight instead of just nudging the initial
   heading.

Perf: drag tracking lives entirely in a ref (`use-archery-3d-aim.ts`), the
active-arrows list is the one legitimate `useState` (fires once per shot),
and the HUD's Zustand subscriptions are fine as normal reactive state since
everything they read changes at most once per shot too.
