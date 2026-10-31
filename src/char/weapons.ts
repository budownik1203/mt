// Weapons and shields, authored in grip space: origin = centre of the fist,
// the weapon's working end points along +Z. Hands hold them at GRIP.
import { Mat4, m4, mul, trs } from "../core/math.ts";
import { TMesh, Ring } from "./tmesh.ts";
import { Region } from "./atlas.ts";
import { GREG } from "./gear.ts";

/** Fist centre in hand-joint space. */
export const GRIP = (): Mat4 => trs(m4(), 0, -0.07, 0.004);

/** Weapon classes share one set of animations, exactly like Mount & Blade: only the model in the hand changes. */
export type WClass = "oh" | "th" | "pa";
export type WeaponId = "sword" | "kord" | "hatchet" | "mace" | "longsword" | "greataxe" | "spear" | "glaive";
export interface WeaponSpec {
  id: WeaponId; name: string; cls: WClass;
  thrust: boolean;          // weapons that cannot thrust turn the thrust into an overhead (M&B rule)
  offhand: number;          // left fist position along the weapon's Z from the right fist (0 = one-handed)
  tip: number;
}
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  sword: { id: "sword", name: "Miecz", cls: "oh", thrust: true, offhand: 0, tip: 0.92 },
  kord: { id: "kord", name: "Kord", cls: "oh", thrust: true, offhand: 0, tip: 0.66 },
  hatchet: { id: "hatchet", name: "Topór", cls: "oh", thrust: false, offhand: 0, tip: 0.55 },
  mace: { id: "mace", name: "Buzdygan", cls: "oh", thrust: false, offhand: 0, tip: 0.6 },
  longsword: { id: "longsword", name: "Miecz dwuręczny", cls: "th", thrust: true, offhand: -0.14, tip: 1.2 },
  greataxe: { id: "greataxe", name: "Topór dwuręczny", cls: "th", thrust: false, offhand: -0.22, tip: 0.85 },
  spear: { id: "spear", name: "Włócznia", cls: "pa", thrust: true, offhand: 0.4, tip: 1.6 },
  glaive: { id: "glaive", name: "Glewia", cls: "pa", thrust: true, offhand: 0.4, tip: 1.75 },
};
export const CLASS_NAME: Record<WClass, string> = { oh: "jednoręczna", th: "dwuręczna", pa: "drzewcowa" };

/** Loft along +Z: helper that turns the +Y loft into +Z. */
function zl(t: TMesh, m: Mat4, rings: Ring[], sides: number, R: Region, o: Record<string, unknown> = {}) {
  t.loft(mul(m4(), m, trs(m4(), 0, 0, 0, 0, Math.PI / 2)), rings, sides, R, o);
}

