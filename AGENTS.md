# AGENTS.md

Guidance for AI coding agents working in this repository. Applies to any agent or editor that reads this file.

## How to write code here

These are requirements, not preferences.

**Comments.** Write code that explains itself and leave it uncommented. Do not add a comment that restates the line beneath it, do not narrate your reasoning in the source, and do not leave commented-out code or `TODO`s behind — delete dead code instead. The exception is an existing convention: `tic-tac-toe.controller.ts` uses `// ─── section ───` dividers, so match that where it already appears. A comment earns its place only when it records something the code cannot express — a non-obvious constraint, a workaround for a specific bug, or why an odd-looking line is correct.

**Simplicity.** Reach for the smallest thing that works. No speculative abstraction, no parameter nothing varies, no helper that only wraps a single call, no guard against a case that cannot happen. If a function needs a paragraph to justify its shape, the shape is wrong.

**Match the codebase.** This repo has established patterns for nearly everything — see the per-module file convention below. Follow them rather than inventing a parallel structure; naming, file layout, error handling, and controller/service boundaries should look like the code already beside them. Deviating needs a concrete stated reason (a real performance gain, or a correctness bug in the existing pattern), not taste.

**Separation of concerns.** One file, one job. Business logic in services, transport in controllers and routers, validation in `schemas/`, query options in `.query.ts`. When a file starts doing two unrelated things, split it where the second responsibility begins. Prefer pure functions — board in, move out; rows in, rows out — over methods that reach for sockets, Prisma, or module state, because pure code is what can be tested without a server. `tic-tac-toe.service.ts` is the cautionary example: it holds rooms, invites, the waiting queue, win detection, and XP settlement at once. Do not add to it.

**Class-level grouping.** When a file holds several functions that belong to the same subject, put them on a class and export one instance — `botService`, `playerService`, `ticTacToeService` all follow this. Do not export bare module-level functions from a `*.service.ts`, `*.controller.ts`, or a domain helper: a free function cannot hold state, cannot be swapped at a boundary, and invites the file to drift into a grab-bag as it grows. Same for the thing it groups — `bot-identity.ts` exports a factory instance, not a loose `makeNickname()`. The exceptions are type-only exports (`export interface`, `export type`), constants that are genuinely data rather than behaviour (`WIN_LINES`, `BOT_SEED`), and exports Arkos requires by name (`hook: RouteHook`, Zod schemas, gateway controllers). Tests import the instance and call `botService.chooseMove(...)` — destructuring the methods breaks `this`.

## Repo layout

Three independent packages, each with its own `package.json` and `pnpm-lock.yaml`. There is no root workspace file — always `cd` into the package before running anything:

- `backend/` — Arkos.js (Express + Prisma) REST API plus the Tic Tac Toe Socket.IO gateway. SQLite (`file.db`).
- `frontend-react/` — Vite + React 19 client. **This is the maintained frontend.**
- `frontend-js/` — single-file vanilla client, served statically. It still listens for the *old* event names (`game_start`, `move_made`, `game_over`) and is not wired to the current gateway. Treat it as legacy.

## Commands

### backend

```bash
pnpm dev          # arkos dev — tsx-strict --watch on src/server.ts, auto-frees port, restarts on change
pnpm build        # arkos build → .build/
pnpm start        # arkos start (requires a prior build)
npx prisma generate          # regenerate client + .arkos/index.d.ts after schema changes
npx prisma db push           # apply schema changes (dev does NOT run this for you)
npx tsx scripts/add-settings.ts   # one-off data backfill; scripts/ are not wired to npm scripts
npx tsx prisma/seed/bot-player.seed.ts   # top up to 100 bot players (idempotent)
```

`BaseService` subclasses only work inside a booted app — a standalone `npx tsx scripts/foo.ts` that imports `playerService` and calls `findMany` throws `Cannot read properties of null (reading 'player')`, because Arkos's schema parser is not initialised yet. Scripts must use the raw `prisma` client from `src/utils/prisma` instead; `scripts/add-settings.ts` is the pattern to copy. Exercising a service means going through a running server.

`bot-player.seed.ts` is the one exception worth knowing about: it needs password hashes, which are bcrypt cost 12 (`authService.hashPassword`). It imports `authService` directly — that member is a thin `bcrypt.hash` wrapper with no app state, so it works outside a booted app even though the rest of `arkos/services` does not. The seed is idempotent (it counts existing `type: "Bot"` rows and tops up to 100), so re-running is a no-op. Creating all 100 takes ~45s; each bot gets its own random password, none of which are recorded anywhere.

Bot identities are generated by `bot-identity.ts`, shared by the seed and by `playerBotService.createBot()`. **Do not add a second `faker.seed(...)` call.** faker's PRNG is module-global, so a second seeding makes identities depend on module evaluation order and lets the seed and the runtime collide on the same names.

