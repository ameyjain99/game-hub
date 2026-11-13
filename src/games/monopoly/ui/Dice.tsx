/** Which of the 3×3 pip slots are filled for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value }: { value: number }) {
  return (
    <span className="mono-die" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value]?.includes(i) ? 'is-pip' : undefined} />
      ))}
    </span>
  );
}

/** The last roll as two real dice faces (blank faces before the first roll). */
export function Dice({ values }: { values: [number, number] | null }) {
  return (
    <span
      className={`mono-dice${values ? '' : ' is-idle'}`}
      role="img"
      aria-label={values ? `Rolled ${values[0]} and ${values[1]}` : 'Dice'}
    >
      <Die value={values?.[0] ?? 0} />
      <Die value={values?.[1] ?? 0} />
    </span>
  );
}
