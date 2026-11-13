import type { CSSProperties } from 'react';
import { notebookFacts } from '../engine/deduction';
import type { RedactedCluedoState } from '../engine/redact';
import { ROOMS, SUSPECTS, WEAPONS, type Card } from '../engine/cards';
import { CheckIcon } from '../../../shared/icons';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';
import { describeReveal } from './revealText';

/**
 * The detective's notebook: a checklist of every card against every player.
 * A tick means you know that player holds the card; a row that's ruled out is
 * struck through; when one candidate is left in a category it's marked solved.
 */
export function CluedoNotebook({
  view,
  nameFor,
}: {
  view: RedactedCluedoState;
  nameFor: (id: string) => string;
}) {
  const facts = notebookFacts(view);
  const possible = new Set<Card>([...facts.stillPossible.suspects, ...facts.stillPossible.weapons, ...facts.stillPossible.rooms]);
  const groups: { title: string; cards: readonly Card[]; left: number }[] = [
    { title: 'Suspects', cards: SUSPECTS, left: facts.stillPossible.suspects.length },
    { title: 'Weapons', cards: WEAPONS, left: facts.stillPossible.weapons.length },
    { title: 'Rooms', cards: ROOMS, left: facts.stillPossible.rooms.length },
  ];

  return (
    <section className="cl-notebook" aria-label="Detective's notebook">
      <h2 className="cl-side-title">Detective's notebook</h2>
      <table className="cl-grid">
        <thead>
          <tr>
            <th scope="col" className="cl-grid-card">
              <span className="cl-sr">Card</span>
            </th>
            {view.players.map((p) => (
              <th key={p.id} scope="col" title={`${nameFor(p.id)} (${p.suspect})`}>
                <span className="cl-grid-who" style={{ '--tc': SUSPECT_COLOR[p.suspect], color: inkOn(p.suspect) } as CSSProperties}>
                  {suspectInitial(p.suspect)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.title}>
            <tr className="cl-grid-group">
              <th scope="rowgroup" colSpan={view.players.length + 1}>
                {g.title}
                <span>{g.left} left</span>
              </th>
            </tr>
            {g.cards.map((card) => {
              const ruledOut = !possible.has(card);
              const solved = !ruledOut && g.left === 1;
              return (
                <tr key={card} className={`${ruledOut ? 'is-out' : ''}${solved ? ' is-solved' : ''}`}>
                  <th scope="row" className="cl-grid-card">
                    {card}
                  </th>
                  {view.players.map((p) => (
                    <td key={p.id}>{facts.knownByPlayer[p.id]?.includes(card) && <CheckIcon size={13} aria-label="holds" />}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>

      {view.history.length > 0 && (
        <details className="cl-log">
          <summary>Case log · {view.history.length}</summary>
          <ol>
            {[...view.history].reverse().map((r, i) => {
              const d = describeReveal(r, view.you, nameFor);
              return (
                <li key={view.history.length - i}>
                  {d.suggestion} <span>{d.outcome}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}
