// Command in battle: nine groups, movement orders, formations and the slot each
// soldier should stand in; plus battle morale (per soldier, swayed by what
// happens around him), rout and rally.
import type { Warrior } from "./warrior.ts";

export type Order = "hold" | "follow" | "charge" | "fallback";
export type Formation = "line" | "column" | "wedge" | "shieldwall" | "hedgehog" | "loose";
export const FORMATIONS: Formation[] = ["line", "column", "wedge", "shieldwall", "hedgehog", "loose"];
export const ORDER_NAMES: Record<Order, { pl: string; en: string }> = {
  hold: { pl: "stać tutaj", en: "hold here" }, follow: { pl: "za mną", en: "follow me" },
  charge: { pl: "naprzód", en: "charge" }, fallback: { pl: "cofnąć się", en: "fall back" },
};
export const FORM_NAMES: Record<Formation, { pl: string; en: string }> = {
  line: { pl: "linia", en: "line" }, column: { pl: "kolumna", en: "column" }, wedge: { pl: "klin", en: "wedge" },
  shieldwall: { pl: "mur tarcz", en: "shield wall" }, hedgehog: { pl: "jeż", en: "hedgehog" }, loose: { pl: "rozproszona", en: "loose" },
};

export interface Group {
  id: number;                 // 1..9
  order: Order; formation: Formation;
  ax: number; az: number; ayaw: number;     // anchor: where the formation stands and which way it faces
  reserve: boolean;           // held back until released
}
export function newGroups(): Group[] {
  return Array.from({ length: 9 }, (_, i) => ({ id: i + 1, order: "charge" as Order, formation: "line" as Formation, ax: 0, az: 0, ayaw: Math.PI, reserve: false }));
}

/** Slot offsets (formation space: x right, z forward) for n soldiers. */
export function slots(f: Formation, n: number): [number, number][] {
  const out: [number, number][] = [];
  if (f === "hedgehog") {
    // rings facing outward
    let k = 0, ring = 0;
    while (k < n) { const r = 1.4 + ring * 1.3, m = Math.max(1, Math.min(n - k, Math.floor((2 * Math.PI * r) / 1.1))); for (let i = 0; i < m; i++, k++) { const a = (i / m) * Math.PI * 2; out.push([Math.cos(a) * r, Math.sin(a) * r]); } ring++; }
    return out;
  }
  if (f === "wedge") {
    let k = 0, row = 0;
    while (k < n) { const w = row * 2 + 1; for (let i = 0; i < w && k < n; i++, k++) out.push([(i - (w - 1) / 2) * 1.2, -row * 1.3]); row++; }
    return out;
  }
  const sp = f === "shieldwall" ? 0.85 : f === "loose" ? 2.6 : 1.3;
  const width = f === "column" ? 3 : f === "shieldwall" ? Math.max(4, Math.ceil(n / 2)) : Math.max(5, Math.ceil(n / (f === "loose" ? 1 : 2)));
  for (let k = 0; k < n; k++) { const row = Math.floor(k / width), col = k % width, w = Math.min(width, n - row * width); out.push([(col - (w - 1) / 2) * sp, -row * (f === "loose" ? 2.6 : sp + 0.3)]); }
  return out;
}

/** World position of a soldier's slot (index i of n in group g). */
export function slotWorld(g: Group, f: Formation, i: number, n: number): [number, number] {
  const s = slots(f, n)[i] ?? [0, 0];
  const c = Math.cos(g.ayaw), sn = Math.sin(g.ayaw);
  // formation forward = (sin yaw, cos yaw); right = (cos yaw, -sin yaw)
  return [g.ax + s[0] * c + s[1] * sn, g.az - s[0] * sn + s[1] * c];
}

/** How far a soldier in this order/formation will leave his slot to fight. */
export function engageRadius(g: Group): number {
  if (g.order === "charge") return 999;
  if (g.order === "fallback") return 1.5;
  return g.formation === "shieldwall" ? 2.2 : g.formation === "hedgehog" ? 2.6 : g.formation === "loose" ? 4.5 : 3.2;
}

// ---------- battle morale ----------
export interface MoraleState { m: number; fleeing: boolean; rallyT: number }
export const ROUT = 15, RALLY = 38;
