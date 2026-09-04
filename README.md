# FRC Scouting App — REBUILT (2026)

A scouting app for FRC teams: match scouting (with an autonomous path mapper), pit
scouting, in-house OPR/EPA calculation, a blended team ranking, a pick list, and
TBA schedule/results import. Scouts use it from phones in the stands; it works fully
offline and syncs automatically when connected. Analysts use the same app from a
laptop for the dashboard.

## Project layout

```
packages/
  shared/   REBUILT game config, shared types (Zod schemas), OPR/EPA math (unit tested)
  server/   Express API + SQLite (via Node's built-in node:sqlite — no native build tools needed)
  client/   React + Vite PWA — one app, gated by a role picker (Scout vs Analyst)
```

## Prerequisites

- Node.js 22+ (built-in `node:sqlite` is used instead of a native SQLite binding, so
  no Python/Visual Studio Build Tools are required).

## Setup

```bash
npm install
```

## Running it
go to https://twhs-pastabots.github.io/Pastascout/ 

Two dev servers, in separate terminals:

```bash
npm run dev:server   # API on http://localhost:5174
npm run dev:client   # app on http://localhost:5173
```

Open `http://localhost:5173`. On first run, `packages/server/data/scouting.db` is
created automatically.

## Running at a competition (local, no internet)

1. On the laptop that will act as the server, run both `npm run dev:server` and
   `npm run dev:client` (or `npm run build` + serve the built client — see below).
2. Connect the laptop and scouts' phones to the same wifi (a phone hotspot with no
   internet works fine — nothing here needs a real internet connection).
3. As an analyst, open the app → **Analyst** → **Join (QR)** tab. Scan the QR code
   or type the shown URL into each scout's phone browser.
4. Each scout picks **I'm scouting**, enters their name, and starts submitting
   entries — even if their phone briefly loses wifi, entries queue locally
   (IndexedDB) and sync automatically once reconnected.

## Offline QR backup (when a scout's phone has no signal at all)

The normal offline story — save locally, sync when reconnected — assumes the
phone *eventually* gets a connection. At a venue with genuinely no wifi/data
reaching a scout's corner of the stands, that might not happen until the event's
over. As a fallback, a saved entry can be relayed **phone-to-phone with no
network involved at all**:

1. After saving a match or pit entry, the scout taps **"📱 No signal? Show QR
   backup"** — this shows the entry as one or more QR codes (large entries split
   across several, auto-advancing).
2. An analyst opens **Analysis → Receive via QR** and scans them with their
   phone's camera.
3. Each completed scan queues on the *analyst's* device and syncs to the server
   the normal way — so it only needs connectivity to reach *someone*, not
   specifically the scout who collected the data.

This is a fast-path, not the authoritative copy — the scout's own phone still
syncs the full entry normally once it reconnects, which just overwrites the
QR-relayed version in place (both carry the same entry id). Photos on pit
scouting entries are left out of the QR payload — even one compressed photo is
far too large to fit in a scannable code — and sync over the network only, same
as always.

## Password-protecting the Analyst section

By default, anyone who opens the app can see the dashboard, rankings, and pick
list — fine for a private deployment, less fine if you're worried about
opposing teams (or randoms) poking around at a competition. Set one env var in
`packages/server/.env` (see `.env.example`) and every device has to enter a
shared password once before the Analyst section loads at all:

```
ANALYST_PASSWORD=whatever-your-team-wants
```

Leave it blank and nothing changes — this is opt-in, same pattern as the Turso
and TBA config. It's one shared password for the whole team, not individual
accounts, and it only gates the Analyst side — scouts never see a login prompt
at all, since match/pit scouting submission has to keep working with zero
friction.

## Running from the cloud (between events)

Deploy `packages/server` and `packages/client` (static build) to any host — the
client's **Settings** screen lets you point it at either a local laptop IP or a
cloud URL; nothing else changes.

```bash
npm run build   # builds shared, server (dist/), and client (dist/)
```

### Persistent storage in the cloud: Turso

The server normally stores everything in a local SQLite file
(`packages/server/data/scouting.db`). That's perfect for a laptop at a
competition, but most free/cheap cloud hosts (Render, Railway, Fly.io) don't
guarantee that local disk survives a restart or redeploy — so a cloud-hosted
server needs a database that lives outside the host itself.

Set these two in `packages/server/.env` (see `.env.example`) and the server
automatically switches to a hosted [Turso](https://turso.tech) database instead
of the local file — no code changes needed:

```
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-token
```

Create the database from Turso's dashboard (no CLI needed — their official CLI
requires WSL on Windows). Leave both blank to keep using the local file, which
is still the right choice for the laptop-at-a-competition setup.

