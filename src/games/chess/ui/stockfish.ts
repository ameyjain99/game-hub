/**
 * Stockfish 18 (the "lite single-threaded" WASM build, GPL-3.0) in a Web
 * Worker, spoken to over UCI. One engine is shared by every game on the page,
 * and searches are queued so two never overlap.
 */

export interface EngineLevel {
  value: string;
  label: string;
  /** A rating to play at (Stockfish's UCI_Elo); null for full strength. */
  elo: number | null;
  /** Thinking time per move. */
  movetime: number;
}

/** Strongest first: full strength is the default opponent. */
export const ENGINE_LEVELS: EngineLevel[] = [
  { value: 'max', label: 'Stockfish · full strength', elo: null, movetime: 1500 },
  { value: 'master', label: 'Master (≈2400)', elo: 2400, movetime: 1000 },
  { value: 'advanced', label: 'Advanced (≈2000)', elo: 2000, movetime: 800 },
  { value: 'intermediate', label: 'Intermediate (≈1700)', elo: 1700, movetime: 600 },
  { value: 'beginner', label: 'Beginner (≈1350)', elo: 1350, movetime: 400 },
];

export const engineLevel = (value: string | undefined) => ENGINE_LEVELS.find((l) => l.value === value) ?? ENGINE_LEVELS[0];

const ENGINE_URL = '/engine/stockfish-18-lite-single.js';
/** Sent to listeners when the worker errors. */
const FAILED = '\u0000failed';

/** "e7e8q" → its parts. */
export function parseUci(uci: string): { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } {
  const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(promotion ? { promotion } : {}) };
}

class Stockfish {
  private worker: Worker | null = null;
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  readonly ready: Promise<void>;

  constructor() {
    if (typeof Worker === 'undefined') {
      // No workers here (an old browser, a test): callers fall back to a stand-in.
      this.ready = Promise.reject(new Error('Web Workers are unavailable'));
      this.ready.catch(() => undefined);
      return;
    }
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = String(e.data);
      for (const listen of [...this.listeners]) listen(line);
    };
    // A worker that fails to load (a missing file, no WebAssembly) fails every pending call at once.
    this.worker.onerror = () => {
      for (const listen of [...this.listeners]) listen(FAILED);
    };
    this.ready = this.waitFor('uciok', () => this.send('uci'), 30_000)
      .then(() => this.waitFor('readyok', () => this.send('isready'), 30_000))
      .then(() => undefined);
    this.ready.catch(() => undefined);
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(prefix: string, start: () => void, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const listen = (line: string) => {
        if (line === FAILED) {
          clearTimeout(timer);
          this.listeners.delete(listen);
          reject(new Error('Stockfish failed to load'));
          return;
        }
        if (!line.startsWith(prefix)) return;
        clearTimeout(timer);
        this.listeners.delete(listen);
        resolve(line);
      };
      const timer = setTimeout(() => {
        this.listeners.delete(listen);
        reject(new Error(`Stockfish didn't answer "${prefix}" in time`));
      }, timeoutMs);
      this.listeners.add(listen);
      start();
    });
  }

  /** The best move (UCI) after `moves` (UCI, from the start position) at `level`. */
  bestMove(moves: string[], level: EngineLevel): Promise<string> {
    const run = async () => {
      await this.ready;
      if (level.elo) {
        this.send('setoption name UCI_LimitStrength value true');
        this.send(`setoption name UCI_Elo value ${level.elo}`);
      } else {
        this.send('setoption name UCI_LimitStrength value false');
      }
      this.send(`position startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
      const line = await this.waitFor('bestmove', () => this.send(`go movetime ${level.movetime}`), level.movetime + 20_000);
      return line.split(/\s+/)[1];
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

let shared: Stockfish | null = null;

/** The page's engine, started on first use (the download is ~7 MB). */
export function stockfish(): Stockfish {
  shared ??= new Stockfish();
  return shared;
}
