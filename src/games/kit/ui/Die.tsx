import { useEffect, useRef, useState, type CSSProperties } from 'react';
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

const TUMBLE_MS = 560;
const FACE_MS = 70;
const randomFace = () => 1 + Math.floor(Math.random() * 6);

/**
 * One die showing `value` (blank before the first roll). A new roll – a change
 * of `rollKey` – tumbles through random faces before settling; the accessible
 * label always states the real result.
 */
export function Die({ value, rollKey, size = 52, label }: { value: number | null; rollKey: number; size?: number; label?: string }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [tumble, setTumble] = useState<number | null>(null);
  const shown = useRef(rollKey);

  useEffect(() => {
    if (rollKey === shown.current) return;
    shown.current = rollKey;
    if (reduced || value === null) return;
    setTumble(randomFace());
    const spin = setInterval(() => setTumble(randomFace()), FACE_MS);
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

  const face = tumble ?? value ?? 0;
  return (
    <span
      className={`kit-die${value === null ? ' is-idle' : ''}${tumble !== null ? ' is-rolling' : ''}`}
      style={{ '--die': `${size}px` } as CSSProperties}
      role="img"
      aria-label={label ?? (value === null ? 'Die' : `Rolled ${value}`)}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[face]?.includes(i) ? 'is-pip' : undefined} />
      ))}
    </span>
  );
}

/** Whether a die rolled `rollKey` is still tumbling (for holding back what it reveals). */
export const DIE_TUMBLE_MS = TUMBLE_MS;
