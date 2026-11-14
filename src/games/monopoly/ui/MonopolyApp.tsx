import { useState } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { JoinGate } from '../../../online/ui/JoinGate';
import { GameLanding } from '../../../shared/ui/GameLanding';
import { DEFAULT_SETTINGS, type MonopolyDifficulty, type Settings } from '../engine/state';
import { MonopolyLocalGame } from './MonopolyLocalGame';
import { MonopolyOnlineGame } from './MonopolyOnlineGame';
import { MonopolyProfile } from './MonopolyProfile';
import { HOUSE_RULES, HouseRuleSwitches, StartingCashField } from './MonopolyRules';

/** The Monopoly experience below the hub. Every step has its own URL
 *  (`/monopoly`, `/create`, `/join?room=`, `/<code>`, `/play`). */
export function MonopolyApp({ onBackToHub }: { onBackToHub: () => void }) {
  const { step, navigate, syncCode, exit } = useGameRoute('monopoly', onBackToHub);
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<MonopolyDifficulty>('normal');
  const [localRules, setLocalRules] = useState<Settings>(DEFAULT_SETTINGS);
  const toLanding = () => navigate({ kind: 'landing' });
  const rulesOn = HOUSE_RULES.filter((r) => localRules[r.key]).length;

  switch (step.kind) {
    case 'local':
      return <MonopolyLocalGame playerCount={playerCount} difficulty={difficulty} settings={localRules} onBackToHub={exit} />;
    case 'online':
      return <MonopolyOnlineGame intent={step.intent} onExit={exit} onCode={syncCode} />;
    case 'create':
      return (
        <MonopolyProfile
          action="start"
          onBack={toLanding}
          onSubmit={(name, seatCount, settings) =>
            navigate({ kind: 'online', intent: { kind: 'start', seatCount: seatCount!, name, avatar: '', gameId: 'monopoly', options: settings } })
          }
        />
      );
    case 'join':
      return (
        <JoinGate code={step.code} onBack={toLanding}>
          <MonopolyProfile
            action="join"
            code={step.code}
            onBack={toLanding}
            onSubmit={(name) =>
              navigate({ kind: 'online', intent: { kind: 'join', code: step.code, name, avatar: '', gameId: 'monopoly' } })
            }
          />
        </JoinGate>
      );
    case 'landing':
      return (
        <GameLanding
          title="Monopoly"
          meta="2–6 players · 60–120 min"
          onBack={exit}
          onJoin={(code) => navigate({ kind: 'join', code })}
          onStart={() => navigate({ kind: 'create' })}
          onLocal={() => navigate({ kind: 'local' })}
          localOptions={
            <>
              <label className="g-field">
                <span className="g-field-label">Players</span>
                <select aria-label="Players" value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      You + {n - 1} {n === 2 ? 'bot' : 'bots'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="g-field">
                <span className="g-field-label">Bot difficulty</span>
                <select aria-label="Bot difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as MonopolyDifficulty)}>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </>
          }
          localMore={
            <details className="g-disclosure">
              <summary>
                House rules
                <span className="g-disclosure-meta">
                  ${localRules.startingCash.toLocaleString()} · {rulesOn} on
                </span>
              </summary>
              <div className="g-disclosure-body">
                <StartingCashField value={localRules.startingCash} onChange={(c) => setLocalRules((r) => ({ ...r, startingCash: c }))} />
                <HouseRuleSwitches value={localRules} onChange={setLocalRules} />
              </div>
            </details>
          }
        />
      );
  }
}
