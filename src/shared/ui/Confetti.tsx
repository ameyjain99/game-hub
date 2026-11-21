import { useMemo, type CSSProperties } from 'react';

const COLORS = ['#E5383B', '#2B6BE0', '#20A464', '#F2B705', '#9B6BFF', '#FF9F1C', '#14C3A2', '#ffffff'];

/**
 * A burst of confetti over the screen for the winner. Pure decoration: it
 * can't be clicked, isn't announced, and isn't drawn under reduced motion.
 */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        fall: 2.2 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 30,
        spin: 360 + Math.random() * 720,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        round: i % 4 === 0,
      })),
    [pieces],
  );
  return (
    <div className="g-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i
          key={i}
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.round ? b.size : b.size * 0.45,
              background: b.color,
              borderRadius: b.round ? '50%' : 1,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.fall}s`,
              '--drift': `${b.drift}vw`,
              '--spin': `${b.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
