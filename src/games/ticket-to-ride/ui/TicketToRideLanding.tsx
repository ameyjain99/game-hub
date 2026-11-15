import { GameLanding } from '../../../shared/ui/GameLanding';
import { RulesContext } from '../../../shared/rules';
import { TTR_RULES } from '../rules';

interface Props {
  onStart: () => void;
  onJoin: (code: string) => void;
  onLocal: () => void;
  /** Return to the game hub, when launched from it. */
  onBackToHub?: () => void;
}

/** Ticket to Ride's front door: the hub's shared landing. The board, mode and
 *  players are picked on the next page, online or on this device. */
export function TicketToRideLanding({ onStart, onJoin, onLocal, onBackToHub }: Props) {
  return (
    <RulesContext.Provider value={{ rules: TTR_RULES }}>
      <GameLanding
        title="Ticket to Ride"
        meta="2-5 players · 30-60 min"
        onBack={onBackToHub ?? (() => window.history.back())}
        onJoin={(code) => onJoin(code)}
        onStart={() => onStart()}
        onLocal={() => onLocal()}
        localOptions={<p className="g-hint">You pick the board, the mode, the players and the bots next.</p>}
      />
    </RulesContext.Provider>
  );
}
