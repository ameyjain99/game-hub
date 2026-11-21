/**
 * The names as they fit at a seat on a narrow screen: initials for a name of
 * several words ("Triple-Word Ted" is "TWT"), the name itself for one word.
 * Players whose initials would match keep their first word ("Doc D", "Dr. D").
 */
export function shortNames(names: string[]): string[] {
  const words = (name: string) => name.split(/[\s-]+/).map((w) => w.replace(/[()]/g, '')).filter(Boolean);
  const initials = names.map((name) => {
    const w = words(name);
    return w.length < 2 ? name : w.map((x) => (/^\d+$/.test(x) ? x : x[0].toUpperCase())).join('').slice(0, 4);
  });
  return names.map((name, i) => {
    const w = words(name);
    const clash = initials.some((other, j) => j !== i && other === initials[i]);
    return clash && w.length > 1 ? `${w[0].slice(0, 6)} ${w[w.length - 1][0].toUpperCase()}` : initials[i];
  });
}
