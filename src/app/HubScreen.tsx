import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { CATEGORIES, GAMES, filterGames, gameColor, type CategoryId } from '../games/registry';
import { Search } from '../shared/icons';
import { GameHubLogo } from './GameHubLogo';
import { GameIcon } from './GameIcon';
import { HubGridBackdrop } from './HubGridBackdrop';
import { JoinRoomDialog } from './JoinRoomDialog';

interface Props {
  /** Called with the game id when a live game's Play button is pressed. */
  onSelect: (gameId: string) => void;
  /** Called with a room's game and code once the code is found to be open. */
  onJoin: (gameId: string, code: string) => void;
}

/** The GameHub home page: hero, the game library, how-it-works, and a CTA. */
export function HubScreen({ onSelect, onJoin }: Props) {
  // "Join a room" opens a small dialog; closing it hands focus back to the button.
  const [joining, setJoining] = useState(false);
  const joinFrom = useRef<HTMLElement | null>(null);
  const openJoin = (e: MouseEvent<HTMLElement>) => {
    joinFrom.current = e.currentTarget;
    setJoining(true);
  };
  const closeJoin = useCallback(() => {
    setJoining(false);
    joinFrom.current?.focus();
  }, []);
  // Library filters: playable games only unless "Show all" is ticked, one
  // category at a time (null = all), and a name search.
  const [showAll, setShowAll] = useState(false);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState('');
  const pool = showAll ? GAMES : GAMES.filter((g) => g.status === 'live');
  const countIn = (id: CategoryId) => pool.filter((g) => g.category === id).length;
  // A category with nothing to show drops out of the pills (unless it's the one picked).
  const pills = CATEGORIES.filter((c) => countIn(c.id) > 0 || c.id === category);
  const shown = filterGames(pool, category, query);

  return (
    <div className="hub">
      <header className="hub-header">
        <div className="hub-brand">
          <GameHubLogo size={34} />
          <span className="hub-wordmark">GameHub</span>
        </div>
        <nav className="hub-nav">
          <a href="#library">Games</a>
          <a href="#how">How it works</a>
          <button type="button" className="hub-pill" onClick={openJoin}>
            Join a room
          </button>
        </nav>
      </header>

      <section className="hub-hero">
        <HubGridBackdrop />
        <p className="hub-eyebrow">Board games · online · together</p>
        <h1 className="hub-headline">
          Your game night,
          <br />
          one link away.
        </h1>
        <p className="hub-sub">
          Ticket to Ride, Monopoly, chess, Ludo, Lineup and more in your browser. Open a room, send the code, and
          everyone's at the same table.
        </p>
        <div className="hub-hero-actions">
          <a className="hub-btn-primary" href="#library">
            Pick a game
          </a>
          <button type="button" className="hub-btn-ghost" onClick={openJoin}>
            Join a room
          </button>
        </div>
      </section>
      {joining && <JoinRoomDialog onJoin={onJoin} onClose={closeJoin} />}

      <section id="library" className="hub-library">
        <div className="hub-library-head">
          <div>
            <p className="hub-eyebrow">The library</p>
            <h2 className="hub-section-title">Pick a game</h2>
          </div>
          <label className="hub-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search games"
              placeholder={`Search ${pool.length} games`}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="hub-filters" role="group" aria-label="Filter games by category">
          <button
            type="button"
            className="hub-filter"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            All <span className="hub-filter-count">{pool.length}</span>
          </button>
          {pills.map((c) => (
            <button
              key={c.id}
              type="button"
              className="hub-filter"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              <span className="hub-filter-swatch" style={{ background: c.color }} aria-hidden="true" />
              {c.label} <span className="hub-filter-count">{countIn(c.id)}</span>
            </button>
          ))}
          <label className="hub-showall">
            <input
              type="checkbox"
              className="g-check"
              checked={showAll}
              onChange={(e) => {
                setShowAll(e.target.checked);
                // Hiding upcoming games can empty the picked category: fall back to All.
                if (!e.target.checked && category && !GAMES.some((g) => g.category === category && g.status === 'live')) setCategory(null);
              }}
            />
            Show all
          </label>
        </div>
        {shown.length > 0 ? (
          <ul className="hub-games" aria-label="Games">
            {shown.map((g) => {
              const live = g.status === 'live';
              const color = gameColor(g);
              return (
                <li key={g.id} className={`game-card${live ? '' : ' is-soon'}`}>
                  <div className="game-card-tile" style={{ background: color }}>
                    <GameIcon gameId={g.id} accent={color} />
                    <span className="game-card-tag">
                      {live ? CATEGORIES.find((c) => c.id === g.category)?.label : 'Coming soon'}
                    </span>
                  </div>
                  <h3 className="game-card-title">{g.title}</h3>
                  <p className="game-card-tagline">{g.tagline}</p>
                  <p className="game-card-meta">{g.players}</p>
                  {live ? (
                    <button
                      type="button"
                      className="game-card-btn"
                      aria-label={`Play ${g.title}`}
                      onClick={() => onSelect(g.id)}
                    >
                      Play now
                    </button>
                  ) : (
                    <button type="button" className="game-card-btn soon" disabled>
                      Coming soon
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hub-empty">
            No games match "{query.trim()}"
            {category ? ` in ${CATEGORIES.find((c) => c.id === category)?.label}` : ''}. Try another name or
            category.
          </p>
        )}
      </section>

      <section id="how" className="hub-how">
        <p className="hub-eyebrow">How it works</p>
        <h2 className="hub-section-title">From link to first turn in a minute</h2>
        <ol className="hub-steps">
          <li>
            <span className="hub-step-num">01</span>
            <h4>Open a room</h4>
            <p>Choose a game and get a short room code that's yours for the night.</p>
          </li>
          <li>
            <span className="hub-step-num">02</span>
            <h4>Send the code</h4>
            <p>Friends enter it on the home page, or tap the invite link you share in your group chat.</p>
          </li>
          <li>
            <span className="hub-step-num">03</span>
            <h4>Play in real time</h4>
            <p>Turns, scores and rules are handled for you, so the table can focus on the game.</p>
          </li>
        </ol>
      </section>

      <section className="hub-cta">
        <div>
          <h2>Gather your table.</h2>
          <p>Pick any game, open a room and send the code. Everyone plays from their own screen.</p>
        </div>
        <a className="hub-btn-primary" href="#library">
          Pick a game
        </a>
      </section>

      <footer className="hub-footer">
        <div className="hub-brand">
          <GameHubLogo size={22} />
          <span>© {new Date().getFullYear()} GameHub</span>
        </div>
        <nav className="hub-nav">
          <a href="#library">Games</a>
          <a href="#how">How it works</a>
        </nav>
      </footer>
    </div>
  );
}
