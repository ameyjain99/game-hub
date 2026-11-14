import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../../../shared/useMediaQuery';

/** Which of the 3×3 pip slots are filled for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** How long a roll tumbles, and how often its faces change while it does. */
const TUMBLE_MS = 560;
const FACE_MS = 70;
const randomFace = () => 1 + Math.floor(Math.random() * 6);

function Die({ value }: { value: number }) {
  return (
    <span className="mono-die" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value]?.includes(i) ? 'is-pip' : undefined} />
      ))}
    </span>
  );
}

/**
 * The last roll as two real dice faces (blank before the first roll). A new
 * roll — a change of `rollKey` — tumbles through random faces before settling;
 * the accessible label always states the real result.
 */
export function Dice({ values, rollKey = 0 }: { values: [number, number] | null; rollKey?: number }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [tumble, setTumble] = useState<[number, number] | null>(null);
  const shownKey = useRef(rollKey);
  const hasRoll = values !== null;

  // Keyed on the roll alone: any cleanup (a newer roll, unmount) also stops the
  // tumble, so it can never be left showing random faces.
  useEffect(() => {
    if (rollKey === shownKey.current) return; // first render, or the same roll
    shownKey.current = rollKey;
    if (reduced || !hasRoll) return;
    setTumble([randomFace(), randomFace()]);
    const spin = setInterval(() => setTumble([randomFace(), randomFace()]), FACE_MS);
    const settle = setTimeout(() => {
      clearInterval(spin);
      setTumble(null);
    }, TUMBLE_MS);
    return () => {
      clearInterval(spin);
      clearTimeout(settle);
      setTumble(null);
    };
  }, [rollKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const faces = tumble ?? values;
  return (
    <span
      className={`mono-dice${values ? '' : ' is-idle'}${tumble ? ' is-rolling' : ''}`}
      role="img"
      aria-label={values ? `Rolled ${values[0]} and ${values[1]}` : 'Dice'}
    >
      <Die value={faces?.[0] ?? 0} />
      <Die value={faces?.[1] ?? 0} />
    </span>
  );
}
