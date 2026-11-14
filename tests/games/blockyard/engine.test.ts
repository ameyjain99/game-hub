import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { applyBlockyard, blockyardKit, createBlockyard } from '../../../src/games/blockyard/engine';
import { B, BLOCKS, D, H, W, generate, index, isSolid, spawnPoint } from '../../../src/games/blockyard/world';
import { collides, pick, step, type Body } from '../../../src/games/blockyard/ui/player';

describe('the world', () => {
  test('the same seed builds the same world; bedrock all along the floor', () => {
    const a = generate(42);
    const b = generate(42);
    expect(a).toEqual(b);
    expect(generate(43)).not.toEqual(a);
    for (let z = 0; z < D; z += 7) for (let x = 0; x < W; x += 7) expect(a[index(x, 0, z)]).toBe(B.bedrock);
  });

  test('grass, water and trees all appear', () => {
    const w = generate(7);
    const count = (b: number) => w.reduce((n, v) => n + (v === b ? 1 : 0), 0);
    expect(count(B.grass)).toBeGreaterThan(1000);
    expect(count(B.log)).toBeGreaterThan(10);
    expect(count(B.leaves)).toBeGreaterThan(100);
  });

  test('you spawn standing on solid ground, with room above', () => {
    const w = generate(11);
    const [x, y, z] = spawnPoint(w);
    expect(isSolid(w[index(Math.floor(x), Math.floor(y) - 1, Math.floor(z))])).toBe(true);
    expect(collides(w, x, y, z)).toBe(false);
  });
});

describe('the shared world', () => {
  const seats = [
    { name: 'Ann', isAI: false },
    { name: 'Ben', isAI: false },
  ];

  test('anyone may set any block at any time; no turns', () => {
    let s = createBlockyard(seats, 1);
    expect(blockyardKit.actor(s)).toBeNull();
    s = applyBlockyard(s, { type: 'SET', i: index(5, 20, 5), b: B.brick }, 'p1');
    s = applyBlockyard(s, { type: 'SET', i: index(6, 20, 5), b: 0 }, 'p0');
    expect(s.edits).toEqual({ [index(5, 20, 5)]: B.brick, [index(6, 20, 5)]: 0 });
    expect(s.players[1].placed).toBe(1);
    expect(s.players[0].broken).toBe(1);
  });

  test('bedrock, bad blocks and out-of-world spots are refused', () => {
    const s = createBlockyard(seats, 1);
    expect(() => applyBlockyard(s, { type: 'SET', i: index(3, 0, 3), b: 0 }, 'p0')).toThrow(IllegalMove);
    expect(() => applyBlockyard(s, { type: 'SET', i: index(3, 5, 3), b: B.bedrock }, 'p0')).toThrow(IllegalMove);
    expect(() => applyBlockyard(s, { type: 'SET', i: W * H * D, b: 1 }, 'p0')).toThrow(IllegalMove);
    expect(() => applyBlockyard(s, { type: 'SET', i: index(3, 5, 3), b: BLOCKS.length }, 'p0')).toThrow(IllegalMove);
  });
});

describe('moving and looking', () => {
  const flat = () => {
    const w = new Uint8Array(W * H * D);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) for (let y = 0; y <= 5; y++) w[index(x, y, z)] = y === 0 ? B.bedrock : B.stone;
    return w;
  };
  const idle = { forward: 0, strafe: 0, jump: false, down: false, sprint: false, yaw: 0 };

  test('a body falls and lands on the ground', () => {
    const w = flat();
    const b: Body = { x: 10.5, y: 12, z: 10.5, vx: 0, vy: 0, vz: 0, onGround: false, flying: false };
    for (let i = 0; i < 120; i++) step(w, b, idle, 1 / 60);
    expect(b.y).toBeCloseTo(6, 3);
    expect(b.onGround).toBe(true);
  });

  test('walls stop you; you walk forward along -z', () => {
    const w = flat();
    for (let y = 6; y < 9; y++) w[index(10, y, 7)] = B.stone;
    const b: Body = { x: 10.5, y: 6, z: 10.5, vx: 0, vy: 0, vz: 0, onGround: true, flying: false };
    for (let i = 0; i < 120; i++) step(w, b, { ...idle, forward: 1 }, 1 / 60);
    expect(b.z).toBeGreaterThan(8.29);
    expect(b.z).toBeLessThan(8.31);
  });

  test('the look ray finds the block in front of you and the face it hit', () => {
    const w = flat();
    w[index(10, 6, 7)] = B.brick;
    const hit = pick(w, 10.5, 6.5, 10.5, 0, 0);
    expect(hit).toMatchObject({ x: 10, y: 6, z: 7, nz: 1, block: B.brick });
    const down = pick(w, 10.5, 7.6, 10.5, 0, -Math.PI / 2 + 0.01);
    expect(down).toMatchObject({ y: 5, ny: 1 });
  });
});
