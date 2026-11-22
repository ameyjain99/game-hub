/** Monopoly Deal's rule-book pictures, drawn with the game's own cards. */
import type { CSSProperties, ReactNode } from 'react';
import { buildDeck, type ActionKind, type MdCard as Card } from '../engine';
import { MdCard } from './MdCard';

const SIZE = { '--lw': '74px' } as CSSProperties;
const DECK = buildDeck();
const named = (name: string) => DECK.find((c) => c.name === name)!;
const action = (kind: ActionKind) => DECK.find((c) => c.action === kind)!;

const Shown = ({ card, label }: { card: Card; label: string }) => (
  <span className="rf-col">
    <MdCard card={card} style={SIZE} />
    <span className="rf-label">{label}</span>
  </span>
);

const Row = ({ children }: { children: ReactNode }) => <div className="rf-row">{children}</div>;

export const CardTypes = () => (
  <Row>
    <Shown card={named('5M')} label="Money" />
    <Shown card={named('Boardwalk')} label="Property" />
    <Shown card={named('Red / Yellow Wild')} label="Property wild" />
    <Shown card={named('Rent: Pink / Orange')} label="Rent" />
    <Shown card={action('deal-breaker')} label="Action" />
  </Row>
);

export const FullSet = () => (
  <Row>
    <Shown card={named('Oriental Avenue')} label="1 of 3" />
    <Shown card={named('Vermont Avenue')} label="2 of 3" />
    <Shown card={named('Connecticut Avenue')} label="A full set" />
  </Row>
);

export const Answers = () => (
  <Row>
    <Shown card={action('sly-deal')} label="Played against you" />
    <Shown card={action('just-say-no')} label="Your answer" />
  </Row>
);
