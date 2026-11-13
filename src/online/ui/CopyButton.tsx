import { useState } from 'react';
import { CheckIcon, CopyIcon } from '../../shared/icons';

/** Copies `text`, then briefly confirms with a green tick. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button type="button" className={`g-btn g-btn-sm g-btn-ghost g-copy${copied ? ' is-copied' : ''}`} onClick={copy}>
      {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
