/** Engine log lines reference players as `{p0}` tokens; swap in display names. */
export function renderLogLine(line: string, nameFor: (id: string) => string): string {
  return line.replace(/\{(p\d+)\}/g, (_, id: string) => nameFor(id));
}
