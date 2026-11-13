interface Props {
  playerName: string;
  color: string;
  onReady: () => void;
}

/** Hotseat hand-off gate: hides the previous player's hand between turns. */
export function PassScreen({ playerName, color, onReady }: Props) {
  return (
    <div className="pass-screen" data-testid="pass-screen">
      <div className="pass-card" style={{ borderColor: color }}>
        <span className="pass-token" style={{ background: color }} />
        <h2>Pass the device to</h2>
        <p className="pass-name">{playerName}</p>
        <button type="button" className="primary" onClick={onReady}>
          I'm ready
        </button>
      </div>
    </div>
  );
}
