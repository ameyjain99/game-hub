/** Imposter's rule-book pictures: the word cards as players see them. */
import type { ReactNode } from 'react';

function Face({ imposter, children }: { imposter?: boolean; children: ReactNode }) {
  return (
    <span className={`im-card is-open${imposter ? ' is-imposter' : ''}`} style={{ cursor: 'default' }}>
      <span className="im-card-inner" style={{ transition: 'none' }}>
        <span className="im-card-face">{children}</span>
      </span>
    </span>
  );
}

const WordCards = ({ decoy = false }: { decoy?: boolean }) => (
  <div className="rf-row">
    <span className="rf-col">
      <Face>
        <small>Animals</small>
        <b className="im-card-word">Lion</b>
      </Face>
      <span className="rf-label">The crew&apos;s card</span>
    </span>
    <span className="rf-col">
      {decoy ? (
        <Face>
          <small>Animals</small>
          <b className="im-card-word">Tiger</b>
        </Face>
      ) : (
        <Face imposter>
          <small>You are</small>
          <b className="im-card-word">the imposter</b>
          <small>Animals</small>
        </Face>
      )}
      <span className="rf-label">{decoy ? "The imposter's card (looks just the same)" : "The imposter's card"}</span>
    </span>
  </div>
);

export const ClassicCards = () => <WordCards />;
export const DecoyCards = () => <WordCards decoy />;
