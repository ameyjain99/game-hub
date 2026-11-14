import { useEffect, useState, type PointerEvent } from 'react';
import { Circle } from '../../../../shared/icons';
import { bendKey } from '../data/routeCurves';
import type { Pt } from '../geometry';
import { Board } from '../components/Board';
import { formatLayout, layoutPath, type BoardLayout } from '../../engine/data/layout';
import { EDITABLE_MAPS, type EditableMap } from './maps';

/**
 * Dev-only visual editor for a map's board layout (`npm run dev`, then `/?editor=<mapId>`).
 * Drag cities and route-bend handles over a reference image of the printed board;
 * Save writes the map's `<mapId>.layout.json` through the dev server (see vite.config.ts).
 * The reference image stays in this browser – it is never bundled or committed.
 */

type Drag = { kind: 'city'; id: string } | { kind: 'bend'; key: string; a: string; b: string };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked – the editor still works for this session
  }
}

function toBoard(e: PointerEvent<SVGGElement>): Pt {
  const svg = e.currentTarget.ownerSVGElement!;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

export default function BoardEditor() {
  const mapId = new URLSearchParams(location.search).get('editor') || 'usa';
  const map = EDITABLE_MAPS[mapId];
  if (!map) {
    return (
      <p style={{ padding: 16 }}>
        Unknown map "{mapId}". Available: {Object.keys(EDITABLE_MAPS).join(', ')}
      </p>
    );
  }
  return <MapEditor key={mapId} mapId={mapId} map={map} />;
}

function MapEditor({ mapId, map }: { mapId: string; map: EditableMap }) {
  const draftKey = `ttr-editor-draft:${mapId}`;
  const imageKey = `ttr-editor-image:${mapId}`;
  const [layout, setLayout] = useState<BoardLayout>(() => read<BoardLayout>(draftKey) ?? map.layout);
  const [image, setImage] = useState<string | null>(() => read<string>(imageKey));
  const [opacity, setOpacity] = useState(0.5);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [status, setStatus] = useState('');

  const dirty = formatLayout(layout) !== formatLayout(map.layout);
  // Keep a draft only while there are unsaved changes, so the saved file stays the source of truth.
  useEffect(() => write(draftKey, dirty ? layout : null), [draftKey, layout, dirty]);
  useEffect(() => write(imageKey, image), [imageKey, image]);

  // One bend handle per distinct curve (both rails of a double route share one).
  const curves = map.routes.filter((r, i) => map.routes.findIndex((o) => bendKey(o) === bendKey(r)) === i);
  const cities = map.cities.map((c) => {
    const [x, y] = layout.cities[c.id] ?? [c.x, c.y];
    return { ...c, x, y };
  });
  const pos = (id: string) => cities.find((c) => c.id === id)!;
  const mid = (a: string, b: string) => ({ x: (pos(a).x + pos(b).x) / 2, y: (pos(a).y + pos(b).y) / 2 });

  const onMove = (e: PointerEvent<SVGGElement>) => {
    if (!drag) return;
    const p = toBoard(e);
    if (drag.kind === 'city') {
      setLayout((l) => ({ ...l, cities: { ...l.cities, [drag.id]: [p.x, p.y] } }));
    } else {
      const m = mid(drag.a, drag.b);
      setLayout((l) => ({ ...l, bends: { ...l.bends, [drag.key]: [Math.round(p.x - m.x), Math.round(p.y - m.y)] } }));
    }
  };

  const startDrag = (e: PointerEvent<SVGElement>, d: Drag) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(d);
  };

  const straighten = (key: string) =>
    setLayout((l) => {
      const bends = { ...l.bends };
      delete bends[key];
      return { ...l, bends };
    });

  const loadImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setStatus('Saving...');
    try {
      const res = await fetch('/__board-editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: mapId, layout }),
      });
      setStatus(res.ok ? `Saved to ${layoutPath(mapId)}` : `Save failed: ${await res.text()}`);
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`);
    }
  };

  return (
    <div style={{ padding: 12, maxWidth: 1500, margin: '0 auto', fontSize: 13 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <strong>Board editor · {mapId}</strong>
        <button onClick={save} disabled={!dirty}>
          Save
        </button>
        <button onClick={() => setLayout(map.layout)} disabled={!dirty}>
          Discard changes
        </button>
        <span>{dirty ? <><Circle size={9} fill="currentColor" /> Unsaved changes</> : status}</span>
        <label>
          Reference image (crop to the board's frame){' '}
          <input type="file" accept="image/*" onChange={(e) => loadImage(e.target.files?.[0])} />
        </label>
        <label>
          Opacity{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
        {image && <button onClick={() => setImage(null)}>Remove image</button>}
        <span style={{ opacity: 0.7 }}>
          Drag blue rings (cities) and diamonds (route bends). Double-click a diamond to straighten.
        </span>
      </div>

      <Board
        claimedBy={{}}
        playerColors={{}}
        cities={cities}
        routes={map.routes}
        bends={layout.bends}
        underlay={
          image && (
            <image href={image} x={0} y={0} width={1000} height={700} preserveAspectRatio="none" opacity={opacity} />
          )
        }
      >
        <g onPointerMove={onMove} onPointerUp={() => setDrag(null)} style={{ cursor: 'grab' }}>
          {curves.map((r) => {
            const key = bendKey(r);
            const m = mid(r.a, r.b);
            const [dx, dy] = layout.bends[key] ?? [0, 0];
            const x = m.x + dx;
            const y = m.y + dy;
            return (
              <rect
                key={key}
                x={x - 4}
                y={y - 4}
                width={8}
                height={8}
                transform={`rotate(45 ${x} ${y})`}
                fill="#fff"
                stroke="#e0115f"
                strokeWidth={1.5}
                onPointerDown={(e) => startDrag(e, { kind: 'bend', key, a: r.a, b: r.b })}
                onDoubleClick={() => straighten(key)}
              >
                <title>{key}</title>
              </rect>
            );
          })}
          {cities.map((c) => (
            <circle
              key={c.id}
              cx={c.x}
              cy={c.y}
              r={10}
              fill="#0a6cff"
              fillOpacity={0.12}
              stroke="#0a6cff"
              strokeWidth={1.5}
              onPointerDown={(e) => startDrag(e, { kind: 'city', id: c.id })}
            >
              <title>{c.name}</title>
            </circle>
          ))}
        </g>
      </Board>
    </div>
  );
}
