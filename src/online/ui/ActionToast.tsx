import { useEffect } from 'react';

/** A refused move, in words for the player. */
function actionErrorText(error: string): string {
  switch (error) {
    case 'not your turn':
      return "It's not your turn yet.";
    case 'the game is paused':
      return 'The game is paused. Carry on first.';
    case 'no active game':
      return "The game isn't running.";
    default: {
      const text = error.trim();
      return text ? text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? '' : '.') : '';
    }
  }
}

const TOAST_MS = 3500;

/**
 * Says why a click did nothing: the game refused the move. Shown for a few
 * seconds over the bottom of the screen, then cleared.
 */
export function ActionToast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="g-toast" role="alert">
      {actionErrorText(message)}
    </div>
  );
}
