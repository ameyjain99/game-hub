# How a GameHub game is built

The standard every game and every change is held to. Read it before starting
work on a game, and check the work against it before calling it done.

## The mantra

**Aesthetic and feel, and closeness to reality, come first.** A game should look
like a beautiful version of the real thing on a table, feel alive while you
play, and follow the real game's rules exactly. Everything below serves that.

## 1. Every game ships complete

A new game is not done until it has all of this. Nobody should have to ask for
any of it.

| Part | Where |
|---|---|
| Landing page: title, players and time, How to play, room code, Start a game, Play on this device (players, bot level, options) | `KitApp` / `GameLanding` |
| Online room: lobby, seats, bots for empty seats, reconnects, a dropped player handed to a bot | `KitOnline`, `kitAdapter` |
| Local game against bots, with three levels (Easy, Normal, Hard) whose strength is measured to rise in that order | `KitLocal`, `bot.ts` |
| The shared screen: header (back, title, status line, turn clock, rules, mute), the board filling the stage, a sidebar | `GameShell` |
| Video seats for the humans at the table (voice and video, no text chat) | `KitVideos` |
| A players panel; hovering a player spotlights their pieces on the board | `PlayersPanel` |
| Sounds for every meaningful event, and a turn chime | `useCues`, `ui/sound.ts` |
| A log of what happened, in plain sentences, each line in its player's colour | `GameLog` (`GameShell`'s `log`) |
| The plays the whole table should notice, said large over the board | `useTableMoments`, `TableMomentBanner` |
| A result card with the standings and a rematch | `ResultCard` |
| A complete rule book with figures, for every version of the game | `rules.ts`, `ui/ruleFigures.tsx` |
| Hidden information hidden: each player's view is redacted on the server | `redact` |
| Tests: engine rules, bots finishing whole games, the screen, the online room | `tests/` |

Single-player games (Solitaire, Sudoku, Minesweeper) drop what needs other
players: video seats, the players panel, the log. Minecraft, a sandbox, has no
clock and no result.

## 2. Closeness to reality

- **Research the real rules first**: the official rulebook and its variants.
  Note every place where it is silent or ambiguous.
- **Implement the rules exactly**, including the awkward parts: deal order,
  who acts first, ties, running out of cards or pieces, what happens when a
  player leaves.
- **Where the rules leave a gap, decide, and write the decision down** in the
  rule book (so players see it) and in the README's "Decisions worth knowing"
  (so builders see it). Never leave a case undefined.
- **Every version is a real version**: a variant ships with its own rules tab and
  its own measured bots, not as a half-supported flag.
- **The whole game, not a cut-down one**: every card, piece and rule of the
  original ships, the awkward ones included. If something has to wait, say so
  plainly; don't quietly leave it out.
- **A player's choice stays theirs**: where the real game lets a player choose
  (which cards to give up, which town to lose, where a piece goes), the player
  chooses, and is shown what the real game would show them. Never turn a choice
  into a random or automatic pick for convenience; only a choice with a single
  possible answer may make itself.
- **The physical game's feel stays**: dice are rolled and shown, cards are dealt
  and turned, tokens travel between squares, pieces go back to the supply.
- **Games carry the name of the game they play, with original art** (Ticket to
  Ride, Monopoly, Cluedo, Catan with Seafarers and Cities & Knights, Uno,
  Scrabble, Sequence, Minecraft). Names, terms, boards, tile sets and card
  lists follow the original, in what players read and in the code (ids,
  folders, files, type and function names). Only the drawings are GameHub's
  own.

## 3. Aesthetic

- **One look.** The dark palette and spacing come from `src/styles/tokens.css`;
  the type is Inter. Shared pieces (`GameShell`, `PlayingCard`, `Die`,
  `ResultCard`, form fields) are reused, never restyled per game.
- **Each board has its own material**, drawn in code: felt for cards, a wooden
  frame for draughts, sea and terrain for Catan, a mansion floor plan for
  Cluedo. No stock images, no emoji, no clip art. (One known exception: Ticket
  to Ride, the first game, predates the kit and still has its own game screen
  and emoji avatars. Don't copy it; move it onto the kit when it is next
  reworked.)
- **Pieces read on every surface**: a dark outline, a white mark, the player's
  colour. Colours keep their meaning across games (red is danger, gold is a
  highlight, 6 and 8 are red).
- **Icons** come only from `src/shared/icons.ts` (lucide).
- **Nothing ugly survives**: overflowing labels, clipped text, misaligned
  borders, a crowded dock. If it looks off in a screenshot, fix it.

## 4. Layout and placement

- **The board is the hero.** It takes the stage; a square board is the largest
  square that fits.
- **Your own things sit under the board, in a dock**: your hand or cards, the
  dice, and your actions. Everyone's things sit in the sidebar: video seats, the
  players panel, then game panels (scores, the track).
- **The log stands open on the board's left** when the screen is wide enough
  (above 1280px): the space beside the board tells the game's story, newest
  first. On narrower screens it drops under the sidebar.
- **Pieces are big enough to find at a glance.** A token is about half a
  square wide; a marker placed on a map (a station) is larger than a city dot.
