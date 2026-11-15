/** Poker's rule-book pictures, drawn with the table's own playing cards. */
import type { CSSProperties } from 'react';
import { PlayingCard } from '../../kit/ui/PlayingCard';

const SIZE = { '--pc-w': '40px' } as CSSProperties;

function Cards({ cards, down = [] }: { cards: string; down?: number[] }) {
  return (
    <span className="rf-row" style={{ gap: 4 }}>
      {cards.split(' ').map((c, i) => (
        <PlayingCard key={i} card={c} faceDown={down.includes(i)} style={SIZE} />
      ))}
    </span>
  );
}

function Ranked({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rf-grid">
      {rows.map(([name, cards], i) => (
        <div key={name} className="rf-rank">
          <b>{i + 1}</b>
          <span>{name}</span>
          <Cards cards={cards} />
        </div>
      ))}
    </div>
  );
}

const HIGH: [string, string][] = [
  ['Straight flush', '9H TH JH QH KH'],
  ['Four of a kind', '7S 7H 7D 7C KS'],
  ['Full house', 'QS QH QD 4C 4S'],
  ['Flush', '2H 6H 9H JH KH'],
  ['Straight', '5S 6H 7D 8C 9S'],
  ['Three of a kind', '8S 8H 8D KC 2S'],
  ['Two pair', 'JS JH 4D 4C AS'],
  ['One pair', 'TS TH KD 7C 3S'],
  ['High card', 'AS JH 9D 6C 2S'],
];

export const HighRanks = () => <Ranked rows={HIGH} />;

export const ShortRanks = () => (
  <Ranked
    rows={[
      ['Straight flush', '9H TH JH QH KH'],
      ['Four of a kind', '7S 7H 7D 7C KS'],
      ['Flush', '6H 9H JH QH KH'],
      ['Full house', 'QS QH QD 6C 6S'],
      ['Three of a kind', '8S 8H 8D KC 6S'],
      ['Straight (ace low)', 'AS 6H 7D 8C 9S'],
      ['Two pair', 'JS JH 7D 7C AS'],
      ['One pair', 'TS TH KD 7C 6S'],
      ['High card', 'AS JH 9D 7C 6S'],
    ]}
  />
);

export const LowRanks = () => (
  <Ranked
    rows={[
      ['5-4-3-2-A, the best', 'AS 2H 3D 4C 5S'],
      ['8-7-4-2-A', 'AH 2C 4S 7D 8H'],
      ['9-4-3-2-A', 'AD 2S 3H 4D 9C'],
      ['A pair: worse than any of those', 'AC AH 3S 5D 7H'],
    ]}
  />
);

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="rf-col">
      {children}
      <span className="rf-label">{label}</span>
    </span>
  );
}

export const HoldemDeal = () => (
  <>
    <Labelled label="Your two cards">
      <Cards cards="AH KH" />
    </Labelled>
    <Labelled label="Flop · turn · river (shared)">
      <Cards cards="QH JH 2C 7D TH" />
    </Labelled>
  </>
);

export const ShortDeal = () => (
  <>
    <Labelled label="Your two cards">
      <Cards cards="AH KH" />
    </Labelled>
    <Labelled label="Five shared cards (no 2 to 5 in the deck)">
      <Cards cards="QH JH 6C 7D TH" />
    </Labelled>
  </>
);

export const OmahaDeal = () => (
  <>
    <Labelled label="Your four cards: use exactly two">
      <Cards cards="AS KS 9D 9C" />
    </Labelled>
    <Labelled label="Five shared cards: use exactly three">
      <Cards cards="QS JS 2H 7D 3C" />
    </Labelled>
  </>
);

export const StudDeal = () => (
  <>
    <Labelled label="3rd street: two down, one up">
      <Cards cards="KS 4H 9D" down={[0, 1]} />
    </Labelled>
    <Labelled label="4th to 6th: one up each">
      <Cards cards="9C 2S 7H" />
    </Labelled>
    <Labelled label="7th: one down">
      <Cards cards="JC" down={[0]} />
    </Labelled>
  </>
);