Tests use the Node built-in runner (`node:test`), not Jest/Vitest. There is no `test` script:

```bash
npx tsx --test src/modules/notification-preference/__specs__/notification-preference.service.spec.ts
```

Note: all 5 cases in that spec currently fail — `canNotify` is `async`, but the assertions compare the returned `Promise` directly against a boolean (`assert.strictEqual(result, true)`), so they can never pass. The tests were written before `canNotify` became `async`.

`canNotify` also ignores its array argument: the `preferences = ...` assignment sits *inside* the `typeof preferencesOrUserId === "string"` branch, so when a preferences array is passed (as `start-game-cron.ts` does) `preferences` stays `[]`, `every()` returns `true`, and the function always reports "allowed".

Config `@/*` → backend root, so `@/src/...` and `@/arkos.config` resolve.

### frontend-react

```bash
pnpm dev     # vite
pnpm build   # tsc -b && vite build
pnpm lint    # eslint .
```

### frontend-js

Static only — serve `src/index.html` with any file server (`npx serve src`). Server URL is hardcoded in the file.

## Backend architecture

### Boot sequence

`src/server.ts` is the entry point (`arkos.config.ts` → `source.entryPoint`). It calls `app.build()` on the Arkos app from `src/app.ts`, wraps it in a manual `http.Server`, attaches Socket.IO at path `/api/socket.io`, calls `gateway.register(io)`, then `app.listen(server)`. HTTP and WebSockets therefore share one port — the frontend's `Manager` must use the same `path`.

`src/router.ts` creates the top-level `ArkosRouter` with prefix `/api` and mounts feature routers. `playerRouter` is mounted manually; everything else (`/api/users`, `/api/games`, `/api/auth/*`) is auto-generated by Arkos from the Prisma models, with the module's controller/service supplying the CRUD handlers.

### Per-module file convention

A module in `src/modules/<name>/` can define any of these, and Arkos picks them up by filename:

- `<name>.router.ts` — extra/custom routes. Exports a `hook: RouteHook` object to enable/disable or require auth on the auto-generated CRUD routes (`player.router.ts` uses it to lock down `updateOne` and disable `deleteOne`).
- `<name>.controller.ts` — extends `BaseController`; custom handlers get `(req, res)`.
- `<name>.service.ts` — extends `BaseService<"model">`; this is where business logic and Prisma queries live (`findMany`, `createOne`, `updateOne`, `count` are inherited).
- `<name>.interceptors.ts` — exports arrays named `beforeCreateOne`, `afterFindMany`, `onLoginError`, etc. These are called by Arkos, not imported anywhere.
- `<name>.policy.ts` — `ArkosPolicy("model").rule(...)` permission rules.
- `<name>.query.ts` — `PrismaQueryOptions` for the global and per-action queries. `user.query.ts` uses it to `omit: { password: true }`; `auth.query.ts` `getMe` is what hydrates the `player → settings → notificationPreferences` graph the frontend relies on.
- `schemas/*.schema.ts` — Zod schemas; `validation.resolver` is `"zod"` in `arkos.config.ts`.

Adding a model means adding a `.prisma` file to `prisma/schema/` (multi-file schema) **and** running `prisma generate`.

### Auth

Static mode, login by `email`. The signup Zod schema nests `player: { nickname, apiAction: "create" }` — Prisma creates the `Player` in the same write as the `User`, so signup always produces a player profile. `auth.controller.ts` `beforeSignup` forces `role: "Player"`. The frontend keeps the JWT in `localStorage` and sends it as both `Authorization: Bearer` and (via `WebSocketProvider` options) `auth.token`.

### Game: state lives in memory, games live in the DB

`src/modules/game/services/tic-tac-toe.service.ts` is a **singleton holding all live state** in `Map`s: `rooms`, `invites`, and a single-slot `waiting` queue. Consequences that shape most changes here:

- Everything is single-process. Multiple instances would not share rooms — that's why the gateway is registered with `dedup: false` and `authentication: true` at namespace `/tic-tac-toe` (`src/modules/game/gateways/tic-tac-toe.gateway.ts`).
- Matchmaking is one-slot: the first `join_game` parks in `waiting` and starts two timers — at 10s (`BOT_MATCH_TIMEOUT_MS`) the slot is filled with a bot, at 20s (`WAITING_TIMEOUT_MS`) it emits `waiting_timeout`. A second human joining first cancels both timers and takes the pairing, so a human always wins the race. The 20s timer is unreachable while bots exist; it is kept deliberately as the path that survives deleting the bot timeout.
- Restarting the server drops in-flight games; only finished `Game` rows and `Player` stats survive.

The controller (`controllers/tic-tac-toe.controller.ts`) extends `ArkosGatewayController`; handlers are `(socket, data, ack)` and are registered with `{ event, ack: true }`. `connection` and `disconnect` go through `.hook(...)`.