- **Prompts that need you float over the board**, as small panels near its
  bottom edge (discard, choose a player, a trade offer), never as a page.
- **Only show what applies.** Hide actions that make no sense now; disable
  (don't hide) ones that apply but can't be afforded, with the cost on the
  button.
- **Phones**: below 1100px the sidebar drops under the board; below 720px
  everything compacts. Check every new screen at 390px wide.
- **No pane is half empty while another is cramped.** Look at every screen at
  1440, 1200 and 390 wide before calling it done. If one side has a tall empty
  space and another has small or truncated things (a tiny hand, cut-off names,
  a grid squeezed into a corner), move or enlarge them. The thing a player
  reads most (a notebook, a hand) gets the most room.
- **Your hand can be sorted.** Any hand of cards or rack of tiles has a sort
  button (`HandSort`), and the order you choose stays yours.

## 4a. The table

A game is played at a table of people, and the shared table features come from
`TableContext` (`useTable()`), not from wiring in each game.

- **Faces sit where the players sit.** In a room, a player's camera (or their
  initial) is at their seat on the board (`SeatFace`); the sidebar strip is the
  fallback on a phone. A reaction, a turn and a win show on that face.
- **Things travel between places.** A card played, chips bet, rent paid, a
  resource produced: it flies from where it was to where it lands (`fly`,
  `flyer`, `stamp` in `shared/fly.ts`). Nothing just appears.
- **The dice are on the board**, where everyone is looking (`BoardDie`), and
  the roller's die starts to tumble on the click.
- **Bots are characters**: a name from `shared/botNames.ts`, never "Bot 2",
  and a short word when something good or bad happens to them (`feels` on a
  table moment).
- **Names are unique in a room** (case and spaces ignored); a second "Sam"
  becomes "Sam (2)".
- **Pieces are chosen in the lobby** where the game has them (a token, a
  colour, a suspect), one each.
- **The lobby shows the rules of this room** to everyone and lets the host
  change them and the number of seats; people can already talk there.
- **Anyone can pause**; a pause stops every clock, holds the bots and says who
  paused. Leaving a game under way asks first.
- **A rematch starts when everyone at the table asks for it**, and shows who has.
- **Open information is open.** A trade, a decision or a card shown is seen by
  the whole table as it happens; only what the rules hide is hidden. What only
  you may know is told to you alone and says so.
- **A timed game shows its clock at the seat** (`SeatTimer` for a turn,
  `GameClock` for a chess clock), not only in the header.
- **The end is counted out**, not just announced: scores add up in front of
  everyone, then the winner gets the confetti.

## 5. Liveliness

- **Something always tells you what is happening**: the status line names whose
  turn it is and what they are doing; a bot "thinking" shows a pulse or dots.
- **Movement is animated**: tokens slide, cards deal and flip, tiles that pay out
  glow, stamps land. Respect `prefers-reduced-motion`.
- **A turning point is an event, not a detail.** A colour chosen, "Last card!"
  called, a player caught, a chip removed, a station built: the board acts it
  out where it happened (the piece drops in or lifts off, under the name of who
  did it) and a table moment says who did what, large, for about two seconds.
  Keep these for turning points; ordinary plays stay quiet, or nothing stands out.
- **Every meaningful event has a sound** (procedural Web Audio, no files), and
  your turn has its chime. One mute covers the whole hub.
- **Hover means something**: hovering a player spotlights their pieces;
  hovering a playable spot lifts it.
- **Bots act at a human pace** (a short pause per move), so you can follow them.

## 6. Decisions

- When a request is clear in intent but open in detail, **decide, build and say
  what you decided**. Don't stop to ask what a sensible default answers.
- Prefer the official rule; then the most widely played house rule; then the
  simplest clear rule. Record which one you chose.
- Measure, don't guess: bot strength, balance and game length are checked by
  playing many bot games.

## 7. Rule books

- Every game has a complete rule book in the app (the book button in the game's
  header, How to play on its landing page), with **one tab per version**.
- **Written after reading the engine**, so it describes exactly what the game
  enforces. No outside PDFs.
- **In playing order**: the goal, the pieces, setup, a turn, special cases,
  scoring, the end, the clock and leaving.
- **Unambiguous**: numbered steps, every case covered, key terms in bold, a
  note wherever GameHub had to decide.
- **Figures from the game's real pieces** (its cards, tokens, tiles) wherever a
  picture explains faster than words.

## 8. Words

- Plain words, short sentences, and the game's own terms used consistently.
- Status lines and the log are grammatical for "You" and for others ("You roll",
  "Bot 2 rolls"), and plurals are right ("1 card", "2 cards").
- **Plain ASCII punctuation**: `-` for ranges and dashes, straight quotes. No en
  or em dashes, curly quotes or minus signs (editors flag them;
  `tests/plainText.test.ts` fails on them). The multiplication sign `×` is kept
  for sizes and counts (8×8, ×2).

## 9. Verify before calling it done

- `npm test` and `npm run build` pass.
- Play it in the browser: a local game against bots at desktop width, and at
  phone width. Look at every screen state you touched.
- Bots of every level finish whole games, and their measured strength rises
  with the level.
- Say plainly what was checked and what was not.
