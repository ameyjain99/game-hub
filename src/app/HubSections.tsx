/** The home page's About, Open source and FAQ sections. */
import { useEffect, useState } from 'react';
import { CATEGORIES } from '../games/registry';
import { AddIcon, BookOpen, Bot, Bug, CodeXml, ExternalLinkIcon, EyeOff, GitPullRequest, Link2, Video } from '../shared/icons';
import { REPO_LINKS, REPO_URL, type Contributor } from '../shared/project';

const POINTS: { icon: typeof BookOpen; title: string; text: string }[] = [
  {
    icon: BookOpen,
    title: 'The real rules',
    text: 'Each game follows its official rulebook, awkward cases included, and carries the whole rule book in the app, with a tab for every version.',
  },
  {
    icon: Video,
    title: 'Faces at the table',
    text: 'Voice and video seats keep everyone talking, bluffing and laughing across the board, like a real game night.',
  },
  {
    icon: Bot,
    title: 'Never a seat short',
    text: 'Bots at several levels fill empty seats and can take over for anyone who drops, so the game goes on.',
  },
  {
    icon: Link2,
    title: 'No accounts, no installs',
    text: 'Open a room, send the code or an invite link, and everyone plays from their own browser.',
  },
  {
    icon: EyeOff,
    title: 'Hidden stays hidden',
    text: 'Cards and secrets are dealt on the server, so each screen shows only what that player is meant to see.',
  },
  {
    icon: CodeXml,
    title: 'Free and open source',
    text: 'No ads and no sign-up. The code is on GitHub for anyone to read, fix or build on.',
  },
];

