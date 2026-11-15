/** Sudoku's rule-book picture: one complete box. */
const DIGITS = [5, 3, 4, 6, 7, 2, 1, 9, 8];

export const Box = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 38px)', border: '2px solid #ffffff99', borderRadius: 6, overflow: 'hidden' }}>
    {DIGITS.map((d, i) => (
      <span
        key={i}
        style={{ display: 'grid', placeItems: 'center', height: 38, fontSize: 18, fontWeight: 700, color: i % 4 === 0 ? '#fff' : '#9fc2ff', background: '#1b1b21', border: '1px solid #ffffff1f' }}
      >
        {d}
      </span>
    ))}
  </div>
);