Two ways a game starts, both funnelling into `startGame()`, which creates the `Game` row, joins both sockets to a `room_<timestamp>` Socket.IO room, and broadcasts `game_state`:

1. **Queue** — `join_game`.
2. **Challenge** — `send_invite` (emails the target if offline via `emailService` + `challenge.email.ts`, gated by notification preferences) → `invite_received` → `accept_invite`. The inviter is always `X`, the accepter `O`.

Per-room `setInterval` enforces a 10s turn timer: on expiry the server flips `currentTurn` and re-broadcasts; 30s of total inactivity triggers `cleanupBySocket` for both players.

On win/draw or disconnect, `finishGame()` writes the `Game.result` and updates both players' `wins`/`losses`/`draws`/`xp` (win 50, draw 15, loss 5 — duplicated as `XP_MAP` in `play.page.tsx`).

### Events the server actually emits

`game_state`, `waiting_timeout`, `invite_received`, `invite_expired`, `invite_declined`, `opponent_left`.

The event table in the root `README.md` is stale (it lists `game_start` / `move_made` / `game_over`, which no longer exist). Each `game_state` payload is the room snapshot plus a hardcoded `counter: 10`.

### Cross-module coupling to know about

`onlineSockets` is a mutable module-level array exported from `tic-tac-toe.controller.ts` and imported by `player.router.ts` to compute `isOnline` for the public player list and `/players/public/online`. Player search/liveness and the gateway are therefore coupled through that one export.

Bots count as online. `playerBotService.findAvailable()` returns every `type: "Bot"` row that is not currently seated in a live room (`ticTacToeService.seatedBotUserIds()`), and `/players/public/online` appends those to the human sockets for both the list and the `count`. A bot therefore leaves the online list the moment it is seated and reappears when the room is deleted. `findOrCreateBot()` reads through the same method, so "available" means one thing everywhere. Note that a bot is only ever "online" by virtue of this rule — it has no socket and never appears in `onlineSockets`.

### Email & cron

Templates live in `src/modules/game/utils/email-templates/` and the copy is **Portuguese** (`welcome`, `challenge`, `invintations`); `challenge.email.ts` hardcodes the production link `https://games.arkosjs.com/play?inviteId=...`. `src/utils/start-cron.ts` currently does nothing — the `startCron()` call is commented out, so the daily reminder cron in `game/utils/start-game-cron.ts` is disabled. User-facing strings elsewhere are a Portuguese/English mix; keep the surrounding language when editing.

## Frontend architecture (frontend-react)

- `utils/contexts/auth.context.tsx` — the single source of truth for `user` + `player`; `refreshPlayer()` re-fetches `/players/me` after games to update XP. `lib/api.ts` is a thin `fetch` wrapper that prefixes `/api` and injects the token.
- `utils/contexts/providers.tsx` — builds a socket.io `Manager` against `VITE_API_URL` (default `http://localhost:8000`), memoized on `player` so it reconnects when the profile changes, and wraps children in `WebSocketProvider`.
- `pages/play/play.page.tsx` — the whole game client. `useGateway("/tic-tac-toe")` + `useEmit(..., { ack: true })` for actions, `game.on(...)` for listeners. Two deliberate quirks to preserve:
  - Listeners are registered during render (not in a `useEffect`), and screen/game state is mirrored into query params (`?gameScreen=`, `?gameState=`, `?inviteId=`) so a hard navigation restores the board. `inviteId` is also what the challenge email link opens, and the page auto-emits `accept_invite` when it sees it.
  - `vite.config.ts` aliases `react`/`react-dom` to the local `node_modules` and excludes `@arkosjs/react-websockets` from `optimizeDeps` — these are required for the arkos WS packages to work, not leftover cruft.
- Styling is CSS modules next to each component; there is no component library.

## Gotchas

- `.arkos/` and `.build/` are generated (and gitignored) — do not hand-edit them, and expect stale types there to be the cause of confusing `BaseService` type errors.
- **Never run `prisma migrate dev`.** There is no `prisma/migrations/` directory — `file.db` was built with `db push`, so `migrate dev` reads every existing index as drift and offers to reset, which drops the database (as of Sept 2026 it holds real users and ~179 game rows). Use `npx prisma db push`, which applies additive changes in place. Copy `file.db` to `file.db.bak` before any schema change.
- `z.nativeEnum(...)` in `update-me.schema.ts` and `z.string().email()` in `signup.schema.ts` are deprecated-but-working in the pinned Zod 4 — fine for now, but they are the first things to break on a future Zod bump.
- `arkos` is pinned to a canary; both packages use `pnpm-workspace.yaml` → `minimumReleaseAgeExclude` to allow those pre-release versions through. Version bumps here need that list updated too.
