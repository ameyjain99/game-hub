import { Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CloseIcon } from '../icons';
import { RulesContext, type GameRules, type RuleBlock, type RuleItem } from '../rules';

/** Text with **bold** marks. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function Items({ items, numbered, prefix, start }: { items: RuleItem[]; numbered: boolean; prefix: string; start: number }) {
  return (
    <ol className={numbered ? 'rules-steps' : 'rules-list'}>
      {items.map((item, i) => {
        const label = numbered ? `${prefix}${start + i}` : null;
        const text = typeof item === 'string' ? item : item.text;
        return (
          <li key={i}>
            {label && <span className="rules-num">{label}</span>}
            <span className="rules-item">
              <Rich text={text} />
              {typeof item !== 'string' && (
                <ol className="rules-sub">
                  {item.sub.map((s, j) => (
                    <li key={j}>
                      <span className="rules-num">{LETTERS[j]}</span>
                      <span className="rules-item">
                        <Rich text={typeof s === 'string' ? s : s.text} />
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Blocks({ blocks, n }: { blocks: RuleBlock[]; n: number }) {
  let counter = 1; // steps continue across a section's step lists
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'p':
            return (
              <p key={i} className="rules-p">
                <Rich text={b.text} />
              </p>
            );
          case 'steps': {
            const start = counter;
            counter += b.items.length;
            return <Items key={i} items={b.items} numbered prefix={`${n}.`} start={start} />;
          }
          case 'list':
            return <Items key={i} items={b.items} numbered={false} prefix="" start={1} />;
          case 'figure': {
            const Picture = b.render;
            return (
              <figure key={i} className="rules-figure">
                <div className="rules-figure-art">
                  <Picture />
                </div>
                {b.caption && (
                  <figcaption>
                    <Rich text={b.caption} />
                  </figcaption>
                )}
              </figure>
            );
          }
          case 'note':
            return (
              <p key={i} className="rules-note">
                <Rich text={b.text} />
              </p>
            );
          case 'terms':
            return (
              <dl key={i} className="rules-terms">
                {b.items.map(([term, def]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>
                      <Rich text={def} />
                    </dd>
                  </div>
                ))}
              </dl>
            );
          case 'table':
            return (
              <div key={i} className="rules-table-wrap">
                <table className="rules-table">
                  <thead>
                    <tr>
                      {b.head.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>
                            <Rich text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

/** A game's rules in a sheet over the screen: contents, a tab per variant, numbered sections. */
export function RulesSheet({ rules, variant, onClose }: { rules: GameRules; variant?: string; onClose: () => void }) {
  const [active, setActive] = useState(() => (rules.variants.some((v) => v.id === variant) ? variant! : rules.variants[0].id));
  const current = rules.variants.find((v) => v.id === active) ?? rules.variants[0];
  const book = current.book;
  const body = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
  }, [active]);

  return createPortal(
    <div className="rules-backdrop" onClick={onClose}>
      <aside className="rules-sheet" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}>
        <header className="rules-head">
          <div>
            <p className="rules-kicker">How to play</p>
            <h2 id="rules-title">{rules.title}</h2>
          </div>
          <button ref={close} type="button" className="g-icon-btn" aria-label="Close the rules" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </header>
        {rules.variants.length > 1 && (
          <div className="rules-tabs" role="tablist" aria-label="Versions">
            {rules.variants.map((v) => (
              <button key={v.id} type="button" role="tab" aria-selected={v.id === active} className="rules-tab" onClick={() => setActive(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        )}
        <div className="rules-body" ref={body}>
          <p className="rules-summary">
            <Rich text={book.summary} />
          </p>
          <nav className="rules-toc" aria-label="Contents">
            <ol>
              {book.sections.map((s, i) => (
                <li key={s.title}>
                  <button type="button" onClick={() => body.current?.querySelector(`#rules-s${i + 1}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>
                    <span>{i + 1}</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          {book.sections.map((s, i) => (
            <section key={s.title} id={`rules-s${i + 1}`} className="rules-section" aria-labelledby={`rules-h${i + 1}`}>
              <h3 id={`rules-h${i + 1}`}>
                <span>{i + 1}</span>
                {s.title}
              </h3>
              <Blocks blocks={s.blocks} n={i + 1} />
            </section>
          ))}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/** The rules behind a button: an icon in a game's header, or a "How to play" link. */
export function RulesButton({ rules, variant, as = 'icon' }: { rules?: GameRules; variant?: string; as?: 'icon' | 'link' }) {
  const ctx = useContext(RulesContext);
  const book = rules ?? ctx.rules;
  const [open, setOpen] = useState(false);
  if (!book) return null;
  const opener: ReactNode =
    as === 'icon' ? (
      <button type="button" className="g-icon-btn" aria-label="Rules" title="Rules" onClick={() => setOpen(true)}>
        <BookOpen size={16} />
      </button>
    ) : (
      <button type="button" className="rules-link" onClick={() => setOpen(true)}>
        <BookOpen size={15} aria-hidden="true" />
        How to play
      </button>
    );
  return (
    <>
      {opener}
      {open && <RulesSheet rules={book} variant={variant ?? ctx.variant} onClose={() => setOpen(false)} />}
    </>
  );
}
