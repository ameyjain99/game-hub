/**
 * Rule books: every game's rules as data, in the order a game is played, so
 * one sheet can show any of them. Steps are numbered by section ("3.2") so a
 * rule can be pointed at exactly. Text may mark **key terms** in bold.
 */
import { createContext, type ComponentType } from 'react';

export type RuleItem = string | { text: string; sub: RuleItem[] };

export type RuleBlock =
  /** A paragraph. */
  | { kind: 'p'; text: string }
  /** Numbered steps, done in order. */
  | { kind: 'steps'; items: RuleItem[] }
  /** Points with no order. */
  | { kind: 'list'; items: RuleItem[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  /** A case worth calling out. */
  | { kind: 'note'; text: string }
  /** Words and what they mean here. */
  | { kind: 'terms'; items: [string, string][] }
  /** A picture drawn with the game's own pieces (its cards, tokens, tiles). */
  | { kind: 'figure'; render: ComponentType; caption?: string };

export interface RuleSection {
  title: string;
  blocks: RuleBlock[];
}

export interface RuleBook {
  /** The game in two or three sentences. */
  summary: string;
  sections: RuleSection[];
}

export interface GameRules {
  title: string;
  /** One book per way to play; the first is the default. */
  variants: { id: string; label: string; book: RuleBook }[];
}

export const p = (text: string): RuleBlock => ({ kind: 'p', text });
export const steps = (...items: RuleItem[]): RuleBlock => ({ kind: 'steps', items });
export const list = (...items: RuleItem[]): RuleBlock => ({ kind: 'list', items });
export const table = (head: string[], ...rows: string[][]): RuleBlock => ({ kind: 'table', head, rows });
export const note = (text: string): RuleBlock => ({ kind: 'note', text });
export const terms = (...items: [string, string][]): RuleBlock => ({ kind: 'terms', items });
/** The game's own pieces, shown as they look on screen. */
export const figure = (render: ComponentType, caption?: string): RuleBlock => ({ kind: 'figure', render, caption });
/** A step or point with its own sub-points (lettered a, b, c...). */
export const sub = (text: string, ...items: RuleItem[]): RuleItem => ({ text, sub: items });
export const section = (title: string, ...blocks: RuleBlock[]): RuleSection => ({ title, blocks });

/** The rules a game's screens offer (set by the game's app for its screens). */
export const RulesContext = createContext<{ rules?: GameRules; variant?: string }>({});