/** What GameHub is, and what every game on it is built to. */
export function HubAbout() {
  return (
    <section id="about" className="hub-about" aria-labelledby="hub-about-title">
      <div className="hub-about-head">
        <div>
          <p className="hub-eyebrow">About GameHub</p>
          <h2 id="hub-about-title" className="hub-section-title">
            Made to feel like the real table.
          </h2>
        </div>
        <p className="hub-about-lead">
          GameHub is a free, open-source home for playing board games together in the browser. We build every game to
          look like a beautiful version of the real thing, to feel alive while you play, and to follow its real rules
          exactly.
        </p>
      </div>
      <ul className="hub-points">
        {POINTS.map(({ icon: Icon, title, text }, i) => (
          <li key={title}>
            <span className="hub-point-icon" style={{ background: CATEGORIES[i % CATEGORIES.length].color }} aria-hidden="true">
              <Icon size={20} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** GitHub serves avatars at any size; ask for twice the shown size for sharp screens. */
const avatarAt = (src: string, px: number) => {
  const url = new URL(src);
  url.searchParams.set('s', String(px * 2));
  return url.href;
};
/** Outside links open in a new tab, so the table stays where it was. */
const out = { target: '_blank', rel: 'noreferrer' } as const;

/** The GitHub repository, how to help, and the people who built GameHub. */
export function HubOpenSource() {
  // null while the list loads; [] when the server couldn't get one.
  const [people, setPeople] = useState<Contributor[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/contributors')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: unknown) => live && setPeople(Array.isArray(list) ? (list as Contributor[]) : []))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="open-source" className="hub-open" aria-labelledby="hub-open-title">
      <div className="hub-open-text">
        <p className="hub-eyebrow">Open source</p>
        <h2 id="hub-open-title" className="hub-section-title">
          Built in the open.
        </h2>
        <p className="hub-open-lead">
          GameHub's code, boards and rule books are on GitHub under the MIT licence. Anyone can report a bug, suggest a
          game or send a pull request, and every change is held to the same{' '}
          <a href={REPO_LINKS.standards} {...out}>
            game standard
          </a>
          .
        </p>
        <div className="hub-open-actions">
          <a className="hub-btn-primary" href={REPO_URL} {...out}>
            <CodeXml size={18} aria-hidden="true" />
            View on GitHub
          </a>
          <a className="hub-btn-ghost" href={REPO_LINKS.contributing} {...out}>
            <GitPullRequest size={18} aria-hidden="true" />
            Contributing guide
          </a>
          <a className="hub-btn-ghost" href={REPO_LINKS.issues} {...out}>
            <Bug size={18} aria-hidden="true" />
            Report a bug
          </a>
        </div>
      </div>

      <div className="hub-people" aria-busy={people === null}>
        <div className="hub-people-head">
          <h3>Contributors</h3>
          {people && people.length > 0 && <span>{plural(people.length, 'person', 'people')}</span>}
        </div>
        <ul className="hub-people-list">
          {people === null
            ? [0, 1, 2].map((i) => (
                <li key={i} className="hub-person is-loading" aria-hidden="true">
                  <span className="hub-person-face" />
                  <span className="hub-person-name" />
                </li>
              ))
            : people.map((p) => (
                <li key={p.login} className="hub-person">
                  <a href={p.url} {...out} aria-label={`${p.login}, ${plural(p.contributions, 'commit', 'commits')}`}>
                    <img className="hub-person-face" src={avatarAt(p.avatar, 56)} alt="" width={56} height={56} loading="lazy" />
                    <span className="hub-person-name">{p.login}</span>
                    <span className="hub-person-meta">{plural(p.contributions, 'commit', 'commits')}</span>
                  </a>
                </li>
              ))}
          {people !== null && (
            <li className="hub-person is-you">
              <a href={REPO_LINKS.contributing} {...out}>
                <span className="hub-person-face">
                  <AddIcon size={22} aria-hidden="true" />
                </span>
                <span className="hub-person-name">You?</span>
                <span className="hub-person-meta">Join in</span>
              </a>
            </li>
          )}
        </ul>
        <a className="hub-people-all" href={REPO_LINKS.contributors} {...out}>
          See everyone on GitHub
          <ExternalLinkIcon size={13} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

const FAQ: { q: string; a: string }[] = [
  { q: 'Is GameHub free?', a: 'Yes. There are no ads, no accounts and nothing to install: it runs in your browser.' },
  {
    q: 'How do my friends join?',
    a: 'Open a game and start a room to get its code. Friends type the code into Join a room on this page, or open the invite link you send them.',
  },
  {
    q: 'How many people can play?',
    a: "It depends on the game. Solitaire, Sudoku and Minesweeper are for one; Lineup seats up to twelve in teams. Each game's card shows its count.",
  },
  {
    q: 'Can I play on my own?',
    a: 'Yes. Choose Play on this device to play against bots at the level you pick, or try one of the solo games.',
  },
  {
    q: "What if someone's connection drops?",
    a: "Their seat waits for them, and they can rejoin from the same browser. If they don't come back, anyone still at the table can hand the seat to a bot so the game goes on.",
  },
  {
    q: 'Can we see and hear each other?',
    a: 'Yes. Everyone at the table has a video seat; switch your camera and microphone on when you like. Voice and video go straight between your browsers, not through our server.',
  },
  {
    q: 'Do the games follow the real rules?',
    a: "As closely as we can make them. Every game carries its full rule book (the book button during play), and where the official rules leave a gap, the book says what GameHub decided. Some games have GameHub's own names and art, but play like the classics they're based on.",
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes, in any modern browser on a phone, tablet or computer. A bigger screen gives the board more room.',
  },
];

/** Short answers to what people ask before their first game. */
export function HubFaq() {
  return (
    <section id="faq" className="hub-faq" aria-labelledby="hub-faq-title">
      <div className="hub-faq-head">
        <p className="hub-eyebrow">FAQ</p>
        <h2 id="hub-faq-title" className="hub-section-title">
          Questions, answered
        </h2>
        <p className="hub-faq-ask">
          Something else?{' '}
          <a href={REPO_LINKS.issues} {...out}>
            Ask on GitHub
          </a>
          .
        </p>
      </div>
      <div className="hub-faq-list">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="hub-q">
            <summary>
              <span>{q}</span>
              <AddIcon size={18} aria-hidden="true" />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
