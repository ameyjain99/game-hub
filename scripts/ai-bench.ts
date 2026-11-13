/**
 * AI strength benchmark: seat-alternated matchups between bot policies.
 *
 *   npm run bench:ai -- --a hard --b normal --games 200 [--players 2] [--jobs 8] [--min-win 0.7]
 *
 * Policy A takes one seat, rotating through the seats by seed; every other seat is
 * policy B. A "win" means A's final score beats every B score. Games run in
 * parallel worker threads; seeds 1..games make every run reproducible.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { createGame } from '../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../src/games/ticket-to-ride/engine/reducer';
import { finalScores } from '../src/games/ticket-to-ride/engine/scoring';
import { DEFAULT_BONUSES } from '../src/games/ticket-to-ride/engine/bonuses';
import type { GameState } from '../src/games/ticket-to-ride/engine/types';
import type { Action } from '../src/games/ticket-to-ride/engine/actions';
import { chooseAction } from '../src/games/ticket-to-ride/ai/bot';

type Policy = (state: GameState, playerId: string) => Action;

const POLICIES: Record<string, Policy> = {
  easy: (s, id) => chooseAction(s, id, 'easy'),
  normal: (s, id) => chooseAction(s, id, 'normal'),
  hard: (s, id) => chooseAction(s, id, 'hard'),
};

interface Job {
  a: string;
  b: string;
  players: number;
  seeds: number[];
}

interface GameResult {
  margin: number; // A's score minus the best B score
  timings: number[]; // ms per decision made by A
}

function actor(s: GameState): string {
  if (s.phase === 'setup-tickets') return s.players.find((p) => p.pendingTickets.length > 0)!.id;
  return s.players[s.current].id;
}

function playGame(job: Job, seed: number): GameResult {
  // Odd seeds put A in seat 0, even seeds in seat 1 (2p) — matches the spec's baseline run.
  const aSeat = (seed - 1) % job.players;
  const policyOf = (seat: number) => (seat === aSeat ? job.a : job.b);
  let s = createGame(
    Array.from({ length: job.players }, (_, i) => ({ name: `${policyOf(i)}${i}`, isAI: true })),
    seed,
  );
  const timings: number[] = [];
  for (let moves = 0; s.phase !== 'game-over'; moves++) {
    if (moves > 20000) throw new Error(`seed ${seed}: game did not finish`);
    const id = actor(s);
    const seat = Number(id.slice(1));
    const t0 = performance.now();
    const action = POLICIES[policyOf(seat)](s, id);
    if (seat === aSeat) timings.push(performance.now() - t0);
    s = applyAction(s, action);
  }
  const scores = finalScores(s.players, DEFAULT_BONUSES);
  const bestB = Math.max(...s.players.filter((_, i) => i !== aSeat).map((p) => scores[p.id].total));
  return { margin: scores[`p${aSeat}`].total - bestB, timings };
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback === undefined) throw new Error(`missing --${name}`);
  return fallback;
}

function percentile(sorted: number[], p: number): number {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
}

async function main() {
  const a = arg('a');
  const b = arg('b');
  for (const p of [a, b]) if (!POLICIES[p]) throw new Error(`unknown policy "${p}" (${Object.keys(POLICIES).join(', ')})`);
  const games = Number(arg('games', '200'));
  const players = Number(arg('players', '2'));
  const jobs = Math.max(1, Math.min(games, Number(arg('jobs', String(cpus().length)))));
  const minWin = process.argv.includes('--min-win') ? Number(arg('min-win')) : null;

  const seeds = Array.from({ length: games }, (_, i) => i + 1);
  const chunks = Array.from({ length: jobs }, (_, j) => seeds.filter((_, i) => i % jobs === j));
  const results = (
    await Promise.all(
      chunks.map(
        (chunk) =>
          new Promise<GameResult[]>((resolve, reject) => {
            const job: Job = { a, b, players, seeds: chunk };
            const w = new Worker(new URL(import.meta.url), { workerData: job });
            w.once('message', resolve);
            w.once('error', reject);
          }),
      ),
    )
  ).flat();

  const wins = results.filter((r) => r.margin > 0).length;
  const losses = results.filter((r) => r.margin < 0).length;
  const ties = results.length - wins - losses;
  const avgMargin = results.reduce((s, r) => s + r.margin, 0) / results.length;
  const times = results.flatMap((r) => r.timings).sort((x, y) => x - y);
  const rate = wins / results.length;
  const sign = avgMargin >= 0 ? '+' : '';
  console.log(
    `${a} vs ${b} · ${players}p · ${results.length} games: ` +
      `A wins ${wins} (${(rate * 100).toFixed(1)}%) · losses ${losses} · ties ${ties} · ` +
      `avg margin ${sign}${avgMargin.toFixed(1)} · A decision p50 ${percentile(times, 0.5).toFixed(2)}ms ` +
      `p95 ${percentile(times, 0.95).toFixed(2)}ms`,
  );
  if (minWin !== null && rate < minWin) {
    console.error(`FAIL: win rate ${(rate * 100).toFixed(1)}% < required ${(minWin * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

if (isMainThread) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  const job = workerData as Job;
  parentPort!.postMessage(job.seeds.map((seed) => playGame(job, seed)));
}
