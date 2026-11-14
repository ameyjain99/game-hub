import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDictionary, getDictionary, setDictionary } from '../src/games/wordgrid/dictionary';

/** Load Wordgrid's word list from disk once (the built copy in production, the source copy in dev). */
export function ensureDictionary(): void {
  if (getDictionary()) return;
  const file = [resolve(process.cwd(), 'dist/words/enable.txt'), resolve(process.cwd(), 'public/words/enable.txt')].find((f) => existsSync(f));
  if (!file) throw new Error('Wordgrid word list not found');
  setDictionary(buildDictionary(readFileSync(file, 'utf8')));
}
