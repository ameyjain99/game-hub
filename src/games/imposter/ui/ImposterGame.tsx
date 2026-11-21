import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { SeatFace } from '../../../online/ui/SeatFace';
import { useCues } from '../../kit/ui/useCues';
import { DISCUSS_MS, MAX_CLUE, MODES, clueError, imposterActor, type ImposterAction, type ImposterState, type Outcome } from '../engine';
import { categoryById, wordsIn } from '../words';
import { IM_SOUNDS, imCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2B6BE0', '#20A464', '#F2B705', '#9B6BFF', '#14C3A2', '#FF9F1C', '#FF4F8B', '#6CC4FF', '#B8C26B'];
export const imSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

/** The hub's mask mark, with eye holes. */
function MaskIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="im-mask" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M6 24C6 18 14 17 32 21C50 17 58 18 58 24C58 38 51 46 42 46C36 46 34 39 32 39C30 39 28 46 22 46C13 46 6 38 6 24ZM16 29a7 4.5 0 1 0 14 0a7 4.5 0 1 0 -14 0ZM34 29a7 4.5 0 1 0 14 0a7 4.5 0 1 0 -14 0Z"
      />
    </svg>
  );
}

/** Columns for the clue wall: one row up to five players, then two even rows. */
// Two rows from five players up: wide tiles that fit a whole name (and a face) beat one thin row.
const wallColumns = (n: number) => (n <= 4 ? n : Math.ceil(n / 2));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface Told {
  imposter: string;
  votedOut: string | null;
  guess: string | null;
  outcome: Outcome | null;
}

/** One line on how a round ended, from the viewer's side ("You were voted out..."). */
function outcomeLine(r: Told, who: (id: string) => string, meId: string): string {
  const was = (id: string) => (id === meId ? 'were' : 'was');
  const imp = who(r.imposter);
  switch (r.outcome) {
    case 'void':
      return `${imp} left, so the round doesn't count`;
    case 'guessed':
      return `${imp} ${was(r.imposter)} caught but named the word`;
    case 'caught':
      return `${imp} ${was(r.imposter)} caught${r.guess ? ` and guessed ${r.guess}` : ''}`;
    default:
      return r.votedOut
        ? `${who(r.votedOut)} ${was(r.votedOut)} voted out, but ${imp} ${was(r.imposter)} the imposter`
        : `Nobody was voted out, and ${imp} ${was(r.imposter)} the imposter`;
  }
}

/** Who scored this round, in words. */
function pointsLine(points: Record<string, number>, outcome: Outcome | null, who: (id: string) => string): string {
  const ids = Object.keys(points);
  if (ids.length === 0) return 'No points this round';
  if (outcome === 'caught') return `+1 to everyone but the imposter`;
  return ids.map((id) => `+${points[id]} to ${who(id)}`).join(', ');
}

/** Your word, face down until you tap it. */
function SecretCard({ s, meId }: { s: ImposterState; meId: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [s.round.number]);
  const r = s.round;
  const cat = categoryById(r.category).name;
  const toldImposter = s.mode === 'classic' && r.imposter === meId;
  return (
    <button
      type="button"
      className={`im-card${open ? ' is-open' : ''}${toldImposter ? ' is-imposter' : ''}`}
      aria-pressed={open}
      aria-label={open ? 'Hide your word' : 'Show your word'}
      onClick={() => setOpen((o) => !o)}
    >
      <span className="im-card-inner">
        <span className="im-card-back">
          <MaskIcon size={34} />
          <b>Your word</b>
          <small>Tap to look</small>
        </span>
        <span className="im-card-face">
          {toldImposter ? (
            <>
              <small>You are</small>
              <b className="im-card-word">the imposter</b>
              <small>Blend in. Caught? Name the {cat.toLowerCase()} word.</small>
            </>
          ) : (
            <>
              <small>{cat}</small>
              <b className="im-card-word">{r.yours}</b>
              <small>Tap to hide</small>
            </>
          )}
        </span>
      </span>
    </button>
  );
}

