import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EVT, type Presence } from '../../../net/protocol';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import type { BlockyardAction, BlockyardState } from '../engine';
import { BLOCKS, B, DEFAULT_HOTBAR, PALETTE, coordsOf, generate, inBounds, index, spawnPoint } from '../world';
import { BlockyardScene, type AvatarPose } from './scene';
import { EYE, blockName, inWater, overlapsBody, pick, step, type Body } from './player';
import { blockIcon, paintAtlas } from './textures';
import { playBreak, playFootstep, playPlace } from './sound';

/** The world as this client holds it: the generated blocks plus edits applied so far. */
function buildWorld(seed: number, edits: Record<number, number>) {
  const blocks = generate(seed);
  for (const [i, b] of Object.entries(edits)) blocks[Number(i)] = b;
  return { seed, blocks, applied: { ...edits } as Record<number, number> };
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};

/** The Blockyard screen: a first-person view of the shared world, with the hotbar and palette. */
export function BlockyardGame({
  view,
  meId,
  nameFor,
  onAction,
  onExit,
  exitLabel,
  online,
  onNewWorld,
}: KitScreenProps<BlockyardState, BlockyardAction> & { onNewWorld?: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BlockyardScene | null>(null);
  const world = useRef<ReturnType<typeof buildWorld> | null>(null);
  const body = useRef<Body | null>(null);
  const look = useRef({ yaw: Math.PI * 0.25, pitch: -0.15 });
  const keys = useRef(new Set<string>());
  const atlas = useMemo(() => paintAtlas(), []);
  const icons = useMemo(() => BLOCKS.map((b) => blockIcon(atlas, b.tiles)), [atlas]);
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');

  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hotbar, setHotbar] = useState<number[]>(DEFAULT_HOTBAR);
  const [slot, setSlot] = useState(0);
  const [palette, setPalette] = useState(false);
  const [hud, setHud] = useState({ x: 0, y: 0, z: 0, target: '', flying: false, swimming: false });
  const held = useRef({ hotbar, slot });
  held.current = { hotbar, slot };
  const act = useRef(onAction);
  act.current = onAction;

  const players = view.players;
  const colorOf = (id: string) => players.find((p) => p.id === id)?.color ?? '#fff';
  const people = useRef({ colorOf, nameFor });
  people.current = { colorOf, nameFor };

  /** Change a block here at once, then tell the table. */
  const setBlock = (i: number, b: number) => {
    const w = world.current;
    if (!w) return;
    w.blocks[i] = b;
    w.applied[i] = b;
    const [x, , z] = coordsOf(i);
    sceneRef.current?.blockChanged(x, z);
    act.current({ type: 'SET', i, b });
  };

  // A new seed (a new world) rebuilds everything; otherwise only fresh edits apply.
  useEffect(() => {
    const w = world.current;
    if (!w || w.seed !== view.seed) {
      world.current = buildWorld(view.seed, view.edits);
      const [x, y, z] = spawnPoint(world.current.blocks);
      body.current = { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false, flying: false };
      sceneRef.current?.setWorld(world.current.blocks);
      return;
    }
    for (const [key, b] of Object.entries(view.edits)) {
      const i = Number(key);
      if (w.applied[i] === b) continue;
      w.applied[i] = b;
      w.blocks[i] = b;
      const [x, , z] = coordsOf(i);
      sceneRef.current?.blockChanged(x, z);
    }
  }, [view.seed, view.edits]);

  // The renderer and the game loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !world.current) return;
    let scene: BlockyardScene;
    try {
      scene = new BlockyardScene(canvas, world.current.blocks, atlas);
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    const fit = () => scene.resize(wrap.clientWidth, wrap.clientHeight);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(wrap);
    scene.rebuild(); // the whole world, before the first frame

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let sentAt = 0;
    let lastSent = '';
    let stepDist = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const b = body.current!;
      const w = world.current!;
      const k = keys.current;
      let forward = 0;
      let strafe = 0;
      for (const code of k) {
        const m = MOVE_KEYS[code];
        if (m) {
          forward += m[0];
          strafe += m[1];
        }
      }
      const live = document.pointerLockElement === canvas;
      const input = {
        forward: live ? Math.sign(forward) : 0,
        strafe: live ? Math.sign(strafe) : 0,
        jump: live && k.has('Space'),
        down: live && (k.has('ShiftLeft') || k.has('ShiftRight')),
        sprint: live && (k.has('ControlLeft') || k.has('ShiftLeft')) && !b.flying,
        yaw: look.current.yaw,
      };
      const before = [b.x, b.z];
      step(w.blocks, b, input, dt);
      if (b.onGround && !b.flying) {
        stepDist += Math.hypot(b.x - before[0], b.z - before[1]);
        if (stepDist > 1.9) {
          stepDist = 0;
          playFootstep();
        }
      }
      scene.camera.position.set(b.x, b.y + EYE, b.z);
      scene.camera.rotation.set(look.current.pitch, look.current.yaw, 0);
      const hit = live ? pick(w.blocks, b.x, b.y + EYE, b.z, look.current.yaw, look.current.pitch) : null;
      scene.target(hit);
      scene.rebuild(2);
      scene.render(dt);

      if (now - hudAt > 150) {
        hudAt = now;
        setHud({ x: Math.floor(b.x), y: Math.floor(b.y), z: Math.floor(b.z), target: hit ? blockName(hit.block) : '', flying: b.flying, swimming: inWater(w.blocks, b) });
      }
      // Tell the table where we are, ten times a second when moving.
      if (online?.socket && online.code && now - sentAt > 100) {
        const pose = { x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), yaw: +look.current.yaw.toFixed(2), pitch: +look.current.pitch.toFixed(2) };
        const key = JSON.stringify(pose);
        if (key !== lastSent || now - sentAt > 2000) {
          online.socket.emit(EVT.presence, { code: online.code, from: meId, data: pose } satisfies Presence);
          lastSent = key;
          sentAt = now;
        }
      }
    };
    raf = requestAnimationFrame(loop);

    // Other builders.
    const seen = new Map<string, number>();
    const onPresence = (p: Presence) => {
      if (p.from === meId) return;
      seen.set(p.from, performance.now());
      scene.setAvatar(p.from, p.data as AvatarPose, people.current.colorOf(p.from), people.current.nameFor(p.from));
    };
    online?.socket?.on(EVT.presence, onPresence);
    const sweep = setInterval(() => {
      for (const [id, at] of seen) if (performance.now() - at > 6000) {
        scene.setAvatar(id, null, '', '');
        seen.delete(id);
      }
    }, 2000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(sweep);
      online?.socket?.off(EVT.presence, onPresence);
      ro?.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [online?.socket, online?.code, meId, atlas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse and keyboard.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onLock = () => setLocked(document.pointerLockElement === canvas);
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const l = look.current;
      l.yaw -= e.movementX * 0.0025;
      l.pitch = Math.max(-1.55, Math.min(1.55, l.pitch - e.movementY * 0.0025));
    };
    const onDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas || !world.current || !body.current) return;
      const b = body.current;
      const w = world.current;
      const hit = pick(w.blocks, b.x, b.y + EYE, b.z, look.current.yaw, look.current.pitch);
      if (!hit) return;
      if (e.button === 0) {
        if (hit.y === 0) return; // bedrock
        setBlock(index(hit.x, hit.y, hit.z), 0);
        playBreak();
      } else if (e.button === 2) {
        const x = hit.x + hit.nx;
        const y = hit.y + hit.ny;
        const z = hit.z + hit.nz;
        if (!inBounds(x, y, z)) return;
        const here = w.blocks[index(x, y, z)];
        if (here !== 0 && here !== B.water) return;
        const block = held.current.hotbar[held.current.slot];
        if (BLOCKS[block].solid && overlapsBody(b, x, y, z)) return;
        setBlock(index(x, y, z), block);
        playPlace();
      } else if (e.button === 1) {
        e.preventDefault();
        if (BLOCKS[hit.block].placeable) setHotbar((h) => h.map((v, i) => (i === held.current.slot ? hit.block : v)));
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== canvas) return;
      setSlot((s) => (s + (e.deltaY > 0 ? 1 : -1) + 9) % 9);
    };
    let lastSpace = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.pointerLockElement !== canvas) {
        if (e.code === 'KeyE' && palette) setPalette(false);
        return;
      }
      keys.current.add(e.code);
      if (/^Digit[1-9]$/.test(e.code)) setSlot(Number(e.code.slice(5)) - 1);
      if (e.code === 'KeyF' && body.current) body.current.flying = !body.current.flying;
      if (e.code === 'Space') {
        e.preventDefault();
        // Double-tap Space to take off or land.
        if (performance.now() - lastSpace < 280 && body.current) body.current.flying = !body.current.flying;
        lastSpace = performance.now();
      }
      if (e.code === 'KeyE') {
        document.exitPointerLock();
        setPalette(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const noMenu = (e: Event) => e.preventDefault();
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    canvas.addEventListener('contextmenu', noMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const clear = () => keys.current.clear();
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
    };
  }, [palette]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    setPalette(false);
    void canvasRef.current?.requestPointerLock();
  };

  const board = (
    <div className="by-view" ref={wrapRef}>
      <canvas ref={canvasRef} className="by-canvas" aria-label="Blockyard world" />
      {locked && <span className="by-crosshair" aria-hidden="true" />}
      <div className="by-info">
        {hud.flying && <span className="by-badge">Flying</span>}
        {hud.swimming && <span className="by-badge">Swimming</span>}
        {hud.target && <span className="by-badge is-dim">{hud.target}</span>}
        <span className="by-badge is-dim">
          {hud.x}, {hud.y}, {hud.z}
        </span>
      </div>
      <div className="by-hotbar" role="toolbar" aria-label="Hotbar">
        {hotbar.map((b, i) => (
          <button key={i} type="button" className={`by-slot${i === slot ? ' is-on' : ''}`} aria-label={`${i + 1}: ${BLOCKS[b].name}`} aria-pressed={i === slot} onClick={() => setSlot(i)}>
            <img src={icons[b]} alt="" draggable={false} />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      {failed ? (
        <div className="by-overlay">
          <h2>Can't start 3D here</h2>
          <p>This browser didn't give Blockyard a WebGL canvas. Try a recent Chrome, Edge, Firefox or Safari.</p>
        </div>
      ) : palette ? (
        <div className="by-overlay by-palette-wrap" role="dialog" aria-label="Blocks">
          <h2>Pick a block for slot {slot + 1}</h2>
          <div className="by-palette">
            {PALETTE.map((b) => (
              <button
                key={b}
                type="button"
                className={`by-pick${hotbar[slot] === b ? ' is-on' : ''}`}
                onClick={() => setHotbar((h) => h.map((v, i) => (i === slot ? b : v)))}
                title={BLOCKS[b].name}
              >
                <img src={icons[b]} alt="" draggable={false} />
                <span>{BLOCKS[b].name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="primary" onClick={play}>
            Back to building
          </button>
        </div>
      ) : (
        !locked && (
          <div className="by-overlay">
            {touch ? (
              <>
                <h2>Grab a keyboard and mouse</h2>
                <p>Blockyard is a first-person building game: it plays on a computer, not a touch screen.</p>
              </>
            ) : (
              <>
                <h2>{view.editCount ? 'Back to building' : 'Click to start building'}</h2>
                <button type="button" className="primary" onClick={play}>
                  Play
                </button>
                <p className="by-keys">
                  <b>WASD</b> move · <b>Mouse</b> look · <b>Space</b> jump · <b>Left click</b> break · <b>Right click</b> place · <b>1–9</b> / wheel pick ·{' '}
                  <b>E</b> blocks · <b>F</b> or double Space fly · <b>Esc</b> pause
                </p>
              </>
            )}
          </div>
        )
      )}
    </div>
  );

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        seats={players.map((p) => ({ id: p.id, accent: p.color, badge: <span className="kit-badge" style={{ '--tc': p.color } as CSSProperties}>{nameFor(p.id).slice(0, 1).toUpperCase()}</span> }))}
      />
      <PlayersPanel
        title="Builders"
        players={players.map((p) => ({
          id: p.id,
          name: p.id === meId ? 'You' : nameFor(p.id),
          you: p.id === meId,
          color: p.color,
          detail: `${p.placed} placed · ${p.broken} broken`,
        }))}
      />
      <SideSection title="How to build">
        <ul className="by-help">
          <li>
            <b>Left click</b> breaks the block you're looking at; <b>right click</b> places one against it.
          </li>
          <li>
            <b>E</b> opens every block; pick one for the selected slot. <b>Middle click</b> copies a block you're looking at.
          </li>
          <li>
            <b>F</b> (or Space twice) to fly; <b>Space</b> up, <b>Shift</b> down. <b>Shift</b> or <b>Ctrl</b> runs on the ground.
          </li>
        </ul>
      </SideSection>
      {onNewWorld && (
        <div className="kit-panel">
          <p className="kit-muted">Your world saves in this browser. {view.editCount} blocks changed.</p>
          <button
            type="button"
            className="g-btn g-btn-ghost"
            onClick={() => {
              if (window.confirm('Start a new world? This one will be gone.')) onNewWorld();
            }}
          >
            New world
          </button>
        </div>
      )}
    </>
  );

  return (
    <GameShell
      className="by-game"
      title="Blockyard"
      exitLabel={exitLabel}
      onExit={onExit}
      status={online ? <><strong>{players.length} builders</strong> · one shared world</> : <><strong>Creative</strong> · build anything</>}
      banner={online?.banner}
      board={board}
      side={side}
    />
  );
}
