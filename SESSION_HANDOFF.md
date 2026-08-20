# Session Handoff — FRC Scouting App (Pastascout)

Written at the end of the build/deploy session, for picking this up in a fresh
conversation. Read this first, then the main [README.md](README.md) for
day-to-day usage instructions — this file is about *what happened* and
*what to watch out for*, the README is about *how to use/run the thing*.

## What this is

A scouting app for FRC team TWHS-Pastabots, built for the 2026 game
**REBUILT presented by Haas**. Match scouting (with a freehand auton path
mapper), pit scouting (with photos), in-house OPR/EPA, a suggested pick list,
and TBA/manual event import. Offline-first — works with zero connectivity for
the actual scouting-entry workflow.

## Live deployment

| Piece | URL / location |
|---|---|
| Repo | https://github.com/TWHS-Pastabots/Pastascout (public) |
| Client (GitHub Pages) | https://twhs-pastabots.github.io/Pastascout/ |
| Server (Render, free tier) | https://frc-scouting-server.onrender.com |
| Database (Turso) | database name **`pastascout-20`** — see note below |

**Render free tier spins down after ~15 min idle** — first request after that
takes up to ~50s to wake back up. Not a bug, just the free tier.

**Turso gotcha:** there are *two* Turso databases — `pastascout` (original,
now orphaned/unused, safe to delete) and `pastascout-20` (the real one,
auto-created because Turso appends a number when a name collides). Everything
— Render's env vars and the local `.env` — points at `pastascout-20`. If you
ever see "invalid token" errors, check you're not accidentally using
`pastascout`'s credentials against `pastascout-20`'s URL or vice versa.

## Architecture

npm-workspaces monorepo, three packages:

- **`packages/shared`** — pure TS/Zod, no I/O. Game config (`gameConfig.ts`),
  types (`types.ts`), OPR/EPA math (`stats.ts`), schedule/team CSV parsers
  (`scheduleParser.ts`), pick-list suggestion algorithm (`pickList.ts`),
  QR chunking protocol (`qrTransfer.ts`), path simplification
  (`simplifyPath.ts`). 49 vitest tests, all passing. Built to `dist/` — the
  server and (at build time) client both import the **compiled** output, not
  the source, because plain `node` can't run TypeScript directly.
- **`packages/server`** — Express + TS. Storage is behind a `DbAdapter`
  interface (`db/adapter.ts`) with two implementations: `sqliteAdapter.ts`
  (Node's built-in `node:sqlite`, zero native deps, used when no Turso env
  vars are set — this is the "laptop at a competition, no internet" mode) and
  `tursoAdapter.ts` (hosted libSQL, used when `TURSO_DATABASE_URL` +
  `TURSO_AUTH_TOKEN` are set — this is what's live on Render). Everything in
  `db/repositories.ts` is async so both backends share one code path.
- **`packages/client`** — React + Vite + Tailwind v4 + Zustand (persisted) +
  Dexie (IndexedDB outbox for offline) + TanStack Query. PWA via
  `vite-plugin-pwa`.

## Everything built, roughly in order

1. **Core app**: role picker (scout/analyst), match scouting form, pit
   scouting form, offline outbox + background sync, hamburger nav menu.
2. **Auton path mapper**: freehand drawing (not tap-to-place) over a real
   field image (`packages/client/public/field-2026.png` — dropped in from a
   file the user already had; falls back to a drawn schematic if that file's
   ever missing), with Ramer–Douglas–Peucker simplification so a finger drag
   doesn't bloat every entry.
3. **Pit scouting extras**: photo upload (client-side compressed to
   ~100-300KB before upload), trench-crossing toggle, fuel capacity.
4. **TBA integration, two paths**:
   - Auto-sync via `TBA_API_KEY` + `TBA_EVENT_KEY` env vars (needs a Google
     account — the user's *school* Google account was blocked from TBA's
     sign-in; a personal Gmail works fine as a workaround, never actually
     resolved/tested with a real key).
   - No-key manual import: paste a schedule/team list as plain text. The
     parser (`scheduleParser.ts`) handles **both** a simple hand-typed format
     *and* TBA's own public "Scouting" tab CSV export (named, reordered
     columns, includes real match scores) — verified against a real event's
     actual export.
5. **OPR/EPA + dashboard**: classic least-squares OPR off official scores,
   an EPA-*inspired* (not a Statbotics clone) rolling estimate, blended
   ranking with adjustable weights.
