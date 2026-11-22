import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { BackIcon, Volume2, VolumeX } from '../../../shared/icons';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { useMuted } from '../../../shared/sound';
import { PLAY, soundCues } from './sound';
import { MonopolyBoard } from './MonopolyBoard';
import { megaPick } from './megaPick';
import { MonopolyCenter } from './MonopolyCenter';
import { MonopolySidebar } from './MonopolySidebar';
import { TradeDialog } from './MonopolyTrade';
import { momentLots, useSetMoments } from './SetMoment';
import { RulesButton } from '../../../shared/ui/Rules';
import { SetupButton } from '../../../shared/ui/GameSetup';
import { settingsSummary } from './MonopolyRules';
import { MONOPOLY_RULES } from '../rules';
import { LogLine } from './LogLine';
import { formatMoney, isMega, spaceByName, spaceName } from '../engine/board';
import { BoardContext } from './boardNames';
import { FacesStrip } from '../../../online/ui/SeatFace';
import { Confetti } from '../../../shared/ui/Confetti';
import { fly, flyer, stamp } from '../../../shared/fly';
import { PausedOverlay } from '../../../online/ui/Pause';
import { TableMomentBanner, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { tokenColor } from './board-layout';
import { OpeningCall, useGameStart } from '../../../shared/ui/OpeningCall';

interface Props {
  view: MonopolyState;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (a: Action) => void;
  onExit: () => void;
  exitLabel: string;
  /** Header extras (the online turn clock). */
  headerExtra?: ReactNode;
  /** Shown above the board (e.g. a disconnected-player banner). */
  banner?: ReactNode;
  /** Shown at the top of the sidebar (the online video table); it may spotlight
   *  a player's holdings, as their row does. */
  sideTop?: (onSpotlight: (playerId: string | null) => void) => ReactNode;
}

/** Play the cues each state change makes on this player's screen. */
function useMonopolySounds(view: MonopolyState, meId: string): void {
  const prev = useRef(view);
  useEffect(() => {
    const cues = soundCues(prev.current, view, meId);
    prev.current = view;
    for (const cue of cues) PLAY[cue]();
  }, [view, meId]);
}

/** Rent at or above this is announced to the table. */
const BIG_RENT = 150;

/** The swings of a Monopoly game: jail, a bankruptcy, a hotel going up, a heavy rent. */
export function monopolyMoments(prev: MonopolyState, next: MonopolyState, who: (id: string) => string, colorOf: (id: string) => string): TableMoment[] {
  const out: TableMoment[] = [];
  const verb = (id: string, they: string, you: string) => (who(id) === 'You' ? you : they);
  next.players.forEach((p) => {
    const was = prev.players.find((x) => x.id === p.id);
    if (!was) return;
    if (p.bankrupt && !was.bankrupt) out.push({ kicker: who(p.id), title: `${verb(p.id, 'is', 'are')} bankrupt`, detail: 'Out of the game.', color: '#e2483b', feels: { [p.id]: 'bad' } });
    else if (p.inJail && !was.inJail) out.push({ kicker: who(p.id), title: `${verb(p.id, 'goes', 'go')} to jail`, color: colorOf(p.id), feels: { [p.id]: 'bad' } });
  });
  for (const [id, o] of Object.entries(next.ownership)) {
    const before = prev.ownership[Number(id)]?.houses ?? 0;
    // A hotel going up (not one left behind when a skyscraper is sold), or a skyscraper.
    if (o.owner && ((o.houses === 5 && before < 5) || (o.houses === 6 && before < 6))) {
      out.push({ kicker: who(o.owner), title: `built a ${o.houses === 6 ? 'skyscraper' : 'hotel'} on ${spaceName(Number(id), next.settings.board)}`, color: colorOf(o.owner), feels: { [o.owner]: 'good' } });
    }
  }
  for (const line of next.log.slice(prev.log.length)) {
    const m = line.match(/\{(p\d+)\} paid \$(\d+) rent to \{(p\d+)\}/);
    if (m && Number(m[2]) >= BIG_RENT) {
      out.push({ kicker: who(m[1]), title: `${verb(m[1], 'pays', 'pay')} ${formatMoney(Number(m[2]), next.settings.board)} rent`, detail: `To ${who(m[3]) === 'You' ? 'you' : who(m[3])}.`, color: colorOf(m[3]), feels: { [m[1]]: 'bad', [m[3]]: 'good' } });
    }
  }
  for (const line of next.log.slice(prev.log.length)) {
    const sold = line.match(/\{(p\d+)\} won (.+) at auction for \$(\d+)/);
    if (sold) out.push({ kicker: who(sold[1]), title: `won ${sold[2]} for ${formatMoney(Number(sold[3]), next.settings.board)}`, detail: 'Sold at auction.', color: colorOf(sold[1]), feels: { [sold[1]]: 'good' } });
    const deal = line.match(/\{(p\d+)\} accepted \{(p\d+)\}'s trade/);
    if (deal) out.push({ kicker: `${who(deal[2])} and ${who(deal[1])}`, title: 'made a trade', color: colorOf(deal[2]) });
    const no = line.match(/\{(p\d+)\} turned down the trade/);
    if (no) out.push({ kicker: who(no[1]), title: 'turned the trade down', color: colorOf(no[1]) });
  }
  return out;
}

/**
 * Money changes hands where everyone can see it: rent travels from the payer's
 * token to the owner's, Go pays out at the Go square, and a lot just bought is
 * stamped SOLD while its deed goes to the buyer's row.
 */
function useMoneyInMotion(view: MonopolyState, colorOf: (id: string) => string): void {
  const seen = useRef(view.log.length);
  useEffect(() => {
    const lines = view.log.slice(seen.current);
    seen.current = view.log.length;
    const token = (id: string) => document.querySelector(`[data-token="${id}"]`);
    const cell = (name: string) => {
      const sp = spaceByName(name, view.settings.board);
      return sp ? document.querySelector(`[data-space="${sp.id}"]`) : null;
    };
    // A token is still walking to its square when its line arrives: let it land first.
    const LAND_MS = 900;
    for (const line of lines) {
      const rent = line.match(/\{(p\d+)\} paid \$(\d+) rent to \{(p\d+)\}/);
      if (rent) {
        for (let i = 0; i < 4; i++) fly({ from: token(rent[1]), to: token(rent[3]), delay: LAND_MS + i * 70, ms: 620, make: flyer('mono-coin') });
        fly({ from: token(rent[1]), to: token(rent[3]), delay: LAND_MS, ms: 760, make: flyer('mono-cash-fly', formatMoney(Number(rent[2]), view.settings.board)) });
        continue;
      }
      const go = line.match(/\{(p\d+)\} (?:passed Go and collected|landed right on Go: another) \$(\d+)/);
      if (go) {
        fly({ from: document.querySelector('[data-space="0"]'), to: token(go[1]), delay: LAND_MS, ms: 700, make: flyer('mono-cash-fly is-gain', `+${formatMoney(Number(go[2]), view.settings.board)}`) });
        continue;
      }
      const sale = line.match(/\{(p\d+)\} (?:bought (.+) for|won (.+) at auction for) \$\d+/);
      if (sale) {
        const lot = cell(sale[2] ?? sale[3]);
        const color = colorOf(sale[1]);
        stamp(lot, 'SOLD', 'mono-sold', color, sale[2] ? LAND_MS / 2 : 0);
        fly({ from: lot, to: document.querySelector(`[data-player-row="${sale[1]}"]`), delay: 500, ms: 720, scaleTo: 0.5, make: flyer('mono-deed-fly', undefined, { borderTopColor: color }) });
      }
    }
  }, [view.log]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The full Monopoly screen - header, board with its play area, and sidebar -
 *  shared by local and online games. */
export function MonopolyGame({ view, meId, nameFor, onAction, onExit, exitLabel, headerExtra, banner, sideTop }: Props) {
  const [inspected, setInspected] = useState<number | null>(null);
  // The open trade dialog, and the partner it opened with (from a sidebar row).
  const [trading, setTrading] = useState<{ with?: string } | null>(null);
  // A player whose holdings are lit on the board (from their row, video tile or a lot).
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const { moments, dismiss } = useSetMoments(view);
  const [muted, setMuted] = useMuted();
  useMonopolySounds(view, meId);
  const compact = useMediaQuery('(max-width: 720px)');
  // A wide screen has room beside the board: the log gets its own column there.
  const wide = useMediaQuery('(min-width: 1281px)');
  const colorFor = (id: string) => tokenColor(view.players.findIndex((p) => p.id === id));
  const moment = useTableMoments(view, (a, b) => monopolyMoments(a, b, (id) => (id === meId ? 'You' : nameFor(id)), colorFor));
  useMoneyInMotion(view, colorFor);
  const actor = monopolyActor(view);
  const start = useGameStart(true, view.phase === 'over', view.turns === 0 && view.rollSeq === 0);

  // A new decision for the viewer (or a game event) closes an open deed.
  useEffect(() => setInspected(null), [view.phase, view.pendingPurchase, actor, view.choice?.kind]);

  // Mega: the square the viewer is naming (a triples move, an auction, a Bus Ticket ride).
  const [ticketing, setTicketing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const pick = megaPick(view, meId, ticketing);
  useEffect(() => {
    setTicketing(false);
    setPicked(null);
  }, [view.phase, actor, view.choice?.kind, view.rollSeq]);
  const pickSquare = (id: number) => {
    setInspected(null);
    setPicked(id);
  };
  const confirmPick = () => {
    if (!pick || picked === null || !pick.targets.includes(picked)) return;
    onAction(pick.kind === 'ticket' ? { type: 'USE_TICKET', space: picked } : { type: 'CHOOSE', space: picked });
    setTicketing(false);
    setPicked(null);
  };

  // Escape closes an open deed.
  useEffect(() => {
    if (inspected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspected]);

  // Clicking a lot opens its deed; clicking the same lot again closes it.
  const toggleDeed = (id: number) => setInspected((open) => (open === id ? null : id));

  const center = (part: 'all' | 'head' | 'body') => (
    <MonopolyCenter
      view={view}
      meId={meId}
      onAction={onAction}
      nameFor={nameFor}
      inspected={inspected}
      onCloseInspect={() => setInspected(null)}
      onOpenTrade={() => setTrading({})}
      onExit={onExit}
      moments={moments}
      onDismissMoments={dismiss}
      pick={pick}
      picked={picked}
      onPicked={pickSquare}
      onConfirmPick={confirmPick}
      onTicketing={(on) => {
        setTicketing(on);
        setPicked(null);
        setInspected(null);
      }}
      part={part}
    />
  );

  return (
    <BoardContext.Provider value={view.settings.board}>
    <div className={`mono-game${wide ? ' has-logcol' : ''}`}>
      {view.phase === 'over' && view.winner === meId && <Confetti />}
      <header className="mono-head">
        <button type="button" className="back-link" onClick={onExit}>
          <BackIcon size={16} />
          {exitLabel}
        </button>
        <h1 className="mono-title">Monopoly</h1>
        {view.settings.roundLimit > 0 && view.phase !== 'over' && (
          <span className="mono-round">
            Round {Math.min(view.round, view.settings.roundLimit)} of {view.settings.roundLimit}
          </span>
        )}
        <div className="mono-head-extra">
          {headerExtra}
          <SetupButton lines={settingsSummary(view.settings, true)} />
          <RulesButton rules={MONOPOLY_RULES} variant={isMega(view.settings.board) ? 'mega' : 'standard'} />
          <button
            type="button"
            className="g-icon-btn"
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>
      <OpeningCall start={start} name={actor ? nameFor(actor) : null} isMe={actor === meId} color={actor ? colorFor(actor) : undefined} />
      <main className="mono-stage">
        <FacesStrip colorOf={colorFor} />
        {banner}
        <div className="mono-board-wrap">
          <MonopolyBoard
            view={view}
            nameFor={nameFor}
            actorId={actor}
            onInspect={toggleDeed}
            inspected={inspected}
            spotlight={spotlight}
            onSpotlight={setSpotlight}
            flashIds={momentLots(moments, view.settings.board)}
            targets={pick ? new Set(pick.targets) : undefined}
            picked={picked}
            onPick={pickSquare}
          >
            {center(compact ? 'head' : 'all')}
          </MonopolyBoard>
          <TableMomentBanner moment={moment} place="top" />
          <PausedOverlay />
        </div>
        {compact && center('body')}
      </main>
      <MonopolySidebar
        view={view}
        meId={meId}
        nameFor={nameFor}
        onAction={onAction}
        onInspect={toggleDeed}
        onTradeWith={(id) => setTrading({ with: id })}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        top={sideTop?.(setSpotlight)}
        showLog={!wide}
      />
      {wide && (
        <aside className="mono-logcol" aria-label="Game log">
          <h2 className="mono-side-title">
            Game log
            {view.log.length > 0 && (
              <span className="mono-logcol-count">
                {view.log.length} {view.log.length === 1 ? 'event' : 'events'}
              </span>
            )}
          </h2>
          {view.log.length === 0 ? (
            <p className="mono-logcol-empty">Every roll, purchase and payment is listed here as it happens.</p>
          ) : (
            <ol className="mono-log is-tall">
              {[...view.log].reverse().map((line, i) => (
                <li key={view.log.length - i}>
                  <LogLine line={line} nameFor={nameFor} colorFor={colorFor} />
                </li>
              ))}
            </ol>
          )}
        </aside>
      )}
      {trading && (
        <TradeDialog
          view={view}
          meId={meId}
          onAction={onAction}
          onClose={() => setTrading(null)}
          nameFor={nameFor}
          initialPartner={trading.with}
        />
      )}
    </div>
    </BoardContext.Provider>
  );
}
