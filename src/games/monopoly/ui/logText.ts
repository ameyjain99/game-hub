export type LogPart = { text: string } | { player: string };

/** Engine log lines reference players as `{p0}` tokens. Split a line into its
 *  text and those references, so the UI can render each name (and mark it). */
export function logParts(line: string): LogPart[] {
  return line
    .split(/\{(p\d+)\}/)
    .map((chunk, i): LogPart => (i % 2 === 1 ? { player: chunk } : { text: chunk }))
    .filter((p) => !('text' in p) || p.text !== '');
}
