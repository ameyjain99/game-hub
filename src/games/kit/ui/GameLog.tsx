import type { CSSProperties, ReactNode } from 'react';
import { SideSection } from './GameShell';

export interface LogEntry {
  key: string | number;
  text: ReactNode;
  /** The colour of the player it's about. */
  color?: string;
  /** A turning point (a catch, a chip removed, a line made): it reads stronger. */
  loud?: boolean;
}

/** The game's running log, newest first: who did what, each line marked in
 *  its player's colour. Sits left of the board on a wide screen. */
export function GameLog({ entries, empty, title = 'Game log' }: { entries: LogEntry[]; empty: ReactNode; title?: string }) {
  return (
    <SideSection title={title} meta={entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'play' : 'plays'}` : undefined} className="kit-log-section">
      {entries.length === 0 ? (
        <p className="kit-muted">{empty}</p>
      ) : (
        <ol className="kit-log is-feed" aria-label={title}>
          {entries.map((e) => (
            <li key={e.key} className={e.loud ? 'is-loud' : undefined} style={{ '--tc': e.color ?? 'var(--muted)' } as CSSProperties}>
              <span className="kit-log-dot" aria-hidden="true" />
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </SideSection>
  );
}
