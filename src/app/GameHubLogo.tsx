/** The GameHub "GH" monogram — G and H drawn as twin parallel lines on a dark
 * rounded square (from the GameHub design). Used in the header and the favicon. */
export function GameHubLogo({ size = 40 }: { size?: number }) {
  const d = 'M45.5 30.5H28A19.5 19.5 0 0 0 28 69.5H37V41.5 M63 22V78 M86 78V22 M63 50H86';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="GameHub">
      <rect width="100" height="100" rx="22" fill="#0B0B0F" />
      <g transform="translate(14 11.9) scale(.7619)" fill="none" strokeLinejoin="miter">
        <path d={d} stroke="#FFFFFF" strokeWidth={17} />
        <path d={d} stroke="#0B0B0F" strokeWidth={5} />
      </g>
    </svg>
  );
}
