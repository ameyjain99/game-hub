/**
 * The GameHub loader (from docs/GameHub.html): the "GH" monogram drawing itself
 * on repeat via a staggered stroke-dash animation, with an optional caption.
 * Shared across games for async waits. Pass `full` to centre it as a screen.
 */
// The four strokes of the monogram — the G, then the H's two bars and crossbar —
// split out (vs. the single-path logo) so each can draw with its own delay.
const STROKES = ['M45.5 30.5H28A19.5 19.5 0 0 0 28 69.5H37V41.5', 'M63 22V78', 'M86 78V22', 'M63 50H86'];
const DELAYS = [0, 0.18, 0.32, 0.5];

export function Loader({ label, full }: { label?: string; full?: boolean }) {
  return (
    <div className={`loader${full ? ' loader-full' : ''}`} role="status" aria-live="polite">
      <svg className="loader-mark" width="150" height="90" viewBox="-2 18 98.5 60" aria-hidden="true">
        {/* White twin-line draws on; the dark inner stroke carves it in lockstep. */}
        {STROKES.map((d, i) => (
          <path key={`w${i}`} className="ghl" pathLength={1} d={d} stroke="#ffffff" strokeWidth={17} style={{ animationDelay: `${DELAYS[i]}s` }} />
        ))}
        {STROKES.map((d, i) => (
          <path key={`b${i}`} className="ghl" pathLength={1} d={d} stroke="#0b0b0f" strokeWidth={5} style={{ animationDelay: `${DELAYS[i]}s` }} />
        ))}
      </svg>
      {label && <span className="loader-label">{label}</span>}
    </div>
  );
}
