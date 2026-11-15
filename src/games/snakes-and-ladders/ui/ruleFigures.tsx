/** Snakes & Ladders' rule-book picture: a ladder up and a snake down. */
const N = 5;

export const UpAndDown = () => (
  <svg viewBox="0 0 250 150" width={250} height={150} aria-hidden="true">
    {Array.from({ length: 15 }, (_, i) => {
      const row = Math.floor(i / N);
      const col = row % 2 === 0 ? i % N : N - 1 - (i % N);
      return (
        <g key={i}>
          <rect x={col * 50 + 1} y={(2 - row) * 50 + 1} width={48} height={48} rx={6} fill={i % 2 ? '#2a2f3b' : '#323849'} />
          <text x={col * 50 + 8} y={(2 - row) * 50 + 16} fontSize={11} fontWeight={700} fill="#ffffff99">
            {i + 1}
          </text>
        </g>
      );
    })}
    <g stroke="#e3b23c" strokeWidth={4} strokeLinecap="round">
      <line x1={70} y1={130} x2={120} y2={30} />
      <line x1={86} y1={138} x2={136} y2={38} />
      {[0.2, 0.4, 0.6, 0.8].map((t) => (
        <line key={t} x1={70 + 50 * t} y1={130 - 100 * t} x2={86 + 50 * t} y2={138 - 100 * t} strokeWidth={3} />
      ))}
    </g>
    <path d="M215 25C180 40 230 70 195 85S180 120 175 125" fill="none" stroke="#25A35A" strokeWidth={9} strokeLinecap="round" />
    <circle cx={215} cy={25} r={7} fill="#25A35A" />
  </svg>
);
