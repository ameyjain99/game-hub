import type { CSSProperties } from 'react';
import { GAMES } from '../games/registry';
import { GameHubLogo } from './GameHubLogo';
import { GameIcon } from './GameIcon';
import { HubGridBackdrop } from './HubGridBackdrop';

interface Props {
  /** Called with the game id when a live game's Play button is pressed. */
  onSelect: (gameId: string) => void;
}

const FEATURED = 'ticket-to-ride';

/** The GameHub home page: hero, the game library, how-it-works, and a CTA. */
export function HubScreen({ onSelect }: Props) {
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
          <button type="button" className="hub-pill" onClick={() => onSelect(FEATURED)}>
            Create a room
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
          Ticket to Ride, Monopoly, Cluedo and Catan in your browser. Open a room, send the code, and
          everyone's at the same table.
        </p>
        <div className="hub-hero-actions">
          <button type="button" className="hub-btn-primary" onClick={() => onSelect(FEATURED)}>
            Create a room
          </button>
          <a className="hub-btn-ghost" href="#library">
            Browse games
          </a>
        </div>
      </section>

      <section id="library" className="hub-library">
        <p className="hub-eyebrow">The library</p>
        <h2 className="hub-section-title">Pick a game</h2>
        <div className="hub-games">
          {GAMES.map((g) => {
            const live = g.status === 'live';
            return (
              <article
                key={g.id}
                className={`game-card${live ? '' : ' is-soon'}`}
                style={{ '--accent': g.accent } as CSSProperties}
              >
                <div className="game-card-tile" style={{ background: g.accent }}>
                  <GameIcon gameId={g.id} accent={g.accent} />
                  <span className="game-card-status">{live ? 'Available now' : 'Coming soon'}</span>
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
              </article>
            );
          })}
        </div>
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
          <p>Start a Ticket to Ride room now. More games are on the way.</p>
        </div>
        <button type="button" className="hub-btn-primary" onClick={() => onSelect(FEATURED)}>
          Create a room
        </button>
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
