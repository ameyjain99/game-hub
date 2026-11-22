/** Minecraft's rule-book picture: some of the blocks, painted with the game's own textures. */
import { useEffect, useRef } from 'react';
import { BLOCKS } from '../world';
import { ATLAS_COLS, TILE_PX, paintAtlas } from './textures';

const SHOWN = BLOCKS.filter((b) => b.placeable).slice(0, 8);

export function Blocks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    try {
      const atlas = paintAtlas();
      ctx.imageSmoothingEnabled = false;
      SHOWN.forEach((b, i) => {
        const tile = b.tiles[1];
        ctx.drawImage(atlas, (tile % ATLAS_COLS) * TILE_PX, Math.floor(tile / ATLAS_COLS) * TILE_PX, TILE_PX, TILE_PX, i * 44, 0, 40, 40);
      });
    } catch {
      /* no canvas here: the names below still read */
    }
  }, []);
  return (
    <div className="rf-col">
      <canvas ref={ref} width={SHOWN.length * 44} height={40} style={{ imageRendering: 'pixelated' }} />
      <span className="rf-label">{SHOWN.map((b) => b.name).join(' · ')}</span>
    </div>
  );
}
