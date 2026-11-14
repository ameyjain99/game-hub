# Game Hub

Board games in the browser, together. Open a room, share a four-letter code (or
a join link), and everyone is at the same table – no accounts, no installs.

| Game | Players | Modes |
|---|---|---|
| **Ticket to Ride** (USA, Europe) | 2–5 | Online, local vs bots, pass-and-play |
| **Monopoly** (classic US board) | 2–6 | Online, local vs bots |
| **Chess** | 2 | Online, local vs Stockfish (five strengths) |
| **Checkers** (American) | 2 | Online, local vs bots |
| **Tic-Tac-Toe** | 2 | Online, local vs bots (one never loses) |
| **Ludo** | 2–4 | Online, local vs bots |
| **Snakes & Ladders** | 2–6 | Online, local vs bots |
| **Lineup** (five-in-a-row with cards and chips) | 2–12, in teams | Online, local vs bots (with a bot partner) |
| **Last Card** (colour-matching card game: Classic and Flip) | 2–10 | Online, local vs bots |
| **Wordgrid** (crossword tile game) | 2–4 | Online, local vs bots |
| **Blockyard** (3D block-building sandbox) | 1–8 | Online (shared world), local (saved in the browser) |
| **Solitaire** (Klondike) | 1 | Draw one or three, undo, hints |
| **Sudoku** | 1 | Four levels, notes, hints |
| **Minesweeper** | 1 | Four levels (Easy 9×9 to Expert 30×24), first click always safe, chording |
| **Cluedo** | 3–6 | Built, switched off on the hub for now |

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
  rooms.ts          RoomStore – game-agnostic rooms, seats, clocks, disconnects
  gameAdapter.ts    the adapter contract
  adapters.ts       Ticket to Ride, Cluedo and Monopoly adapters, and the kit games
  kitAdapter.ts     one adapter for every kit game (bots step one move at a time)
src/
  app/              hub page and top-level routing (/<game>/...)
  games/
    registry.ts     the game catalogue shown on the hub
    ticket-to-ride/ engine · ai · net · ui
    monopoly/       engine · ui
    cluedo/         engine · ui
    kit/            the shared contract, screen, lobby wiring and boards for the
                    newer games (chess, checkers, tic-tac-toe, ludo,
                    snakes-and-ladders, lineup, last-card, wordgrid,
                    blockyard, solitaire, sudoku, minesweeper – each
                    engine.ts + ui/)
  online/           socket session hook, session storage, URL routing,
                    shared online UI (lobby, join gate, turn clock, ...)
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
- **Original games, not clones.** The newer games play in familiar styles but are
  GameHub's own designs with their own names, boards and art: Lineup (its own
  board arrangement), Last Card (its own cards and Flip deck), Wordgrid (its own
  premium-square layout and tile values) and Blockyard (its own world and
  textures, all drawn in code). A licence file covers code, not trademarks:
  names such as Monopoly, Ticket to Ride, Cluedo and Catan belong to their owners.
- **Original names and art.** Monopoly uses generic place names and Cluedo the
  classic character set; no trademarked board art is included.
- **Kit games share one contract.** Chess, Checkers, Tic-Tac-Toe, Ludo,
  Snakes & Ladders and Lineup each implement `GameKit` (`src/games/kit/engine.ts`):
  one server adapter, one local runner and one online wrapper serve them all.
  Their bots act one move at a time on the server too, so everyone watches each
  roll and move.
- **Rule choices.** Checkers follows American/English draughts (compulsory,
  free-choice captures; crowning ends the move; 40 moves each without progress
  is a draw). Ludo plays the common Indian rules (a 6 to leave the yard and roll
  again, three 6s forfeit, captures and arrivals earn a bonus roll, stars and
  starts are safe, no blockades). Snakes & Ladders uses Milton Bradley's 1952
  board, a 6 rolls again, and 100 must be hit exactly (overshoot bounces back).
  Lineup plays like the classic chips-and-cards five-in-a-row games on
  GameHub's own board arrangement, in teams of two or three.
- **Chess plays the computer with Stockfish.** The engine runs in the browser
  as a Web Worker (the 7 MB "lite single-threaded" Stockfish 18 build, GPLv3,
  shipped unmodified in `public/engine/` with its licence); GameHub talks to it
  only over UCI. Rules come from chess.js (BSD-2); the pieces are Colin
  Burnett's set, used under its BSD-3 option (credited in
  `src/games/chess/ui/pieces.ts`). Online chess is between two
  people, untimed; a dropped opponent can be removed, which ends the game.
- **Last Card.** Classic: 108 cards; match colour or symbol; Skip, Reverse, Draw 2,
  Wild and Wild Draw 4 (only with nothing of the colour in hand); draw one and
  you may play it if it fits; call "Last card" at one card or be caught for two;
  going out scores the cards left in everyone's hands. Flip: 112 two-faced cards;
  a Flip card turns the whole table to the dark side (Draw 5, Skip Everyone, and
  a Wild that makes the next player draw until they find the colour); you see the
  other face of everyone else's cards.
- **Wordgrid.** 15×15, 100 tiles (two blanks), racks of seven, words checked
  against ENABLE (public domain, `public/words/`); premiums only under new tiles;
  all seven tiles score 50 more; swap with seven or more in the bag; the game
  ends when someone goes out with the bag empty or after six scoreless turns. The
  bot generates every legal move (anchors, cross-checks and a trie) and picks by
  level.
- **Blockyard.** A 96×40×96 world generated from a seed (hills, beaches, water,
  snow, trees); creative building with a hotbar and a palette of 21 blocks; fly
  mode. A room stores only the seed and the edited blocks; positions travel on a
  separate, throwaway presence relay ten times a second.
- **Cluedo movement is abstracted.** Rooms form a graph (adjacent rooms plus the
  secret passages); one die roll moves you along it. Suggestions, disproving and
  accusations follow the real rules.
- **Monopoly house rules are opt-in toggles.** Defaults follow the official
  rules (auctions on; Free Parking jackpot off).

## Contributing

Contributions are welcome. Every change goes through a pull request and needs
the maintainer's approval before it can merge.

1. **Fork** the repo and create a branch from `main` (`feat/...`, `fix/...`).
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
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `test:`, ...).

### Adding a game

1. Write the engine in `src/games/<game>/engine/`: state, a pure reducer, a
   redaction function, and a bot. Test it headlessly (an all-bot game should
   always finish).
2. Add an adapter in `server/adapters.ts`, including `SKIP_TURN` handling.
3. Build the screens with `useGameRoute`, `GameLanding`, `GameForm` and
   `OnlineLobby`, then list the game in `src/games/registry.ts` and route it in
   `src/app/App.tsx`.

## License

GameHub's own code is released under the [MIT License](LICENSE). Third-party
parts keep their own licences: Stockfish (GPLv3, `public/engine/`, run as a
separate Web Worker), chess.js (BSD-2), three.js (MIT), the Cburnett chess pieces
(BSD-3, `src/games/chess/ui/pieces.ts`), the ENABLE word list (public domain,
`public/words/`) and the Inter font (SIL OFL 1.1).
