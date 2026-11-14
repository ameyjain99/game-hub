import { useState } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { JoinGate } from '../../../online/ui/JoinGate';
import { GameLanding } from '../../../shared/ui/GameLanding';
import { GameForm } from '../../../shared/ui/GameForm';
import type { CluedoDifficulty } from '../engine/state';
import { CluedoLocalGame } from './CluedoLocalGame';
import { CluedoOnlineGame } from './CluedoOnlineGame';

/** Name (and, when hosting, table size) before going online. */
function CluedoProfile({
  hosting,
  code,
  onBack,
  onSubmit,
}: {
  hosting: boolean;
  code?: string;
  onBack: () => void;
  onSubmit: (name: string, seats: number) => void;
}) {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState(4);
  return (
    <GameForm
      eyebrow={hosting ? 'Cluedo · New room' : `Cluedo · Room ${code}`}
      title={hosting ? 'Set up your game' : 'Join the game'}
      subtitle={hosting ? "You'll get a room code to share next." : 'Pick the name the table will see.'}
      onBack={onBack}
      submitLabel={hosting ? 'Create game' : 'Join game'}
      canSubmit={name.trim().length > 0}
      blockedHint="Enter your name to continue."
      onSubmit={() => onSubmit(name.trim(), seats)}
    >
      <label className="g-field">
        <span className="g-field-label">Your name</span>
        <input className="g-input" aria-label="Your name" placeholder="e.g. Amey" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {hosting && (
        <label className="g-field">
          <span className="g-field-label">Players</span>
          <select aria-label="Number of players" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </label>
      )}
    </GameForm>
  );
}

/** The Cluedo experience below the hub. Every step has its own URL
 *  (`/cluedo`, `/create`, `/join?room=`, `/<code>`, `/play`). */
export function CluedoApp({ onBackToHub }: { onBackToHub: () => void }) {
  const { step, navigate, syncCode, exit } = useGameRoute('cluedo', onBackToHub);
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<CluedoDifficulty>('normal');
  const toLanding = () => navigate({ kind: 'landing' });

  switch (step.kind) {
    case 'local':
      return <CluedoLocalGame playerCount={playerCount} difficulty={difficulty} onBackToHub={exit} />;
    case 'online':
      return <CluedoOnlineGame intent={step.intent} onExit={exit} onCode={syncCode} />;
    case 'create':
      return (
        <CluedoProfile
          hosting
          onBack={toLanding}
          onSubmit={(name, seatCount) =>
            navigate({ kind: 'online', intent: { kind: 'start', seatCount, name, avatar: '', gameId: 'cluedo' } })
          }
        />
      );
    case 'join':
      return (
        <JoinGate code={step.code} onBack={toLanding}>
          <CluedoProfile
            hosting={false}
            code={step.code}
            onBack={toLanding}
            onSubmit={(name) => navigate({ kind: 'online', intent: { kind: 'join', code: step.code, name, avatar: '', gameId: 'cluedo' } })}
          />
        </JoinGate>
      );
    case 'landing':
      return (
        <GameLanding
          title="Cluedo"
          meta="3–6 players · 20–45 min"
          onBack={exit}
          onJoin={(code) => navigate({ kind: 'join', code })}
          onStart={() => navigate({ kind: 'create' })}
          onLocal={() => navigate({ kind: 'local' })}
          localOptions={
            <>
              <label className="g-field">
                <span className="g-field-label">Players</span>
                <select aria-label="Players" value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      You + {n - 1} bots
                    </option>
                  ))}
                </select>
              </label>
              <label className="g-field">
                <span className="g-field-label">Bot difficulty</span>
                <select aria-label="Bot difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as CluedoDifficulty)}>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                </select>
              </label>
            </>
          }
        />
      );
  }
}