function ClueForm({ s, meId, onAction }: { s: ImposterState; meId: string; onAction: (a: ImposterAction) => void }) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setText('');
    setTried(false);
  }, [s.seq]);
  // In the viewer's own state their word is `yours`; check against that.
  const view = { ...s, round: { ...s.round, word: s.round.yours ?? '', imposter: s.round.yours === null ? meId : '' } };
  const error = text.trim() ? clueError(view, meId, text) : null;
  const pass = Math.floor(s.round.turn / s.round.order.length) + 1;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!text.trim() || error) return;
    onAction({ type: 'CLUE', text: text.trim() });
  };
  return (
    <form className="im-clue-form" onSubmit={submit}>
      <label className="im-dock-title" htmlFor="im-clue">
        Your clue{s.cluesEach > 1 ? ` (${pass} of ${s.cluesEach})` : ''}
      </label>
      <div className="im-clue-row">
        <input
          id="im-clue"
          className="g-input"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_CLUE}
          placeholder="One word"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\s/g, ''))}
        />
        <button type="submit" className="primary" disabled={!text.trim() || !!error}>
          Give clue
        </button>
      </div>
      <p className={`im-hint${error && (tried || text.length > 2) ? ' is-error' : ''}`} role={error ? 'alert' : undefined}>
        {error && (tried || text.length > 2) ? error : s.round.yours ? "One word that fits your word. Not the word itself or part of it." : 'One word that fits the category. Sound like you know the word.'}
      </p>
    </form>
  );
}