6. **Suggested pick list**: 4 strategies (balanced / complement / mirror /
   defensive), each suggestion shows *why* (e.g. "Covers your gap in endgame
   climbing") and warnings (thin data, breakdown rate). 12 unit tests.
7. **Deployment** (the big multi-session saga):
   - GitHub repo created, pushed (needed a PAT with `repo` **and** `workflow`
     scopes — a plain `repo`-scope token gets rejected for pushing
     `.github/workflows/*` files specifically).
   - Discovered and fixed a **real production bug**: `shared`'s
     `package.json` pointed `main`/`types` at TypeScript source, which only
     works under `tsx` (dev). A plain `node dist/index.js` (what Render
     actually runs) crashed on startup. Fixed by pointing at compiled
     `dist/`, plus explicit `.js` extensions on shared's internal imports
     (required for Node's ESM resolution).
   - Render Blueprint (`render.yaml`) for the backend; GitHub Actions
     (`.github/workflows/deploy-client.yml`) auto-builds/deploys the client to
     GitHub Pages on every push to `main`. Client needs the `API_URL`
     repository variable (Settings → Secrets and variables → Actions →
     **Variables** tab, not Secrets, and not the per-Environment variables
     either — this tripped us up twice) set to the Render URL, or it builds
     with no backend configured.
   - Debugged a Turso "HTTP 400" failure on Render that **wasn't** what it
     looked like — red herrings included suspecting `executeMultiple()` vs
     `batch()` transport differences (disproven by direct testing) before
     finding the real cause: the Turso auth token had simply expired/rotated.
     Fixed by regenerating (ended up creating `pastascout-20` in the process,
     see gotcha above).
   - Migrated real data (16 teams, 2 matches, 3 scouting entries) from local
     SQLite to Turso, and separately re-populated `pastascout-20` after the
     token/database mixup, via the app's own live API (no direct DB access
     needed for that part).
8. **QR offline-transfer fallback**: for a scout with *zero* signal (not just
   spotty), a saved entry can be shown as QR code(s) for an analyst to scan
   phone-to-phone — no network at all. Chunking/reassembly protocol in
   `shared/qrTransfer.ts` (9 tests). **Caught a real bug via direct testing**:
   initial QR render settings (600 chars/chunk, 260px, margin 1) produced
   codes too dense to decode even in a clean synthetic test — fixed to 300
   chars/480px/margin 4 after empirically finding the failure threshold, then
   re-verified a full generate→decode→reassemble→byte-identical round trip.
9. **Analyst password gate**: `ANALYST_PASSWORD` env var (opt-in, unset by
   default) protects the whole Analyst section server-side (real route
   middleware, not just a client-side UI hide) via short-lived in-memory
   session tokens. Scout-facing endpoints are never gated.

## Data incident (resolved, but worth knowing about)

Mid-session, discovered that the real event (`AZGLE1`) had gotten corrupted —
its 2 real matches were overwritten and 62 extra matches from an unrelated
Istanbul Regional test import appeared under the same event key, and the event
name got overwritten to literally "test". This did **not** come from any of
this session's own test scripts (which always used distinct throwaway event
keys like `test2026tuis`/`renderverify`) — most likely it happened from
pasting example/test data into the "Event setup" manual-import form while
`AZGLE1` was still selected as the active event. **Fully restored** — verified
the correct 2 matches, correct event name, and all 3 real scouting entries are
back and correct. Worth being careful about which event key is selected before
pasting example data into that form in the future.

## Environment variables currently in play

`packages/server/.env` (gitignored, not in the repo) has:
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — pointing at `pastascout-20`,
  matches what's set on Render
- `TBA_API_KEY` / `TBA_EVENT_KEY` — **not set** (TBA registration never
  completed — see above)
- `ANALYST_PASSWORD` — **not set** (feature is built and tested, just not
  turned on)

`packages/server/.env.example` documents all of these with no real values —
that's the reference for what to fill in.

## Loose ends / things not done

- **TBA auto-sync never actually configured with a real key** — the feature
  works (tested with a deliberately-wrong token to confirm error handling),
  but nobody's completed TBA registration yet. Manual import is the working
  fallback in the meantime.
- **`ANALYST_PASSWORD` not turned on** — built and tested, just needs the env
  var set on Render (and locally if wanted) to activate.
- **Two GitHub Personal Access Tokens** were generated during this session to
  get past a git-push auth wall (browser-based OAuth wouldn't complete in this
  environment). Both were used once and immediately scrubbed from local git
  config, but they still exist as active tokens on the GitHub account —
  should be revoked at github.com/settings/tokens if not already done.
- **Orphaned `pastascout` Turso database** (the one without `-20`) — unused,
  safe to delete from the Turso dashboard whenever, not urgent.
- **~32 extra team records** with real Istanbul-team names exist in the
  `teams` table from earlier testing — harmless (teams aren't scoped to an
  event in this schema), but could be cleaned up if it's ever confusing.
- Bundle size warning on client build (~590KB JS, mostly from adding
  `jsqr`/`qrcode`) — not fixed, not urgent, code-splitting would be the fix
  if it ever matters.
- A moderate react-router-dom CVE (open redirect) has no fix yet in the 6.x
  line — flagged early on, low real risk for this internal-tool use case.

## Running it locally

```bash
npm install
npm run dev:server   # http://localhost:5174
npm run dev:client   # http://localhost:5173
```

Needs `packages/server/.env` — copy from `.env.example`. Leave the Turso vars
blank to use a local SQLite file instead (fine for local dev; that file isn't
the same data as what's live on Turso unless you explicitly point at it).

```bash
npm run test   # 49 tests, all in packages/shared
```

## Git identity note

This repo's git config has `user.name`/`user.email` set **locally** (not
globally) to `joshiath` — set that way because this machine had no git
identity configured at all when the repo was first initialized here.
