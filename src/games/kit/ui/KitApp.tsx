import { useState, type ReactNode } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { JoinGate } from '../../../online/ui/JoinGate';
import type { OnlineIntent } from '../../../online/useOnlineSession';
import type { DifficultyOption } from '../../../online/ui/OnlineLobby';
import { GameLanding } from '../../../shared/ui/GameLanding';
import { GameForm } from '../../../shared/ui/GameForm';

export interface LocalSetup {
  /** Seats including yours (the rest are bots). */
  seats: number;
  difficulty: string;
}

export interface KitAppConfig {
  gameId: string;
  title: string;
  /** e.g. "2–6 players · 10–20 min" */
  meta: string;
  /** Seat counts for a local game (you + bots). */
  localSeats: number[];
  /** Seat counts a host can pick for an online room. */
  onlineSeats: number[];
  defaultSeats: number;
  /** Bot levels for local play. */
  difficulties: DifficultyOption[];
  /** Label for the bot level field. */
  difficultyLabel?: string;
  /** The level picked at first (default: "normal", else the first). */
  defaultDifficulty?: string;
  /** How a local seat count reads ("You + 2 bots"). */
  seatLabel?: (seats: number) => string;
}

interface Props {
  config: KitAppConfig;
  onBackToHub: () => void;
  renderLocal: (setup: LocalSetup, onExit: () => void) => ReactNode;
  renderOnline: (intent: OnlineIntent, onExit: () => void, onCode: (code: string | null) => void) => ReactNode;
  /** More local options (Chess: which colour you play). */
  localExtra?: ReactNode;
  /** Game options shown for a local game and when hosting a room (Last Card's mode). */
  optionFields?: ReactNode;
  /** The options' current value, sent with a new room. */
  optionValue?: unknown;
}

const defaultSeatLabel = (n: number) => (n === 2 ? 'You + 1 bot' : `You + ${n - 1} bots`);

/** A kit game's flow below the hub – landing, create, join, an online room and a
 *  local game – each on its own URL (`/<game>`, `/create`, `/join?room=`, `/<code>`, `/play`). */
export function KitApp({ config, onBackToHub, renderLocal, renderOnline, localExtra, optionFields, optionValue }: Props) {
  const { gameId, title } = config;
  const { step, navigate, syncCode, exit } = useGameRoute(gameId, onBackToHub);
  const [setup, setSetup] = useState<LocalSetup>({
    seats: config.localSeats.includes(config.defaultSeats) ? config.defaultSeats : config.localSeats[0],
    difficulty:
      config.defaultDifficulty ?? config.difficulties.find((d) => d.value === 'normal')?.value ?? config.difficulties[0]?.value ?? 'normal',
  });
  const toLanding = () => navigate({ kind: 'landing' });
  const seatLabel = config.seatLabel ?? defaultSeatLabel;

  switch (step.kind) {
    case 'local':
      return <>{renderLocal(setup, exit)}</>;
    case 'online':
      return <>{renderOnline(step.intent, exit, syncCode)}</>;
    case 'create':
      return (
        <KitProfile
          config={config}
          onBack={toLanding}
          extra={optionFields}
          onSubmit={(name, seatCount) =>
            navigate({ kind: 'online', intent: { kind: 'start', seatCount, name, avatar: '', gameId, options: optionValue } })
          }
        />
      );
    case 'join':
      return (
        <JoinGate code={step.code} onBack={toLanding}>
          <KitProfile
            config={config}
            code={step.code}
            onBack={toLanding}
            onSubmit={(name) => navigate({ kind: 'online', intent: { kind: 'join', code: step.code, name, avatar: '', gameId } })}
          />
        </JoinGate>
      );
    case 'landing':
      return (
        <GameLanding
          title={title}
          meta={config.meta}
          onBack={exit}
          onJoin={(code) => navigate({ kind: 'join', code })}
          onStart={() => navigate({ kind: 'create' })}
          onLocal={() => navigate({ kind: 'local' })}
          localOptions={
            <>
              {config.localSeats.length > 1 && (
                <label className="g-field">
                  <span className="g-field-label">Players</span>
                  <select aria-label="Players" value={setup.seats} onChange={(e) => setSetup((s) => ({ ...s, seats: Number(e.target.value) }))}>
                    {config.localSeats.map((n) => (
                      <option key={n} value={n}>
                        {seatLabel(n)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {config.difficulties.length > 1 && (
                <label className="g-field">
                  <span className="g-field-label">{config.difficultyLabel ?? 'Bot difficulty'}</span>
                  <select
                    aria-label={config.difficultyLabel ?? 'Bot difficulty'}
                    value={setup.difficulty}
                    onChange={(e) => setSetup((s) => ({ ...s, difficulty: e.target.value }))}
                  >
                    {config.difficulties.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          }
          localMore={
            localExtra || optionFields ? (
              <>
                {optionFields}
                {localExtra}
              </>
            ) : undefined
          }
        />
      );
  }
}

/** Your name, plus – when hosting – how many seats the room has. */
function KitProfile({
  config,
  code,
  onBack,
  onSubmit,
  extra,
}: {
  config: KitAppConfig;
  code?: string;
  onBack: () => void;
  onSubmit: (name: string, seatCount: number) => void;
  /** Game options for the room (hosting only). */
  extra?: ReactNode;
}) {
  const hosting = code === undefined;
  const [name, setName] = useState('');
  const [seatCount, setSeatCount] = useState(
    config.onlineSeats.includes(config.defaultSeats) ? config.defaultSeats : config.onlineSeats[0],
  );
  return (
    <GameForm
      eyebrow={hosting ? `${config.title} · New room` : `${config.title} · Room ${code}`}
      title={hosting ? 'Set up your game' : 'Join the game'}
      subtitle={hosting ? "You'll get a room code to share next." : 'Pick the name the table will see.'}
      onBack={onBack}
      submitLabel={hosting ? 'Create game' : 'Join game'}
      canSubmit={name.trim().length > 0}
      blockedHint="Enter your name to continue."
      onSubmit={() => onSubmit(name.trim(), seatCount)}
    >
      <label className="g-field">
        <span className="g-field-label">Your name</span>
        <input className="g-input" aria-label="Your name" placeholder="e.g. Amey" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {hosting && config.onlineSeats.length > 1 && (
        <label className="g-field">
          <span className="g-field-label">Players</span>
          <select aria-label="Number of players" value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))}>
            {config.onlineSeats.map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </label>
      )}
      {hosting && extra}
    </GameForm>
  );
}
