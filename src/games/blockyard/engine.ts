/**
 * Blockyard: a shared building world. There are no turns and no winner – the
 * state is just the world's seed and the blocks people have changed. Anyone at
 * the table may set a block at any time; positions and looks travel separately
 * (see the presence relay), since they change many times a second.
 */
import { IllegalMove, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';
import { BLOCKS, D, H, W, B, coordsOf } from './world';

export interface BuilderPlayer extends KitPlayer {
  color: string;
  placed: number;
  broken: number;
}

export interface BlockyardState {
  players: BuilderPlayer[];
  seed: number;
  /** Block index → block id, for every block changed from the generated world. */
  edits: Record<number, number>;
  editCount: number;
  closed: boolean;
}

export type BlockyardAction = { type: 'SET'; i: number; b: number };

/** Edits a room keeps before it stops accepting more. */
export const MAX_EDITS = 60_000;
export const BUILDER_COLORS = ['#E0393E', '#2F6FDB', '#25A35A', '#F2B90F', '#7C4DBA', '#00897B', '#E8701A', '#C4467F'];

export function createBlockyard(seats: KitSeat[], seed: number, options: { edits?: Record<number, number> } = {}): BlockyardState {
  const players = seats.map((s, i) => ({ id: `p${i}`, name: s.name, isAI: false, color: BUILDER_COLORS[i % BUILDER_COLORS.length], placed: 0, broken: 0 }));
  const edits = options.edits ?? {};
  return { players, seed, edits, editCount: Object.keys(edits).length, closed: false };
}

export function applyBlockyard(s: BlockyardState, action: BlockyardAction | KitCommonAction, actorId: string): BlockyardState {
  if (!s.players.some((p) => p.id === actorId)) throw new IllegalMove('not in this world');
  if (action.type !== 'SET') throw new IllegalMove('unknown action');
  const { i, b } = action;
  if (!Number.isInteger(i) || i < 0 || i >= W * H * D) throw new IllegalMove('out of the world');
  if (!Number.isInteger(b) || b < 0 || b >= BLOCKS.length || b === B.bedrock) throw new IllegalMove('not a block you can place');
  if (b !== 0 && !BLOCKS[b].placeable) throw new IllegalMove('not a block you can place');
  if (coordsOf(i)[1] === 0) throw new IllegalMove("bedrock can't be changed");
  if (s.edits[i] === undefined && s.editCount >= MAX_EDITS) throw new IllegalMove('this world is full');
  const edits = { ...s.edits, [i]: b };
  const players = s.players.map((p) => (p.id === actorId ? { ...p, placed: p.placed + (b ? 1 : 0), broken: p.broken + (b ? 0 : 1) } : p));
  return { ...s, edits, players, editCount: s.edits[i] === undefined ? s.editCount + 1 : s.editCount };
}

export const blockyardKit: GameKit<BlockyardState, BlockyardAction> = {
  seatError: (count) => (count >= 1 && count <= 8 ? null : 'Blockyard is for 1–8 builders'),
  create: (seats, seed, options) => createBlockyard(seats, seed, (options ?? {}) as { edits?: Record<number, number> }),
  apply: applyBlockyard,
  // Nobody waits on anybody: there are no turns.
  actor: () => null,
  players: (s) => s.players,
  isOver: (s) => s.closed,
  bot: () => {
    throw new IllegalMove('Blockyard has no bots');
  },
  timeout: () => {
    throw new IllegalMove('Blockyard has no turns');
  },
  setBot: (s) => s,
  forfeit: (s) => s,
  end: (s) => ({ ...s, closed: true }),
  redact: (s) => s,
  untimed: true,
};
