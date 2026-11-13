import type { ReactNode } from 'react';
import { BackIcon } from '../icons';

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  submitLabel: string;
  canSubmit: boolean;
  /** Shown under the button while it's disabled, saying what's missing. */
  blockedHint?: string;
  onSubmit: () => void;
  children: ReactNode;
}

/** The create / join form frame: header, stacked fields, one full-width submit. */
export function GameForm({ eyebrow, title, subtitle, onBack, submitLabel, canSubmit, blockedHint, onSubmit, children }: Props) {
  return (
    <form
      className="setup-screen g-screen"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <button type="button" className="back-link" onClick={onBack}>
        <BackIcon size={16} />
        Back
      </button>
      <header className="g-head">
        <p className="g-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="tagline">{subtitle}</p>}
      </header>
      <div className="g-form-body">{children}</div>
      <footer className="g-foot">
        <button type="submit" className="primary g-block" disabled={!canSubmit}>
          {submitLabel}
        </button>
        {!canSubmit && blockedHint && <p className="g-hint">{blockedHint}</p>}
      </footer>
    </form>
  );
}
