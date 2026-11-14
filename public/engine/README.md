# Stockfish engine (third-party)

`stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm` are the
unmodified "lite single-threaded" build of **Stockfish.js 18.0.8**
(npm `stockfish@18.0.8`), by Nathan Rugg and Chess.com, based on Stockfish by
T. Romstad, M. Costalba, J. Kiiski, G. Linscott and contributors.

- Source: https://github.com/nmrugg/stockfish.js (tag v18.0.8) and
  https://github.com/official-stockfish/Stockfish
- License: GNU GPL v3 – see `COPYING.txt` in this folder.

GameHub runs it as a separate Web Worker and talks to it only over the UCI text
protocol, for the "play the computer" mode of Chess.
