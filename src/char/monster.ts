// Monsters of the borderland (build 10) on the human rig, built per joint like
// the undead: wilkołak (hunched, fur, wolf head, long claws), utopiec (drowned,
// blue-green, swollen, weed hair, fish maw), strzyga (pale, gaunt, long black
// hair, two rows of teeth). Vertex colours on the white texture slot.
import { MeshBuilder, T, hex, RGB } from "../gfx/meshbuilder.ts";
import type { Joint } from "./human.ts";
import type { UPart } from "./undead.ts";

export type MonsterKind = "werewolf" | "drowner" | "strzyga";
function out(b: MeshBuilder) { const n = b.pos.length / 3; return { pos: b.pos, nor: b.nor, col: b.col, uv: new Array(n * 2).fill(0.5), mats: new Array(n).fill(0) }; }

export function buildMonster(kind: MonsterKind): UPart[] {
  const parts: UPart[] = [];
  const add = (joint: Joint, f: (b: MeshBuilder) => void) => { const b = new MeshBuilder(); b.jitter = 0.07; f(b); parts.push({ joint, mesh: out(b) }); };
  const W = kind === "werewolf", D = kind === "drowner";
  const SKIN: RGB = W ? hex(0x3b3128) : D ? hex(0x4e6458) : hex(0xb8b2a2);
  const SKIN_D: RGB = W ? hex(0x2a221c) : D ? hex(0x34463e) : hex(0x8a8476);
  const HAIR: RGB = W ? hex(0x4a3c30) : D ? hex(0x2c3a24) : hex(0x0d0c0c);
  const CLAW = hex(0x0c0b0a), MAW = hex(0x4a0e0a), EYE: RGB = W ? hex(0xb08a2a) : D ? hex(0x8fb0a0) : hex(0xb02018), TOOTH = hex(0xd8d0b0);
  const fat = D ? 1.25 : W ? 1.3 : 0.8;          // girth
  const arm = W ? 1.15 : kind === "strzyga" ? 1.12 : 1;

  add("pelvis", (b) => { b.cyl(T(0, -0.12, 0), 0.14 * fat, 0.15 * fat, 0.24, 7, SKIN_D); if (W) b.box(T(0, -0.1, -0.16, 0.6), 0.04, 0.04, 0.4, HAIR); if (!W) b.cyl(T(0, -0.22, 0), 0.16 * fat, 0.14, 0.2, 7, D ? hex(0x2c3a24) : hex(0x2a2622), false); });
  add("torso", (b) => {
    b.cyl(T(0, 0, W ? 0.03 : 0), 0.14 * fat, 0.17 * fat, 0.44, 8, SKIN);
    if (W) { b.rock(T(0, 0.36, -0.06), 0.22, HAIR, 0.3, 4); b.rock(T(0, 0.22, -0.1), 0.18, HAIR, 0.3, 7); }   // hump of fur
    if (D) { b.rock(T(0.05, 0.18, 0.08), 0.12, SKIN_D, 0.3, 3); for (let i = 0; i < 4; i++) b.box(T(-0.1 + i * 0.07, 0.3, -0.13), 0.02, 0.3, 0.02, HAIR); }
    if (kind === "strzyga") { for (let k = 0; k < 5; k++) b.box(T(0, 0.12 + k * 0.05, 0.1), 0.16, 0.012, 0.02, SKIN_D); b.box(T(0, 0.3, -0.12), 0.22, 0.4, 0.03, HAIR); }
    b.rock(T(0, 0.38, 0), 0.15 * fat, SKIN_D, 0.2, 4);
  });
  add("head", (b) => {
    if (W) {
      b.rock(T(0, 0.13, -0.01), 0.12, HAIR, 0.2, 5);
      b.box(T(0, 0.1, 0.13), 0.09, 0.08, 0.16, SKIN);                                // snout
      b.box(T(0, 0.06, 0.15), 0.08, 0.03, 0.14, MAW);
      for (const x of [-0.03, 0.03]) b.box(T(x, 0.07, 0.22), 0.012, 0.04, 0.012, TOOTH);
      for (const x of [-0.06, 0.06]) { b.box(T(x, 0.24, -0.02, 0, 0, x * 4), 0.04, 0.1, 0.03, HAIR); b.box(T(x * 0.75, 0.16, 0.09), 0.025, 0.02, 0.02, EYE); }
    } else if (D) {
      b.rock(T(0, 0.14, 0.02), 0.115, SKIN, 0.25, 8);
      b.box(T(0, 0.06, 0.09), 0.12, 0.05, 0.05, MAW);                                // wide fish maw
      for (const x of [-0.05, 0.05]) b.rock(T(x, 0.16, 0.08), 0.03, EYE, 0.1, 2);   // bulging eyes
      for (let i = 0; i < 6; i++) b.box(T(-0.08 + i * 0.032, 0.12, -0.08), 0.015, 0.22, 0.015, HAIR);   // weed hair
    } else {
      b.rock(T(0, 0.15, 0), 0.1, SKIN, 0.15, 6);
      b.box(T(0, 0.07, 0.07), 0.07, 0.05, 0.05, MAW);
      for (const y of [0.09, 0.055]) b.box(T(0, y, 0.095), 0.06, 0.008, 0.01, TOOTH);   // two rows of teeth
      for (const x of [-0.035, 0.035]) b.box(T(x, 0.16, 0.085), 0.025, 0.015, 0.02, EYE);
      b.box(T(0, 0.06, -0.08), 0.2, 0.42, 0.06, HAIR);                                  // long black hair
    }
  });
  for (const sd of ["L", "R"] as const) {
    add(`uarm${sd}`, (b) => { b.rock(T(0, 0, 0), 0.07 * fat, W ? HAIR : SKIN_D, 0.2, 2); b.cyl(T(0, -0.29 * arm, 0), 0.04 * fat, 0.05 * fat, 0.29 * arm, 6, SKIN); });
    add(`farm${sd}`, (b) => { b.cyl(T(0, -0.28 * arm, 0), 0.035 * fat, 0.045 * fat, 0.28 * arm, 6, W ? HAIR : SKIN); });
    add(`hand${sd}`, (b) => {
      b.box(T(0, -0.05, 0.005), 0.07 * fat, 0.08, 0.04, SKIN_D);
      for (let f = 0; f < 4; f++) b.box(T(-0.03 + f * 0.02, -0.12, 0.012, 0.15, 0, 0), 0.012, W ? 0.12 : 0.09, 0.012, CLAW);
    });
    add(`thigh${sd}`, (b) => { b.cyl(T(0, -0.43, 0), 0.05 * fat, 0.07 * fat, 0.43, 6, W ? HAIR : SKIN); });
    add(`shin${sd}`, (b) => { b.cyl(T(0, -0.42, 0), 0.04 * fat, 0.055 * fat, 0.42, 6, W ? HAIR : SKIN_D); });
    add(`foot${sd}`, (b) => { b.box(T(0, -0.035, 0.07), 0.08, 0.05, 0.22, SKIN_D); if (W || kind === "strzyga") for (let f = 0; f < 3; f++) b.box(T(-0.025 + f * 0.025, -0.04, 0.2), 0.012, 0.02, 0.06, CLAW); });
  }
  return parts;
}
