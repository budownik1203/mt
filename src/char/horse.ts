// Horses (build 13): a low-poly warhorse built per part (body with neck, head
// and tail; four legs pivoting at the shoulder/hip) so the gait can swing the
// legs. Horse space: +Z forward, +Y up, origin on the ground under the saddle.
import { MeshBuilder, T, hex, RGB } from "../gfx/meshbuilder.ts";
import { Mat4, m4, mul, trs } from "../core/math.ts";

export type HorseId = "szkapa" | "kon" | "rumak";
export interface HorseSpec { id: HorseId; name: string; hp: number; speed: number; turn: number; armour: number; price: number; colour: number; barded: boolean }
export const HORSES: Record<HorseId, HorseSpec> = {
  szkapa: { id: "szkapa", name: "Szkapa", hp: 80, speed: 8.6, turn: 2.1, armour: 4, price: 120, colour: 0x5a4a3a, barded: false },
  kon: { id: "kon", name: "Koń wierzchowy", hp: 115, speed: 10.2, turn: 1.9, armour: 8, price: 320, colour: 0x3a2c22, barded: false },
  rumak: { id: "rumak", name: "Rumak bojowy w kropierzu", hp: 170, speed: 9.6, turn: 1.6, armour: 22, price: 760, colour: 0x1e1a18, barded: true },
};
export const SADDLE = 0.6;    // how far the rider's root is lifted above the ground when mounted

type MeshData = { pos: number[]; nor: number[]; uv: number[]; mats: number[]; col: number[] };
function out(b: MeshBuilder): MeshData { const n = b.pos.length / 3; return { pos: b.pos, nor: b.nor, col: b.col, uv: new Array(n * 2).fill(0.5), mats: new Array(n).fill(0) }; }

export interface HorseParts { body: MeshData; legs: MeshData[]; hips: [number, number, number][] }
export function buildHorse(id: HorseId): HorseParts {
  const H = HORSES[id];
  const coat: RGB = hex(H.colour), dark: RGB = hex(0x15110e), mane: RGB = hex(0x0e0c0a), leather: RGB = hex(0x3a2a1e), cloth: RGB = hex(0x4a1a14), steel: RGB = hex(0x4a4846);
  const b = new MeshBuilder(); b.jitter = 0.05;
  // barrel and quarters
  b.cyl(T(0, 1.18, -0.75, 0, Math.PI / 2, 0), 0.34, 0.36, 1.5, 8, coat);
  b.rock(T(0, 1.2, -0.72), 0.36, coat, 0.15, 3);
  b.rock(T(0, 1.22, 0.62), 0.37, coat, 0.15, 4);
  // neck and head: the neck rises forward from the withers, the head hangs forward and down
  b.cyl(T(0, 1.3, 0.55, 0, 0.62, 0), 0.21, 0.14, 0.66, 7, coat);
  b.box(T(0, 1.8, 1.08, 0, 0.75, 0), 0.17, 0.2, 0.56, coat);
  b.box(T(0, 1.62, 1.28, 0, 0.75, 0), 0.15, 0.15, 0.16, dark);
  for (const x of [-0.06, 0.06]) b.box(T(x, 2.02, 0.95, 0, -0.2, 0), 0.04, 0.11, 0.05, coat);           // ears
  for (let i = 0; i < 6; i++) b.box(T(0, 1.42 + i * 0.09, 0.5 + i * 0.06), 0.05, 0.13, 0.07, mane);     // mane
  b.box(T(0, 1.1, -1.22, 0, -0.5, 0), 0.08, 0.08, 0.55, mane);                                            // tail
  // tack: saddle, blanket, reins
  b.box(T(0, 1.55, 0.02), 0.42, 0.12, 0.62, leather);
  b.box(T(0, 1.58, -0.26), 0.36, 0.14, 0.08, leather);
  b.box(T(0, 1.42, 0.02), 0.74, 0.05, 0.72, H.barded ? cloth : hex(0x2a2622));
  for (const x of [-0.11, 0.11]) b.box(T(x, 1.75, 0.95, 0, 0.6, 0), 0.01, 0.01, 0.6, leather);
  if (H.barded) {
    b.cyl(T(0, 0.9, -0.85, 0, Math.PI / 2, 0), 0.4, 0.42, 1.7, 8, cloth, false);           // caparison
    b.box(T(0, 1.83, 1.07, 0, 0.75, 0), 0.19, 0.18, 0.5, steel);                              // chanfron
    b.cyl(T(0, 1.32, 0.56, 0, 0.62, 0), 0.23, 0.16, 0.5, 7, steel, false);                        // crinet
  }
  const hips: [number, number, number][] = [[0.17, 1.02, 0.6], [-0.17, 1.02, 0.6], [0.17, 1.02, -0.68], [-0.17, 1.02, -0.68]];
  const legs = hips.map((_, i) => {
    const l = new MeshBuilder(); l.jitter = 0.04;
    const front = i < 2;
    l.cyl(T(0, -0.5, front ? 0 : -0.04), 0.07, 0.1, 0.5, 6, coat);                      // forearm / gaskin
    l.cyl(T(0, -0.95, front ? 0.02 : -0.02), 0.045, 0.055, 0.45, 5, coat);               // cannon
    l.box(T(0, -0.98, 0.04), 0.1, 0.08, 0.12, dark);                                     // hoof
    if (H.barded) l.cyl(T(0, -0.42, 0), 0.12, 0.12, 0.3, 6, cloth, false);
    return out(l);
  });
  return { body: out(b), legs, hips };
}

/** Gait: leg pitch angles for walk / canter / gallop by phase. */
export function legAngles(phase: number, speed: number): number[] {
  const amp = Math.min(0.75, 0.18 + speed * 0.06);
  const gallop = speed > 6;
  const offs = gallop ? [0, 0.35, 3.3, 3.6] : [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
  return offs.map((o, i) => Math.sin(phase + o) * amp * (i < 2 ? 1 : 0.85));
}
export function legMatrix(root: Mat4, hip: [number, number, number], ang: number): Mat4 {
  return mul(m4(), root, trs(m4(), hip[0], hip[1], hip[2], 0, ang, 0));
}
