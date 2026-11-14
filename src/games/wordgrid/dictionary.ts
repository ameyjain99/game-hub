/**
 * Wordgrid's dictionary: the ENABLE word list (public domain) as a set for
 * checking words and a compact trie (typed arrays, first-child / next-sibling)
 * for the bot's move search. Loaded once per process – from the network in the
 * browser, from disk on the server – and shared.
 */

export interface Trie {
  /** First child of a node (0 = none). Node 0 is the root. */
  child: Int32Array;
  /** Next sibling of a node (0 = none). */
  sibling: Int32Array;
  /** The letter on the edge into a node (0–25). */
  letter: Uint8Array;
  /** Whether a word ends at a node. */
  end: Uint8Array;
}

export interface Dictionary {
  words: Set<string>;
  trie: Trie;
}

let current: Dictionary | null = null;

/** Build the dictionary from the list's text (one word per line). */
export function buildDictionary(text: string): Dictionary {
  const list = text.split(/\r?\n/).map((w) => w.trim().toUpperCase()).filter((w) => /^[A-Z]{2,15}$/.test(w));
  let cap = 1 << 19;
  let child = new Int32Array(cap);
  let sibling = new Int32Array(cap);
  let letter = new Uint8Array(cap);
  let end = new Uint8Array(cap);
  let size = 1;
  const grow = () => {
    cap *= 2;
    const c = new Int32Array(cap);
    c.set(child);
    child = c;
    const s = new Int32Array(cap);
    s.set(sibling);
    sibling = s;
    const l = new Uint8Array(cap);
    l.set(letter);
    letter = l;
    const e = new Uint8Array(cap);
    e.set(end);
    end = e;
  };
  for (const word of list) {
    let node = 0;
    for (let i = 0; i < word.length; i++) {
      const ch = word.charCodeAt(i) - 65;
      let k = child[node];
      let prev = 0;
      while (k && letter[k] !== ch) {
        prev = k;
        k = sibling[k];
      }
      if (!k) {
        if (size >= cap) grow();
        k = size++;
        letter[k] = ch;
        if (prev) sibling[prev] = k;
        else child[node] = k;
      }
      node = k;
    }
    end[node] = 1;
  }
  return { words: new Set(list), trie: { child, sibling, letter, end } };
}

/** The child of `node` along `ch` (0–25), or 0. */
export function step(t: Trie, node: number, ch: number): number {
  for (let k = t.child[node]; k; k = t.sibling[k]) if (t.letter[k] === ch) return k;
  return 0;
}

export function setDictionary(d: Dictionary): void {
  current = d;
}

export function getDictionary(): Dictionary | null {
  return current;
}

export const isWord = (w: string) => !!current?.words.has(w.toUpperCase());

let loading: Promise<Dictionary> | null = null;

/** Fetch and build the dictionary in the browser (once). */
export function loadDictionary(url = '/words/enable.txt'): Promise<Dictionary> {
  if (current) return Promise.resolve(current);
  loading ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`word list: HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
      const d = buildDictionary(text);
      setDictionary(d);
      return d;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}
