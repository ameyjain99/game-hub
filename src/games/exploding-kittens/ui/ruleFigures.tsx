/** Exploding Kittens' rule-book pictures, drawn with the game's own cards. */
import type { CSSProperties, ReactNode } from 'react';
import { CARD_NAME, type Kind } from '../engine';
import { EkCard } from './EkCard';

const SIZE = { '--lw': '62px' } as CSSProperties;

const Named = ({ kind, name = CARD_NAME[kind] }: { kind: Kind; name?: string }) => (
  <span className="rf-col">
    <EkCard kind={kind} className="is-small" style={SIZE} />
    <span className="rf-label">{name}</span>
  </span>
);

const Row = ({ children }: { children: ReactNode }) => <div className="rf-row">{children}</div>;

export const KittenAndDefuse = () => (
  <Row>
    <Named kind="exploding" />
    <Named kind="defuse" />
  </Row>
);

export const ActionCards = () => (
  <Row>
    <Named kind="attack" />
    <Named kind="skip" />
    <Named kind="favor" />
    <Named kind="shuffle" />
    <Named kind="future" />
    <Named kind="nope" />
  </Row>
);

export const CatCards = () => (
  <Row>
    <Named kind="tacocat" />
    <Named kind="cattermelon" />
    <Named kind="potato" />
    <Named kind="beard" />
    <Named kind="rainbow" />
  </Row>
);

export const Pair = () => (
  <Row>
    <Named kind="tacocat" />
    <Named kind="tacocat" name="A pair: steal a card" />
  </Row>
);