**This is a hard switch, not a merge** — with Turso configured, the server reads
and writes only Turso; the local file (and whatever's already in it) is
untouched but no longer used. If you have real data in the local file you want
to keep, it needs to be copied over explicitly rather than assumed to carry
over automatically.

## Getting around the app

The ☰ button in the top-left opens a menu listing every section:

- **Scouting** — Match scouting, Pit scouting
- **Analysis** — Team stats, Pick list, Event setup, Join (QR), Receive via QR
- **App** — Settings, Switch role

The menu shows all sections regardless of which role you're in. Picking a page
from the other role switches you to it automatically rather than bouncing you to
the home screen — handy when one laptop is doing both jobs. (Choosing a scouting
page with no scout name set sends you to the home screen to enter one, since
entries are attributed to a scout.)

Closes with Escape, the × button, or tapping outside.

## Getting event data in

There are two ways, and you only need one.

### Option A — automatic Blue Alliance sync (recommended)

TBA requires an API key on *every* request, so no app can pull from it with no key
at all. But the key only has to be set up **once, by one person** — after that
everyone else just opens the site and the event is already loaded, kept fresh
automatically.

1. Someone who can sign in with Google gets a free read key at
   [thebluealliance.com/account](https://www.thebluealliance.com/account) →
   "Read API Keys". (Sign-in is Google-only. If a school Google account is blocked
   from third-party sign-in, a personal Gmail works.)
2. Copy `packages/server/.env.example` → `packages/server/.env` and fill in
   `TBA_API_KEY` and `TBA_EVENT_KEY` (e.g. `2026caav`, from the event's TBA URL).
3. Restart the server.

It then pulls the schedule, teams, and results on startup and every few minutes.
**Analyst → TBA import** shows a green panel with last-sync time and a
"Refresh now" button. `.env` is gitignored, so the key stays on that machine.

If the internet drops mid-event, syncing just retries — whatever was pulled last
is still in the local DB and still served to every phone.

### Option B — manual setup, no key or account needed

In **Analyst → TBA import**, use the "Set up an event manually" panel. Paste the
match schedule in the form:

```
1, 254, 1114, 118, 971, 2056, 148
2, 971, 254, 148, 1114, 118, 2056
```

Comma, tab, or space separated; a header row is fine; `frc254` works as well as
`254`. Bad rows are reported by line number instead of failing the whole paste.
Team names are optional. `POST /api/manual/results` records official scores so
OPR/EPA still work with no TBA at all.

## The auton path mapper

Scouts **draw** the robot's auton route by dragging across the field, rather than
tapping individual points — during a 20-second auton there isn't time for
anything else. Three modes:

- **Set start** — one tap drops a green `S` where the robot lined up, then
  switches to draw mode automatically.
- **Draw path** — each drag adds one line. "Undo line" removes the last one.
- **Add marker** — tap to drop a labeled marker (pickup / score / crossObstacle).

Strokes are thinned with Ramer–Douglas–Peucker before being stored, so a finger
drag that emits hundreds of raw points is saved as only the points that define
its shape (a straight line collapses to 2). That keeps entries small for syncing
over flaky venue wifi. Each point keeps its timestamp for later replay.

The **Flip view** button rotates the field 180° for scouts sitting on the opposite
alliance side. It's purely visual — coordinates are always stored in one
canonical orientation, so paths from red-side and blue-side scouts stay
comparable.

### The field image

The mapper uses `packages/client/public/field-2026.webp` (2000×977). Replace
that file to change the field art — the viewBox matches its aspect ratio. If
the file is missing, the mapper falls back to a drawn approximation so it
still works.

Start position, strokes, and markers are all stored as normalized 0–1
coordinates, so **swapping the field image never invalidates scouting data you've
already collected**.

## Suggested pick list

**Analysis → Pick list** generates a ranked suggestion list. Enter your own team
number once (it's stored server-side, so every analyst laptop shares it) and pick
a strategy:

| Strategy | What it optimizes for |
| --- | --- |
| **Best overall** | Raw contribution and reliability — the strongest robots available. |
| **Fits our style** | Robots strong in the areas *you're* weak in (climb, defense, auton, shuttling, fuel). |
| **More of us** | Robots that play the game the way you do — for doubling down on a strategy. |
| **Defensive partner** | Strong defenders over strong scorers. |

Every suggestion shows **why** it was picked ("Covers your gap in endgame
climbing", "Wins auton 100% of the time") and warns about risks ("Broke down in
60% of scouted matches", "Only 1 match scouted") so the strategy team can judge
the recommendation rather than trust it blindly. Tapping a suggestion adds it to
the shared pick list and removes it from the suggestions.

The score blends four things: contribution, fit against your profile,
reliability (breakdown rate), and consistency (how much their fuel output varies
match to match).

**Before official results exist**, EPA and OPR are all zero — so suggestions fall
back to ranking on your own scouts' recorded output instead. That means the
feature works from the very first match, but expect rankings to sharpen once real
match results are imported.

## Notes on the stats

- **OPR** is the classic least-squares method against official TBA alliance scores.
- **EPA** is our own simplified, recency-weighted rolling estimate seeded from OPR —
  it's *EPA-inspired*, not a reproduction of Statbotics' algorithm.
- Fuel counts, tower climbs, and skill ratings (defense, shuttling, etc.) come from
  your own scouts' match entries, averaged per team. Skill categories are
  configurable in `packages/shared/src/gameConfig.ts`.

## Testing

```bash
npm run test   # OPR/EPA/blended-rank unit tests (packages/shared)
```
