import type { RedactedReveal } from '../engine/redact';

/**
 * A suggestion and its outcome as the viewer should read it. The shown card is
 * only visible to the suggester and the disprover, so the wording depends on
 * which of them (if either) is reading.
 */
export function describeReveal(
  r: RedactedReveal,
  meId: string,
  nameFor: (id: string) => string,
): { suggestion: string; outcome: string } {
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const suggestion = `${who(r.suggester)} suggested ${r.suggestion.suspect} with the ${r.suggestion.weapon} in the ${r.suggestion.room}.`;
  let outcome: string;
  if (!r.disprover) outcome = 'Nobody could disprove it.';
  else if (r.card && r.suggester === meId) outcome = `${nameFor(r.disprover)} showed you ${r.card}.`;
  else if (r.card && r.disprover === meId) outcome = `You showed ${nameFor(r.suggester)} ${r.card}.`;
  else outcome = `${nameFor(r.disprover)} showed ${r.suggester === meId ? 'you' : nameFor(r.suggester)} a card.`;
  return { suggestion, outcome };
}
