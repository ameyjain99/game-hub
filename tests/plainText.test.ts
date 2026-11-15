import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Characters editors flag as look-alikes of plain ASCII (VS Code's "ambiguous
// unicode" highlight): en and em dashes, the minus sign, curly quotes and the
// no-break space. Source and docs use the ASCII form instead (-, ', "). The
// multiplication sign stays by choice (8×8 boards, ×2 counts).
const LOOKALIKES = /[\u2013\u2014\u2212\u2018\u2019\u201C\u201D\u00A0]/;

// Only paths git tracks: an ignored folder (docs/) exists locally but not in CI.
const ROOTS = ['src', 'server', 'tests', 'scripts', 'README.md', 'CONTRIBUTING.md', 'GAME_STANDARDS.md', 'index.html', 'render.yaml'];
const TEXT = /\.(ts|tsx|js|css|md|html|json|ya?ml)$/;

function files(path: string): string[] {
  if (!statSync(path).isDirectory()) return TEXT.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

test('source and docs use plain ASCII punctuation', () => {
  const offenders: string[] = [];
  for (const file of ROOTS.flatMap(files)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (LOOKALIKES.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
  }
  expect(offenders).toEqual([]);
});
