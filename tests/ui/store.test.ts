import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../src/games/ticket-to-ride/ui/store';

function start() {
  useGame.getState().startGame(
    [
      { name: 'Human', isAI: false },
      { name: 'Bot', isAI: true, difficulty: 'normal' },
    ],
    7,
  );
}

describe('game store', () => {
  beforeEach(() => useGame.getState().reset());

  it('starts a game and populates state', () => {
    start();
    const s = useGame.getState().state;
    expect(s).not.toBeNull();
    expect(s!.players.length).toBe(2);
    expect(s!.phase).toBe('setup-tickets');
  });

  it('records an illegal action in lastError without changing state', () => {
    start();
    const before = useGame.getState().state;
    // claiming a route during setup is illegal
    useGame.getState().dispatch({
      type: 'CLAIM_ROUTE',
      routeId: 'boston-new-york',
      combo: { color: 'yellow', colorCount: 2, locomotives: 0 },
    });
    const after = useGame.getState();
    expect(after.lastError).not.toBeNull();
    expect(after.state).toBe(before); // unchanged reference
  });

  it('applies a legal action', () => {
    start();
    const s = useGame.getState().state!;
    const p0 = s.players[0];
    useGame.getState().dispatch({
      type: 'CONFIRM_SETUP_TICKETS',
      playerId: p0.id,
      keptIds: p0.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    expect(useGame.getState().state!.players[0].tickets.length).toBe(2);
    expect(useGame.getState().lastError).toBeNull();
  });

  it('runAiTurnIfNeeded advances when it is an AI move', () => {
    start();
    // confirm the human's setup tickets so only the AI remains pending
    const p0 = useGame.getState().state!.players[0];
    useGame.getState().dispatch({
      type: 'CONFIRM_SETUP_TICKETS',
      playerId: p0.id,
      keptIds: p0.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    const acted = useGame.getState().runAiTurnIfNeeded();
    expect(acted).toBe(true);
    // AI confirmed -> game moves to the play phase
    expect(useGame.getState().state!.phase).toBe('turn');
  });

  it('runAiTurnIfNeeded does nothing on a human turn', () => {
    start();
    // Drive both setups so play begins with the human (player 0).
    const st = () => useGame.getState().state!;
    for (const p of st().players) {
      useGame.getState().dispatch({
        type: 'CONFIRM_SETUP_TICKETS',
        playerId: p.id,
        keptIds: p.pendingTickets.slice(0, 2).map((t) => t.id),
      });
    }
    expect(st().phase).toBe('turn');
    expect(st().players[st().current].isAI).toBe(false);
    expect(useGame.getState().runAiTurnIfNeeded()).toBe(false);
  });
});