export function ImposterGame({ view: s, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<ImposterState, ImposterAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(s, (a, b) => imCues(a, b, meId), IM_SOUNDS);

  const r = s.round;
  const cat = categoryById(r.category);
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const colorOf = (id: string) => imSeatColor(s.players.findIndex((p) => p.id === id));
  const me = s.players.find((p) => p.id === meId);
  const seated = !!me && !me.out;
  const actorId = imposterActor(s);
  const ballot = r.ballots[r.ballots.length - 1] ?? {};
  const counted = s.phase !== 'vote' && r.ballots.length > 0;
  const canVote = s.phase === 'vote' && seated && !(meId in ballot);
  const myVote = s.phase === 'vote' ? ballot[meId] : undefined;
  const giver = s.phase === 'clues' ? actorId : null;
  const revealed = s.phase === 'reveal' || s.phase === 'over';

  // Votes on each player once the ballot is counted.
  const votesFor = new Map<string, string[]>();
  if (counted) for (const [voter, target] of Object.entries(ballot)) if (target) votesFor.set(target, [...(votesFor.get(target) ?? []), voter]);
  // The ballot is read out one vote at a time, then the verdict lands.
  const voteOrder = Object.keys(ballot).filter((v) => ballot[v]);
  const VOTE_MS = 650;
  const cluesBy = (id: string) => r.clues.filter((c) => c.player === id);
  const playersInRound = r.order.map((id) => s.players.find((p) => p.id === id)!).filter(Boolean);
  const notVoted = playersInRound.filter((p) => !p.out && !(p.id in ballot));
  const waitingReady = playersInRound.filter((p) => !p.out && !p.isAI && !r.ready.includes(p.id));

  const wall = (
    <ol className={`im-wall${online && s.phase === 'discuss' ? ' is-talk' : ''}`} style={{ '--cols': wallColumns(playersInRound.length) } as CSSProperties}>
      {playersInRound.map((p, at) => {
        const mine = cluesBy(p.id);
        // A last row that is not full sits in the middle (each tile spans two half-columns).
        const cols = wallColumns(playersInRound.length);
        const spare = playersInRound.length % cols;
        const start = spare && at === playersInRound.length - spare ? cols - spare + 1 : undefined;
        const votable = canVote && p.id !== meId && r.candidates.includes(p.id) && !p.out;
        const outOfRunoff = s.phase === 'vote' && r.runoff && !r.candidates.includes(p.id);
        const isImposter = !!r.imposter && r.imposter === p.id && (revealed || s.phase === 'guess');
        const voters = votesFor.get(p.id) ?? [];
        const cls = [
          'im-tile',
          giver === p.id && 'is-turn',
          spotlight === p.id && 'is-spot',
          p.out && 'is-out',
          votable && 'is-votable',
          outOfRunoff && 'is-dim',
          myVote === p.id && 'is-chosen',
          isImposter && 'is-imposter',
          r.votedOut === p.id && counted && 'is-voted-out',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li
            key={p.id}
            className={cls}
            style={{ '--tc': colorOf(p.id), '--start': start } as CSSProperties}
            onMouseEnter={() => setSpotlight(p.id)}
            onMouseLeave={() => setSpotlight(null)}
          >
            <SeatFace
              id={p.id}
              shape="wide"
              className="im-face"
              color={colorOf(p.id)}
              fallback={online && s.phase === 'discuss' && !p.isAI && !p.out ? <span className="im-face is-off">{tokenLabel(nameFor(p.id))}</span> : null}
            />
            <div className="im-tile-head">
              <span className="kit-token" aria-hidden="true">
                {tokenLabel(nameFor(p.id))}
              </span>
              <span className="im-tile-name">{nameFor(p.id)}</span>
              {isImposter ? (
                <span className="im-tag is-imposter">
                  <MaskIcon size={14} /> <span className="im-tag-text">Imposter</span>
                </span>
              ) : p.out ? (
                <span className="im-tag">Left</span>
              ) : s.phase === 'vote' && p.id in ballot ? (
                <span className="im-tag is-done">Voted</span>
              ) : s.phase === 'discuss' && r.ready.includes(p.id) ? (
                <span className="im-tag is-done">Ready</span>
              ) : null}
            </div>
            <ol className="im-clues" aria-label={p.id === meId ? 'Your clues' : `${nameFor(p.id)}'s clues`}>
              {Array.from({ length: s.cluesEach }, (_, k) => {
                const c = mine[k];
                const typing = giver === p.id && k === mine.length;
                return (
                  <li key={k} className={`im-clue${c ? (c.text ? '' : ' is-none') : ' is-empty'}${typing ? ' is-typing' : ''}`}>
                    {c ? (c.text ?? 'no clue') : typing ? <span className="im-dots" aria-label="thinking" /> : null}
                  </li>
                );
              })}
            </ol>
            {counted && (voters.length > 0 || r.votedOut === p.id) && (
              <div className="im-tile-foot">
                {voters.length > 0 && (
                  <div className="im-votes" aria-label={`${plural(voters.length, 'vote')} for ${who(p.id)}`}>
                    {voters.map((v) => (
                      <span key={v} className="im-vote-dot is-read" style={{ '--tc': colorOf(v), animationDelay: `${voteOrder.indexOf(v) * VOTE_MS}ms` } as CSSProperties} title={`${who(v)} voted for ${who(p.id)}`}>
                        {tokenLabel(nameFor(v))}
                      </span>
                    ))}
                    <b className="im-vote-count" style={{ animationDelay: `${voteOrder.length * VOTE_MS}ms` }}>{plural(voters.length, 'vote')}</b>
                  </div>
                )}
                {r.votedOut === p.id && (
                  <span className="im-stamp" style={{ animationDelay: `${voteOrder.length * VOTE_MS + 350}ms` }}>
                    Voted out
                  </span>
                )}
              </div>
            )}
            {votable && (
              <button type="button" className="im-vote-btn" onClick={() => onAction({ type: 'VOTE', target: p.id })} aria-label={`Vote for ${nameFor(p.id)}`}>
                <span>Vote</span>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );

  let dock;
  if (s.phase === 'clues') {
    dock =
      giver === meId ? (
        <ClueForm s={s} meId={meId} onAction={onAction} />
      ) : (
        <p className="im-dock-line">
          <b>{giver ? who(giver) : ''}</b> {giver === meId ? 'are' : 'is'} thinking of a clue<span className="im-dots" />
        </p>
      );
  } else if (s.phase === 'discuss') {
    dock = (
      <div className="im-talk">
        <div>
          <p className="im-dock-title">Talk it over</p>
          <p className="kit-muted">
            {waitingReady.length > 0 ? `The vote opens when everyone is ready, or in a minute. Waiting for ${waitingReady.map((p) => who(p.id)).join(', ')}.` : 'The vote is opening.'}
          </p>
        </div>
        {seated && !me!.isAI && !r.ready.includes(meId) && (
          <button type="button" className="primary" onClick={() => onAction({ type: 'READY' })}>
            Ready to vote
          </button>
        )}
        <span className="im-timer" key={r.number} style={{ '--ms': `${DISCUSS_MS}ms` } as CSSProperties} />
      </div>
    );
  } else if (s.phase === 'vote') {
    const runoff = r.runoff ? `It's a tie. Vote again between ${r.candidates.map(who).join(' and ')}.` : null;
    dock = canVote ? (
      <p className="im-dock-line">
        <b>{runoff ?? 'Who is the imposter?'}</b> Tap a player to vote.
      </p>
    ) : (
      <p className="im-dock-line">
        {myVote ? (
          <>
            You voted for <b>{who(myVote)}</b>.{' '}
          </>
        ) : runoff ? (
          <b>{runoff} </b>
        ) : null}
        Waiting for {plural(notVoted.length, 'vote')}
        <span className="im-dots" />
      </p>
    );
  } else if (s.phase === 'guess') {
    dock =
      r.imposter === meId ? (
        <div className="im-guess">
          <p className="im-dock-title">You were caught. Name the word for 1 point.</p>
          <div className="im-guess-grid">
            {wordsIn(cat).map((w) => (
              <button key={w} type="button" className="g-btn" onClick={() => onAction({ type: 'GUESS', word: w })}>
                {w}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="im-dock-line">
          <b>{who(r.imposter)}</b> {r.imposter === meId ? 'were' : 'was'} the imposter. One guess at the word
          <span className="im-dots" />
        </p>
      );
  } else if (s.phase === 'reveal') {
    dock = (
      <div className={`im-reveal is-${r.outcome}`}>
        <p className="im-dock-title">{outcomeLine(r, who, meId)}</p>
        <p className="im-reveal-words">
          The word was <b>{r.word}</b>
          {r.decoy && (
            <>
              {' '}
              · the imposter had <b>{r.decoy}</b>
            </>
          )}
          <span className="kit-muted"> · {pointsLine(r.points, r.outcome, who)}</span>
        </p>
      </div>
    );
  }

  const board = (
    <div className="kit-board im-board">
      <div className="im-top">
        <div className="im-round">
          <span className="im-kicker">
            Round {r.number} of {s.totalRounds} · {MODES[s.mode].name}
          </span>
          <span className="im-category">{cat.name}</span>
        </div>
        {seated && <SecretCard s={s} meId={meId} />}
      </div>
      {wall}
      {dock && <div className="im-dock">{dock}</div>}
    </div>
  );

  const ranked = [...s.players].sort((a, b) => b.score - a.score);
  const won = s.winners.includes(meId);
  const overlay = s.over ? (
    <ResultCard
      kicker={`${MODES[s.mode].name} · ${plural(s.history.length, 'round')}`}
      title={won ? (s.winners.length > 1 ? 'You share the win' : 'You win') : `${s.winners.map(who).join(' and ')} ${s.winners.length > 1 ? 'share the win' : 'wins'}`}
      won={won}
      onRematch={() => onAction({ type: 'REMATCH' })}
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={1200}
    >
      <ol className="im-standings">
        {ranked.map((p) => (
          <li key={p.id}>
            <span>{nameFor(p.id)}</span> <b>{plural(p.score, 'point')}</b>
          </li>
        ))}
      </ol>
    </ResultCard>
  ) : null;

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={s.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({
            id: p.id,
            accent: colorOf(p.id),
            active: actorId === p.id,
            badge: (
              <span className="kit-badge" style={{ '--tc': colorOf(p.id) } as CSSProperties}>
                {tokenLabel(nameFor(p.id))}
              </span>
            ),
          }))}
      />
      <PlayersPanel
        title="Scores"
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={s.players.map((p) => ({
          id: p.id,
          name: nameFor(p.id),
          you: p.id === meId,
          color: colorOf(p.id),
          detail: p.out
            ? 'Left the game'
            : giver === p.id
              ? 'Giving a clue'
              : s.phase === 'vote' && p.id in ballot
                ? 'Voted'
                : undefined,
          trailing: p.score,
          active: actorId === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="Scoring">
        <ul className="im-scoring">
          <li>
            <b>+2</b> to the imposter if they are not voted out
          </li>
          {s.mode === 'classic' && (
            <li>
              <b>+1</b> to a caught imposter who names the word
            </li>
          )}
          <li>
            <b>+1</b> to everyone else when the imposter is caught{s.mode === 'classic' ? ' and misses' : ''}
          </li>
        </ul>
      </SideSection>
    </>
  );

  let status;
  if (s.over) status = <><strong>{s.winners.map(who).join(' and ')}</strong> {won || s.winners.length > 1 ? 'win' : 'wins'} the game</>;
  else if (s.phase === 'clues') status = giver === meId ? <><strong>Your clue</strong> · one word</> : <><strong>{nameFor(giver ?? '')}</strong> is giving a clue</>;
  else if (s.phase === 'discuss') status = <><strong>Talk it over</strong> · then vote</>;
  else if (s.phase === 'vote') status = r.runoff ? <><strong>Runoff</strong> · {r.candidates.map(who).join(' or ')}</> : <><strong>Vote</strong> · who is the imposter?</>;
  else if (s.phase === 'guess') status = <><strong>{who(r.imposter)}</strong> {r.imposter === meId ? 'name' : 'names'} the word</>;
  else status = <>{outcomeLine(r, who, meId)}</>;

  return (
    <GameShell
      className={`im-game is-${s.phase}`}
      rulesVariant={s.mode}
      title="Imposter"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={board}
      overlay={overlay}
      side={side}
      log={
        <SideSection title="Rounds" meta={`${Math.min(r.number, s.totalRounds)} of ${s.totalRounds}`}>
          {s.history.length === 0 ? (
            <p className="kit-muted">Each round's word and result land here.</p>
          ) : (
            <ul className="kit-log im-history">
              {[...s.history].reverse().map((h) => (
                <li key={h.number}>
                  <b>
                    {h.number}. {categoryById(h.category).name}: {h.word}
                    {h.decoy ? ` / ${h.decoy}` : ''}
                  </b>
                  <br />
                  {outcomeLine(h, who, meId)}
                </li>
              ))}
            </ul>
          )}
        </SideSection>
      }
    />
  );
}
