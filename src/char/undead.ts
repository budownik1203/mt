// Undead bodies on the same rigid-part rig as the living: skeletons (bones,
// skull, rusted gear on higher tiers), ghouls (grey-green, hunched, long arms,
// claws), zombies (rotting peasants in rags). Vertex-coloured, white texture.
import { MeshBuilder, T, hex, RGB } from "../gfx/meshbuilder.ts";
import type { Joint } from "./human.ts";

export interface UPart { joint: Joint; mesh: { pos: number[]; nor: number[]; uv: number[]; mats: number[]; col: number[] } }

function out(b: MeshBuilder, mat = 0) {
  const n = b.pos.length / 3;
  return { pos: b.pos, nor: b.nor, col: b.col, uv: new Array(n * 2).fill(0.5), mats: new Array(n).fill(mat) };
}

/** A bone running down the limb's -Y axis from the joint. */
const boneDown = (b: MeshBuilder, x: number, z: number, len: number, r: number, c: RGB) => b.cyl(T(x, -len, z), r * 0.85, r, len, 5, c);

export function buildUndead(kind: "skeleton" | "ghoul" | "zombie", tier: number): UPart[] {
  const parts: UPart[] = [];
  const add = (joint: Joint, f: (b: MeshBuilder) => void, mat = 0) => { const b = new MeshBuilder(); b.jitter = 0.06; f(b); parts.push({ joint, mesh: out(b, mat) }); };
  const S = kind === "skeleton";
  const BONE = hex(0xc4b896), BONE_D = hex(0x8d8165), BLACK = hex(0x0c0b0a);
  const SKIN = kind === "ghoul" ? hex(0x6c735c) : hex(0x7c776a), SKIN_D = kind === "ghoul" ? hex(0x4b5142) : hex(0x5b574d);
  const RAG = hex(0x3d382f), RAG_R = hex(0x4a2520), IRON = hex(0x3e3c3a), RUST = hex(0x5c3f2c), BLOOD = hex(0x4a0e0a);
  const flesh = S ? BONE : SKIN, fleshD = S ? BONE_D : SKIN_D;
  const lr = S ? 0.022 : kind === "ghoul" ? 0.04 : 0.045;     // limb thickness

  add("pelvis", (b) => {
    if (S) { b.box(T(0, -0.02, 0), 0.26, 0.08, 0.1, BONE); b.box(T(0, 0.06, -0.05), 0.04, 0.12, 0.04, BONE_D); }
    else { b.cyl(T(0, -0.12, 0), 0.13, 0.14, 0.24, 7, fleshD); b.cyl(T(0, -0.2, 0), 0.17, 0.15, 0.22, 7, kind === "zombie" ? RAG : RAG_R, false); }
    if (tier >= 2 && S) b.cyl(T(0, -0.26, 0), 0.18, 0.16, 0.26, 8, RUST, false);          // mail skirt
  });
  add("torso", (b) => {
    if (S) {
      b.cyl(T(0, 0, -0.06), 0.022, 0.022, 0.44, 5, BONE_D);                                    // spine
      for (let k = 0; k < 6; k++) { const y = 0.12 + k * 0.045, r = 0.12 - Math.abs(k - 2.5) * 0.012; b.cyl(T(0, y, 0), r, r, 0.018, 9, k % 2 ? BONE : BONE_D, false); }
      b.box(T(0, 0.38, 0), 0.34, 0.03, 0.05, BONE);                                               // collarbones
      b.box(T(0, 0.22, 0.1), 0.03, 0.2, 0.02, BONE);                                              // sternum
      if (tier >= 1) b.box(T(0, 0.24, 0.02), 0.3, 0.32, 0.22, tier >= 3 ? IRON : RUST);            // breastplate / mail shirt
    } else {
      const hunch = kind === "ghoul" ? 0.06 : 0;
      b.cyl(T(0, 0, hunch * 0.3), 0.13, 0.15, 0.42, 8, flesh);
      for (let k = 0; k < 4; k++) b.box(T(0, 0.14 + k * 0.05, 0.12), 0.18, 0.012, 0.02, fleshD);   // ribs under the skin
      b.rock(T(0, 0.38, -0.02 - hunch), 0.16, fleshD, 0.2, 4);                                     // shoulders
      if (kind === "zombie") { b.box(T(0, 0.12, 0.01), 0.3, 0.26, 0.24, RAG); b.box(T(0.05, 0.2, 0.13), 0.1, 0.12, 0.01, BLOOD); }
    }
  });
  add("head", (b) => {
    if (S) {
      b.rock(T(0, 0.14, 0.0), 0.105, BONE, 0.12, 7);
      b.box(T(0, 0.055, 0.045), 0.08, 0.035, 0.08, BONE_D);                                       // jaw
      for (const x of [-0.035, 0.035]) b.box(T(x, 0.15, 0.085), 0.035, 0.03, 0.03, BLACK);        // eye sockets
      b.box(T(0, 0.11, 0.095), 0.02, 0.025, 0.02, BLACK);
      if (tier >= 2) b.cyl(T(0, 0.16, 0), 0.12, 0.09, 0.14, 8, tier >= 3 ? IRON : RUST);          // rusted helmet
    } else {
      b.rock(T(0, 0.15, kind === "ghoul" ? 0.03 : 0), kind === "ghoul" ? 0.1 : 0.1, flesh, 0.2, 9);
      b.box(T(0, 0.07, 0.07), 0.08, kind === "ghoul" ? 0.07 : 0.04, 0.06, kind === "ghoul" ? BLOOD : fleshD);   // open maw
      for (const x of [-0.035, 0.035]) b.box(T(x, 0.16, 0.085), 0.025, 0.018, 0.02, kind === "ghoul" ? hex(0x9a8d3a) : BLACK);
      if (kind === "ghoul") for (const x of [-0.05, 0.05]) b.box(T(x, 0.2, -0.06, 0, 0, x * 6), 0.02, 0.08, 0.02, fleshD);   // ear spikes
    }
  });
  for (const sd of ["L", "R"] as const) {
    const arm = kind === "ghoul" ? 1.12 : 1;
    add(`uarm${sd}`, (b) => { b.rock(T(0, 0, 0), lr * 1.6, fleshD, 0.2, 2); boneDown(b, 0, 0, 0.28 * arm, lr, flesh); if (tier >= 3 && S) b.cyl(T(0, -0.12, 0), 0.06, 0.06, 0.12, 6, IRON); });
    add(`farm${sd}`, (b) => {
      if (S) { boneDown(b, 0.012, 0, 0.26, 0.014, BONE); boneDown(b, -0.012, 0, 0.26, 0.012, BONE_D); }
      else { boneDown(b, 0, 0, 0.27 * arm, lr * 0.85, flesh); if (kind === "zombie") b.cyl(T(0, -0.1, 0), lr * 1.25, lr * 1.2, 0.1, 6, RAG); }
    });
    add(`hand${sd}`, (b) => {
      b.box(T(0, -0.05, 0.005), S ? 0.045 : 0.06, 0.07, 0.035, fleshD);
      for (let f = 0; f < 3; f++) b.box(T(-0.02 + f * 0.02, -0.11, 0.01), 0.012, kind === "ghoul" ? 0.09 : 0.05, 0.012, kind === "ghoul" ? BLACK : flesh);
    });
    add(`thigh${sd}`, (b) => { boneDown(b, 0, 0, 0.43, S ? 0.03 : lr * 1.3, flesh); b.rock(T(0, -0.43, 0.01), S ? 0.04 : 0.055, fleshD, 0.2, 3); if (!S) b.cyl(T(0, -0.2, 0), lr * 1.6, lr * 1.5, 0.22, 6, kind === "zombie" ? RAG : RAG_R); });
    add(`shin${sd}`, (b) => { if (S) { boneDown(b, 0.01, 0, 0.42, 0.018, BONE); boneDown(b, -0.012, 0, 0.4, 0.012, BONE_D); } else boneDown(b, 0, 0, 0.42, lr * 1.05, flesh); if (tier >= 3 && S) b.cyl(T(0, -0.32, 0), 0.055, 0.06, 0.3, 6, IRON); });
    add(`foot${sd}`, (b) => { b.box(T(0, -0.035, 0.07), S ? 0.06 : 0.08, 0.04, 0.22, fleshD); });
  }
  return parts;
}
