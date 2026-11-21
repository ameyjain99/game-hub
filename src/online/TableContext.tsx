import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaChat } from './useMediaChat';
import { playerIdForSeat, type LobbyView, type SeatView } from '../net/protocol';
import { botLine } from '../shared/botNames';

/**
 * "The table": what every part of a game screen may want to know about the
 * people sitting at it, whether the game is local or online. The shared pieces
 * (seat faces, the players panel, the shell, the result card) read it, so a
 * feature like a face at a seat or a paused game needs no wiring per game.
 */
export interface Table {
  /** The viewer's player id. */
  meId: string;
  /** Online: the live call. Null in a local game. */
  media: MediaChat | null;
  /** Online: the human seats' player ids, in seat order. Empty in a local game. */
  humans: string[];
  /** Online: this player's seat in the room (connected, a bot covering). */
  seatOf(id: string): SeatView | undefined;
  isBot(id: string): boolean;
  nameFor(id: string): string;
  /** What each bot is saying right now (a short reaction), by player id. */
  says: ReadonlyMap<string, string>;
  /** Something good or bad just happened to this player: a bot may say a word. */
  react(id: string, feel: 'good' | 'bad'): void;
  /** Online: who paused the game (null while it runs), and the switch. */
  pause: { by: string | null; toggle(): void } | null;
  /** Online: who has asked for a rematch, out of how many needed. */
  rematch: { votes: string[]; needed: number } | null;
  /** Online: when the turn on the clock ends, and how long a full turn is. */
  deadline: number | null;
  /** Online, with a chess clock: the ms each seat has left (null without one). */
  clocks: number[] | null;
}

const TableContext = createContext<Table | null>(null);
export const TableProvider = TableContext.Provider;

/** The table this screen is part of, or null outside a game (a rules sheet, a test). */
export const useTable = (): Table | null => useContext(TableContext);

/** How long a bot's words stay up. */
const SAY_MS = 2600;
/** A bot keeps quiet now and then, so its lines stay a surprise. */
const SAY_CHANCE = 0.75;

interface Options {
  meId: string;
  nameFor: (id: string) => string;
  /** The players as the game knows them (who is a bot). */
  players: readonly { id: string; isAI: boolean }[];
  media?: MediaChat | null;
  lobby?: LobbyView | null;
  onPause?: () => void;
}

/** Builds the table for a game screen: its people, and what the bots say. */
export function useTableState({ meId, nameFor, players, media = null, lobby = null, onPause }: Options): Table {
  const [says, setSays] = useState<ReadonlyMap<string, string>>(new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const held = timers.current;
    return () => held.forEach(clearTimeout);
  }, []);

  const bots = players.filter((p) => p.isAI).map((p) => p.id).join(',');
  const latest = useRef({ nameFor, bots });
  latest.current = { nameFor, bots };

  const react = useCallback((id: string, feel: 'good' | 'bad') => {
    const { nameFor: name, bots: ids } = latest.current;
    if (!ids.split(',').includes(id) || Math.random() > SAY_CHANCE) return;
    const line = botLine(name(id), feel);
    if (!line) return;
    setSays((m) => new Map(m).set(id, line));
    const old = timers.current.get(id);
    if (old) clearTimeout(old);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setSays((m) => {
          const next = new Map(m);
          next.delete(id);
          return next;
        });
      }, SAY_MS),
    );
  }, []);

  return useMemo<Table>(() => {
    const seats = new Map((lobby?.seats ?? []).map((s) => [playerIdForSeat(s.index), s]));
    const live = (lobby?.seats ?? []).filter((s) => !s.isAI && s.name !== null && s.connected);
    return {
      meId,
      media,
      humans: (lobby?.seats ?? []).filter((s) => !s.isAI && s.name !== null).map((s) => playerIdForSeat(s.index)),
      seatOf: (id) => seats.get(id),
      isBot: (id) => bots.split(',').includes(id),
      nameFor,
      says,
      react,
      pause: lobby && onPause ? { by: lobby.paused?.by ?? null, toggle: onPause } : null,
      rematch: lobby?.rematch ? { votes: lobby.rematch, needed: Math.max(1, live.length) } : null,
      deadline: lobby?.turnDeadline ?? null,
      clocks: lobby?.clocks ?? null,
    };
    // `nameFor` changes identity every render; the seats and names it reads come from `lobby`.
  }, [meId, media, lobby, bots, says, react, onPause]); // eslint-disable-line react-hooks/exhaustive-deps
}
