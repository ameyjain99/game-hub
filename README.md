# Game Hub

Board games in the browser, together. Open a room, share a four-letter code (or
a join link), and everyone is at the same table — no accounts, no installs.

| Game | Players | Modes |
|---|---|---|
| **Ticket to Ride** (USA, Europe) | 2–5 | Online, local vs bots, pass-and-play |
| **Monopoly** (classic US board) | 2–6 | Online, local vs bots |
| **Cluedo** | 3–6 | Online (with video tiles), local vs bots |

Every game has bots at several difficulty levels, so a table can always be
filled, and a player who drops can be handed to a bot without stopping play.

## Quick start

Requires **Node 22.12+**.

```bash
npm install
npm run dev        # client on http://localhost:5173, game server on :3001
npm test           # the full test suite
```

`npm run dev` starts both the Vite client and the Node game server; the client
proxies `/socket.io` and `/api` to the server.

## Design principles

1. **Rules are pure functions.** Each game's engine is a deterministic reducer:
   `applyAction(state, action) → state`, with all randomness drawn from a seed
   stored in the state. The same seed and actions always replay the same game,
   which makes engines easy to test and safe to run on the server.
2. **The server is the authority.** In online play clients only *send actions*.
   The server validates them through the engine and sends each player a
   *redacted* view: hidden information (other hands, deck order, the Cluedo
   envelope) never leaves the server.
3. **One online layer for every game.** Rooms, seats, reconnects, turn clocks
   and bot takeover are written once; a game plugs in through a small adapter.
4. **One look.** Screens are built from a shared shell and a small set of design
   tokens (spacing, radii, lines), not one-off styling.
5. **Tests first.** New rules and fixes land with tests; the suite must stay green.

## Architecture

```
 browser (React + Vite)                         Node server (one process)
 ─────────────────────                          ─────────────────────────
 game UI ── dispatch(action) ──── socket.io ───▶ RoomStore
   ▲                                              │  seats · codes · reconnect tokens
   │                                              │  turn clocks · disconnects
   └──── redacted state per player ◀──────────────┤
                                                  ▼
                                            GameAdapter (one per game)
                                                  │  validate · apply · bots · redact
                                                  ▼
                                            pure game engine (shared with the client)
```

- **Engines** (`src/games/<game>/engine/`) are framework-free TypeScript, used by
  the server for online play and directly by the client for local games.
- **`GameAdapter`** (`server/gameAdapter.ts`, implementations in
  `server/adapters.ts`) is the only game-specific code on the server:
  `createGame`, `applyAction`, `replaceWithAi`, `removeSeat`, `endGame`,
  `turnActorId` and `redactFor`. An adapter can also set its turn length and
  whether acting refreshes the clock.
- **Turn clocks.** When a human's clock runs out the room sends
  `{ type: 'SKIP_TURN' }` as that player; each adapter plays the idle player's
  part conservatively (e.g. decline a purchase, pass an auction) so a stalled
  player never freezes the table. A room with no connected humans ends itself.
- **Bots** run on the server straight after each action until a human must act.
- **Sessions.** A browser keeps a reconnect token per room in `localStorage`, so
  a refresh reclaims the same seat. Sessions are scoped per game.

## Code structure

```
server/
  index.ts          HTTP + socket.io entry; serves the built client in production
  rooms.ts          RoomStore — game-agnostic rooms, seats, clocks, disconnects
  gameAdapter.ts    the adapter contract
  adapters.ts       Ticket to Ride, Cluedo and Monopoly adapters
src/
  app/              hub page and top-level routing (/<game>/…)
  games/
    registry.ts     the game catalogue shown on the hub
    ticket-to-ride/ engine · ai · net · ui
    monopoly/       engine · ui
    cluedo/         engine · ui
  online/           socket session hook, session storage, URL routing,
                    shared online UI (lobby, join gate, turn clock, …)
  net/protocol.ts   socket event names and payload types
  shared/           seeded RNG, icons, loader, shared UI (landing, form)
  styles/           tokens.css → base → shared → game-ui → per-game CSS
tests/              mirrors src/ and server/ (Vitest + Testing Library)
scripts/ai-bench.ts Ticket to Ride bot strength benchmark
```

Each game's URL steps are `/<game>` (landing), `/<game>/create`,
`/<game>/join?room=CODE`, `/<game>/<CODE>` (a live room) and `/<game>/play`
(local game), so every screen is linkable and survives a refresh.

## Deployment

The app ships as **one Node process** that serves the built client, the small
JSON API (`/api/room-exists`) and socket.io from the same origin.

```bash
npm run build && npm run build:server   # dist/ (client) + dist-server/ (server)
npm start                               # PORT defaults to 3001
```

- **Docker:** the included `Dockerfile` builds a slim Node 22 image listening on
  `PORT=8080`. It runs on any container host.
- **Render:** `render.yaml` is a ready blueprint for Render's free tier.
- **Run exactly one instance.** Rooms live in memory, so instances can't share
  them and a restart ends games in progress. Scaling out would need shared room
  storage and sticky sessions first.
- **Rulebooks** (PDF links in Ticket to Ride) load from object storage; set
  `VITE_RULES_BASE` at build time to change the host (see `.env.example`).

## Decisions worth knowing

- **No accounts.** Short room codes plus a per-room reconnect token keep joining
  friction-free; nothing persists beyond a running game.
- **In-memory, single instance.** Simplest thing that works for game nights;
  see Deployment for the trade-off.
- **Original names and art.** Monopoly uses generic place names and Cluedo the
  classic character set; no trademarked board art is included.
- **Cluedo movement is abstracted.** Rooms form a graph (adjacent rooms plus the
  secret passages); one die roll moves you along it. Suggestions, disproving and
  accusations follow the real rules.
- **Monopoly house rules are opt-in toggles.** Defaults follow the official
  rules (auctions on; Free Parking jackpot off).

## Contributing

Contributions are welcome. Every change goes through a pull request and needs
the maintainer's approval before it can merge.

1. **Fork** the repo and create a branch from `main` (`feat/…`, `fix/…`).
2. **Make the change with tests.** Put tests next to the matching folder under
   `tests/`. For a bug, write a failing test first.
3. **Check locally:** `npm test` and `npm run build` (the build also typechecks).
4. **Open a pull request** against `main` explaining *what* changed and *why*.
   Keep it focused; one concern per PR.

Conventions:

- Icons come only from `src/shared/icons.ts` (lucide); don't import
  `lucide-react` anywhere else.
- Style with the tokens in `src/styles/tokens.css` and the shared classes in
  `game-ui.css` rather than new magic numbers.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `test:`, …).

### Adding a game

1. Write the engine in `src/games/<game>/engine/`: state, a pure reducer, a
   redaction function, and a bot. Test it headlessly (an all-bot game should
   always finish).
2. Add an adapter in `server/adapters.ts`, including `SKIP_TURN` handling.
3. Build the screens with `useGameRoute`, `GameLanding`, `GameForm` and
   `OnlineLobby`, then list the game in `src/games/registry.ts` and route it in
   `src/app/App.tsx`.
