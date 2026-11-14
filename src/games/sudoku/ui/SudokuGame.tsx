import { useCallback, useEffect, useRef, useState } from 'react';
import { applySudoku, boxOf, clashes, colOf, completedGroups, newGame, rowOf, type Difficulty, type SudokuAction, type SudokuState } from '../engine';
import { GameShell } from '../../kit/ui/GameShell';
import { ResultCard } from '../../kit/ui/ResultCard';
import { freshSeed } from '../../kit/ui/KitLocal';
import { playGroup, playLose, playMistake, playNote, playTap, playWin } from './sound';

const LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/** The Sudoku board and its controls: pick a cell, then a number (or type it). */
export function SudokuGame({ difficulty, mistakeLimit, onExit }: { difficulty: Difficulty; mistakeLimit: number; onExit: () => void }) {
  const [state, setState] = useState<SudokuState>(() => newGame(difficulty, freshSeed(), mistakeLimit));
  const [undo, setUndo] = useState<SudokuState[]>([]);
  const [selected, setSelected] = useState<number>(() => state.puzzle.findIndex((v) => v === 0));
  const [notesMode, setNotesMode] = useState(false);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const live = useRef(state);
  live.current = state;

  useEffect(() => {
    if (endedAt !== null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endedAt]);
  const elapsed = Math.floor(((endedAt ?? now) - started) / 1000);

  const act = useCallback((a: SudokuAction) => {
    const s = live.current;
    const next = applySudoku(s, a);
    if (next === s) return;
    live.current = next;
    setUndo((u) => [...u.slice(-300), s]);
    setState(next);
    if (a.type === 'NOTE') playNote();
    else if (a.type === 'ERASE') playTap();
    else if (next.mistakes > s.mistakes) playMistake();
    else {
      playTap();
      // A row, column or box just completed glows.
      const groups = completedGroups(next, a.cell).filter((g) => !completedGroups(s, a.cell).some((h) => h[0] === g[0] && h[8] === g[8]));
      if (groups.length && !next.won) {
        playGroup(groups.length);
        setFlash(new Set(groups.flat()));
        setTimeout(() => setFlash(new Set()), 700);
      }
    }
    if (next.won || next.lost) {
      setEndedAt(Date.now());
      setTimeout(next.won ? playWin : playLose, 250);
    }
  }, []);

  const enter = useCallback(
    (value: number) => {
      const s = live.current;
      if (s.puzzle[selected]) return;
      if (notesMode) act({ type: 'NOTE', cell: selected, value });
      else act({ type: 'SET', cell: selected, value });
    },
    [selected, notesMode, act],
  );

  const undoOnce = () => {
    if (undo.length === 0 || state.won || state.lost) return;
    const prev = undo[undo.length - 1];
    live.current = prev;
    setState(prev);
    setUndo(undo.slice(0, -1));
  };

  const restart = () => {
    const fresh = newGame(difficulty, freshSeed(), mistakeLimit);
    live.current = fresh;
    setState(fresh);
    setUndo([]);
    setSelected(fresh.puzzle.findIndex((v) => v === 0));
    setEndedAt(null);
  };

  // Keys: digits, arrows, Backspace/Delete, N for notes, Ctrl/Cmd+Z.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoOnce();
        return;
      }
      if (/^[1-9]$/.test(e.key)) enter(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') act({ type: 'ERASE', cell: selected });
      else if (e.key.toLowerCase() === 'n') setNotesMode((m) => !m);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const r = rowOf(selected);
        const c = colOf(selected);
        const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key] ?? [0, 0];
        setSelected(((r + dr + 9) % 9) * 9 + ((c + dc + 9) % 9));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sel = state.values[selected];
  const placed = (d: number) => state.values.filter((v, i) => v === d && v === state.solution[i]).length;

  const board = (
    <div className={`kit-board sdk-board${state.won ? ' is-won' : ''}`}>
      <div className="sdk-grid" role="grid" aria-label="Sudoku grid">
        {state.values.map((v, i) => {
          const given = state.puzzle[i] !== 0;
          const wrong = !given && v !== 0 && v !== state.solution[i];
          const cls = ['sdk-cell'];
          if (given) cls.push('is-given');
          else if (v) cls.push(wrong ? 'is-wrong' : 'is-entered');
          if (i === selected) cls.push('is-selected');
          else if (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected)) cls.push('is-peer');
          if (sel && v === sel && i !== selected) cls.push('is-same');
          if (clashes(state.values, i) && !given) cls.push('is-clash');
          if (flash.has(i)) cls.push('is-flash');
          if (colOf(i) % 3 === 2 && colOf(i) < 8) cls.push('edge-r');
          if (rowOf(i) % 3 === 2 && rowOf(i) < 8) cls.push('edge-b');
          const label = `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}, ${v ? `${v}${given ? ' (clue)' : wrong ? ' (wrong)' : ''}` : 'empty'}`;
          return (
            <button key={i} type="button" role="gridcell" className={cls.join(' ')} aria-label={label} aria-selected={i === selected} onClick={() => setSelected(i)}>
              {v ? (
                <span className="sdk-value">{v}</span>
              ) : state.notes[i] ? (
                <span className="sdk-notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <span key={d} className={sel === d ? 'is-same' : undefined}>
                      {state.notes[i] & (1 << d) ? d : ''}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const overlay =
    state.won || state.lost ? (
      <ResultCard
        title={state.won ? 'Solved!' : 'Out of chances'}
        won={state.won}
        onRematch={restart}
        rematchLabel={`New ${LABEL[difficulty].toLowerCase()} puzzle`}
        onExit={onExit}
        exitLabel="Back to games"
        delayMs={state.won ? 900 : 500}
      >
        <p>
          {state.won
            ? `${LABEL[difficulty]} in ${clock(elapsed)} · ${state.mistakes} ${state.mistakes === 1 ? 'mistake' : 'mistakes'}${state.hints ? ` · ${state.hints} ${state.hints === 1 ? 'hint' : 'hints'}` : ''}`
            : `${mistakeLimit} mistakes. The grid stays as you left it – try another.`}
        </p>
      </ResultCard>
    ) : null;

  const side = (
    <>
      <div className="kit-panel sol-stats">
        <div>
          <span>Time</span>
          <b>{clock(elapsed)}</b>
        </div>
        <div>
          <span>Mistakes</span>
          <b className={state.mistakes ? 'sdk-bad' : undefined}>
            {state.mistakes}
            {mistakeLimit ? `/${mistakeLimit}` : ''}
          </b>
        </div>
        <div>
          <span>Level</span>
          <b className="sdk-level">{LABEL[difficulty]}</b>
        </div>
      </div>
      <div className="kit-panel">
        <div className="sdk-pad" role="group" aria-label="Numbers">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            const left = 9 - placed(d);
            return (
              <button key={d} type="button" className={`sdk-key${sel === d ? ' is-same' : ''}`} disabled={left === 0 || state.won || state.lost} aria-label={`${d}${left ? `, ${left} left` : ', all placed'}`} onClick={() => enter(d)}>
                <b>{d}</b>
                <span>{left || '✓'}</span>
              </button>
            );
          })}
        </div>
        <div className="sdk-tools">
          <button type="button" className="g-btn g-btn-ghost" disabled={undo.length === 0} onClick={undoOnce}>
            Undo
          </button>
          <button type="button" className="g-btn g-btn-ghost" onClick={() => act({ type: 'ERASE', cell: selected })}>
            Erase
          </button>
          <button type="button" className={`g-btn ${notesMode ? 'g-btn-light' : 'g-btn-ghost'}`} aria-pressed={notesMode} onClick={() => setNotesMode((m) => !m)}>
            Notes {notesMode ? 'on' : 'off'}
          </button>
          <button type="button" className="g-btn g-btn-ghost" disabled={state.puzzle[selected] !== 0 || state.values[selected] === state.solution[selected]} onClick={() => act({ type: 'HINT', cell: selected })}>
            Hint
          </button>
        </div>
        <p className="kit-muted">Type 1–9 or use the pad; arrows move, N toggles notes, ⌫ erases. Each row, column and box holds 1–9 once.</p>
      </div>
      <button type="button" className="g-btn g-btn-ghost" onClick={restart}>
        New puzzle
      </button>
    </>
  );

  return (
    <GameShell
      className="sdk-game"
      title="Sudoku"
      exitLabel="Back to games"
      onExit={onExit}
      status={
        state.won ? (
          <><strong>Solved</strong> in {clock(elapsed)}</>
        ) : (
          <><strong>{LABEL[difficulty]}</strong> · {state.values.filter((v, i) => v && v === state.solution[i]).length} of 81 filled</>
        )
      }
      board={board}
      overlay={overlay}
      side={side}
    />
  );
}
