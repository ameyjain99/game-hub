import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BOARD, groupIds, type ColorGroup } from '../engine/board';
import type { MonopolyState } from '../engine/state';
import { completedSets } from '../engine/selectors';
import { CloseIcon, Crown } from '../../../shared/icons';
import { GROUP_LABEL, tokenColor } from './board-layout';

/** How long a set-complete note stays up (it can be closed sooner). */
const MOMENT_MS = 6000;

export interface SetMoment {
  group: ColorGroup;
  owner: string;
}

/**
 * Colour sets completed since the screen opened (by a purchase, an auction or
 * a trade), held for a few seconds so the table notices. Sets already complete
 * when the screen opens aren't announced.
 */
export function useSetMoments(view: MonopolyState): { moments: SetMoment[]; dismiss: () => void } {
  const before = useRef(new Map(completedSets(view).map((s) => [s.group, s.owner])));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moments, setMoments] = useState<SetMoment[]>([]);
  const signature = completedSets(view)
    .map((s) => `${s.group}:${s.owner}`)
    .join('|');

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const now = new Map(completedSets(view).map((s) => [s.group, s.owner]));
    const fresh = [...now].filter(([group, owner]) => before.current.get(group) !== owner);
    before.current = now;
    if (fresh.length === 0) return;
    setMoments(fresh.map(([group, owner]) => ({ group, owner })));
    // The newest moment owns the timer; a later change never strands it on screen.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoments([]), MOMENT_MS);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return { moments, dismiss: () => setMoments([]) };
}

/** Every lot of the sets being announced (they flash on the board). */
export function momentLots(moments: SetMoment[]): Set<number> {
  return new Set(moments.flatMap((m) => groupIds(m.group)));
}

/** The note for a completed set: who owns it, and what that unlocks now –
 *  stated from the game's actual rules. */
export function SetMomentNote({
  moment,
  view,
  meId,
  nameFor,
  onClose,
}: {
  moment: SetMoment;
  view: MonopolyState;
  meId: string;
  nameFor: (id: string) => string;
  onClose: () => void;
}) {
  const lots = groupIds(moment.group);
  const houseCost = BOARD[lots[0]].houseCost!;
  const mortgaged = lots.some((id) => view.ownership[id].mortgaged);
  const who = moment.owner === meId ? 'You have' : `${nameFor(moment.owner)} has`;
  const color = tokenColor(view.players.findIndex((p) => p.id === moment.owner));
  return (
    <div className="mono-moment" role="status" aria-label="Set complete" style={{ '--oc': color } as CSSProperties}>
      <div className="mono-moment-head">
        <Crown size={15} />
        <span className="mono-moment-kicker">Set complete</span>
        <button type="button" className="mono-drawn-close" aria-label="Close" onClick={onClose}>
          <CloseIcon size={14} />
        </button>
      </div>
      <p className="mono-moment-title">
        {who} every {GROUP_LABEL[moment.group]} lot
      </p>
      <ul className="mono-moment-list">
        {view.settings.doubleRentFullSet && <li>Rent doubles on its unbuilt lots</li>}
        <li>
          {mortgaged ? 'Once its mortgages are paid off, houses' : 'Houses'} can go up (${houseCost} each
          {view.settings.evenBuild ? ', evenly across the set' : ''}); a hotel after 4
        </li>
      </ul>
    </div>
  );
}