export function buildWeapon(id: WeaponId, smooth: boolean, detail: number): TMesh {
  const t = new TMesh(256), I = m4(), o = { smooth };
  const rnd = Math.max(5, detail);
  switch (id) {
    case "sword": {
      t.mat = 0; zl(t, I, [[-0.07, 0.016, 0.016], [0.06, 0.018, 0.018]], rnd, GREG.grip, o);                       // grip wraps
      t.mat = 2;
      zl(t, I, [[-0.115, 0.012, 0.012], [-0.1, 0.02, 0.033], [-0.075, 0.019, 0.031], [-0.065, 0.014, 0.014]], 6, GREG.brass, { ...o, capBot: true });   // wheel pommel
      t.box(trs(m4(), 0, 0, 0.075), 0.026, 0.21, 0.028, GREG.steelDark);                                         // cross guard
      t.box(trs(m4(), 0, 0.11, 0.075), 0.034, 0.022, 0.034, GREG.brass); t.box(trs(m4(), 0, -0.11, 0.075), 0.034, 0.022, 0.034, GREG.brass);
      // blade: diamond section, taper, point
      zl(t, I, [[0.085, 0.007, 0.027], [0.5, 0.006, 0.024], [0.8, 0.005, 0.017], [0.92, 0.001, 0.001]], 4, GREG.blade, { smooth: false });
      break;
    }
    case "mace": {
      t.mat = 0; zl(t, I, [[-0.1, 0.017, 0.017], [0.08, 0.018, 0.018]], rnd, GREG.grip, o);
      t.mat = 2;
      zl(t, I, [[-0.12, 0.024, 0.024], [-0.1, 0.026, 0.026]], 6, GREG.steelDark, { ...o, capBot: true });
      zl(t, I, [[0.08, 0.015, 0.015], [0.46, 0.014, 0.014]], 6, GREG.steelDark, o);                                // iron haft
      zl(t, I, [[0.44, 0.03, 0.03], [0.5, 0.034, 0.034], [0.6, 0.026, 0.026], [0.62, 0.008, 0.008]], 6, GREG.plateLimb, { ...o, capTop: true });   // core
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        // flange: thin plate standing out radially, beaked profile
        t.box(trs(m4(), Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0.53, 0, 0, a + Math.PI / 2), 0.009, 0.05, 0.13, GREG.plateLimb);
        t.box(trs(m4(), Math.cos(a) * 0.066, Math.sin(a) * 0.066, 0.545, 0, 0, a + Math.PI / 2), 0.008, 0.02, 0.07, GREG.plateLimb);
      }
      break;
    }
    case "kord": {
      t.mat = 0; zl(t, I, [[-0.06, 0.017, 0.017], [0.05, 0.019, 0.019]], rnd, GREG.grip, o);
      t.mat = 2;
      zl(t, I, [[-0.09, 0.012, 0.012], [-0.075, 0.022, 0.022], [-0.06, 0.016, 0.016]], 6, GREG.brass, { ...o, capBot: true });
      t.box(trs(m4(), 0, 0, 0.062), 0.024, 0.13, 0.022, GREG.steelDark);
      // broad single-edged blade, back edge straight, belly swelling toward the clipped point
      zl(t, I, [[0.07, 0.008, 0.026, 0, 0.004], [0.4, 0.007, 0.034, 0, -0.006], [0.58, 0.006, 0.03, 0, -0.008], [0.66, 0.001, 0.004, 0, 0.012]], 4, GREG.blade, { smooth: false });
      break;
    }
    case "longsword": {
      t.mat = 0; zl(t, I, [[-0.22, 0.017, 0.017], [0.06, 0.019, 0.019]], rnd, GREG.grip, o);                       // hand-and-a-half grip
      t.mat = 2;
      zl(t, I, [[-0.27, 0.012, 0.012], [-0.255, 0.024, 0.024], [-0.225, 0.022, 0.022], [-0.215, 0.014, 0.014]], 6, GREG.brass, { ...o, capBot: true });   // scent-stopper pommel
      t.box(trs(m4(), 0, 0, 0.075), 0.028, 0.28, 0.03, GREG.steelDark);
      zl(t, I, [[0.085, 0.008, 0.03], [0.6, 0.007, 0.026], [1.05, 0.005, 0.016], [1.2, 0.001, 0.001]], 4, GREG.blade, { smooth: false });
      break;
    }
    case "greataxe": {
      t.mat = 0; zl(t, I, [[-0.42, 0.02, 0.022], [0.8, 0.018, 0.02]], rnd, GREG.wood, { ...o, capBot: true, capTop: true });
      t.mat = 2;
      t.box(trs(m4(), 0, 0, 0.74), 0.04, 0.06, 0.1, GREG.steelDark);
      // long bearded Dane-axe blade, edge toward -Y
      t.box(trs(m4(), 0, -0.1, 0.74), 0.012, 0.14, 0.09, GREG.plateLimb);
      t.box(trs(m4(), 0, -0.2, 0.71, 0, 0.25, 0), 0.01, 0.1, 0.2, GREG.blade);
      t.box(trs(m4(), 0, -0.25, 0.66, 0, 0.6, 0), 0.009, 0.05, 0.12, GREG.blade);
      break;
    }
    case "glaive": {
      t.mat = 0;
      zl(t, I, [[-0.85, 0.017, 0.017], [1.3, 0.016, 0.016]], rnd, GREG.wood, o);
      t.mat = 2;
      zl(t, I, [[-0.89, 0.012, 0.012], [-0.85, 0.02, 0.02], [-0.8, 0.018, 0.018]], 6, GREG.steelDark, { ...o, capBot: true });
      zl(t, I, [[1.25, 0.022, 0.022], [1.34, 0.018, 0.018]], 6, GREG.steelDark, o);
      // knife-like single-edged head with a back spike
      zl(t, I, [[1.33, 0.008, 0.03, 0, 0.006], [1.55, 0.007, 0.042, 0, -0.008], [1.7, 0.005, 0.03, 0, -0.012], [1.76, 0.001, 0.004, 0, 0.012]], 4, GREG.blade, { smooth: false });
      t.box(trs(m4(), 0, 0.05, 1.38, 0, -0.5, 0), 0.012, 0.012, 0.08, GREG.steelDark);
      break;
    }
    case "spear": {
      t.mat = 0;
      zl(t, I, [[-0.85, 0.017, 0.017], [1.3, 0.016, 0.016]], rnd, GREG.wood, o);                                   // ash shaft
      t.mat = 2;
      zl(t, I, [[-0.89, 0.012, 0.012], [-0.85, 0.02, 0.02], [-0.8, 0.018, 0.018]], 6, GREG.steelDark, { ...o, capBot: true });   // butt spike
      zl(t, I, [[1.27, 0.021, 0.021], [1.36, 0.017, 0.017]], 6, GREG.steelDark, o);                                // socket
      zl(t, I, [[1.36, 0.006, 0.012], [1.42, 0.008, 0.034], [1.5, 0.006, 0.026], [1.6, 0.001, 0.001]], 4, GREG.blade, { smooth: false });   // leaf head
      break;
    }
    case "hatchet": {
      t.mat = 0; zl(t, I, [[-0.1, 0.017, 0.019], [0.5, 0.015, 0.017]], rnd, GREG.wood, { ...o, capBot: true, capTop: true });
      t.mat = 2;
      t.box(trs(m4(), 0, 0, 0.45), 0.034, 0.05, 0.075, GREG.steelDark);                                          // eye
      // bearded blade below the haft line
      t.box(trs(m4(), 0, -0.07, 0.45, 0, 0, 0), 0.012, 0.1, 0.07, GREG.plateLimb);
      t.box(trs(m4(), 0, -0.12, 0.43, 0, 0.35, 0), 0.01, 0.06, 0.1, GREG.blade);
      break;
    }
  }
  return t;
}

/** Heater shield, face toward +Z, centred on the arm straps. */
export function buildShield(): TMesh {
  const t = new TMesh(256);
  t.mat = 0.25;
  const w = 0.52, h = 0.64, pts: number[][] = [[-w / 2, h * 0.45], [w / 2, h * 0.45]];
  for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push([w / 2 * (1 - k * k * 0.98), h * 0.45 - h * 0.25 * k - h * 0.75 * k * k]); }
  for (let i = 7; i >= 1; i--) { const k = i / 8; pts.push([-w / 2 * (1 - k * k * 0.98), h * 0.45 - h * 0.25 * k - h * 0.75 * k * k]); }
  t.plate2d(m4(), pts, 0.028, GREG.shieldFront, GREG.wood, GREG.rim);
  // boss-free heater; leather straps on the back
  t.box(trs(m4(), 0, 0.05, -0.03), 0.3, 0.035, 0.012, GREG.leather);
  t.box(trs(m4(), 0, -0.1, -0.03), 0.22, 0.035, 0.012, GREG.leather);
  return t;
}
