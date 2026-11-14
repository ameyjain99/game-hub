import type { CSSProperties } from 'react';
import { logParts } from './logText';

/** One log line, each player named with a dot in their token colour (readable on
 *  both the light board centre and the dark sidebar). */
export function LogLine({
  line,
  nameFor,
  colorFor,
}: {
  line: string;
  nameFor: (id: string) => string;
  colorFor: (id: string) => string;
}) {
  return (
    <>
      {logParts(line).map((part, i) =>
        'player' in part ? (
          <span key={i} className="mono-log-name">
            <span className="mono-log-dot" style={{ '--tc': colorFor(part.player) } as CSSProperties} aria-hidden />
            {nameFor(part.player)}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
