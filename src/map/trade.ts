// Trade goods (build 16): each settlement makes some goods cheaply and wants
// others dearly; stocks move with every sale and refill daily; the wagons
// carry a limited load; the last prices you saw are remembered per town.
// Tournaments are announced in a town for a few days.
import type { Campaign } from "./campaign.ts";

export type Good = "sol" | "zelazo" | "sukno" | "wino" | "futra" | "wosk" | "smola";
export const GOODS: Record<Good, { name: string; base: number }> = {
  sol: { name: "Sól", base: 26 }, zelazo: { name: "Żelazo", base: 42 }, sukno: { name: "Sukno", base: 36 }, wino: { name: "Wino", base: 52 },
  futra: { name: "Futra", base: 32 }, wosk: { name: "Wosk", base: 22 }, smola: { name: "Smoła", base: 16 },
};
export const GOOD_IDS = Object.keys(GOODS) as Good[];
/** What each place makes and what it craves. */
const ECON: Record<string, { make: Good[]; want: Good[] }> = {
  grauburg: { make: ["zelazo", "sukno"], want: ["futra", "wosk", "sol"] },
  wronsk: { make: ["futra", "smola"], want: ["wino", "zelazo", "sukno"] },
  morwen: { make: ["wino", "wosk"], want: ["zelazo", "sol", "futra"] },
  straznica: { make: [], want: ["zelazo", "smola", "sol"] },
  lindenau: { make: ["zelazo"], want: ["sol"] }, harz: { make: ["sukno"], want: ["smola"] },
  popielec: { make: ["wino"], want: ["sukno"] }, zablocie: { make: ["wosk"], want: ["zelazo"] },
  gnilowo: { make: ["smola"], want: ["sol"] }, brzezie: { make: ["futra"], want: ["sol"] }, ostrowie: { make: ["futra", "wosk"], want: ["zelazo"] },
  mokradle: { make: ["sol"], want: ["sukno"] },
  hansberg: { make: ["sukno", "sol", "wino"], want: ["futra", "smola", "wosk"] }, szarowody: { make: ["sol", "smola"], want: ["zelazo", "wino"] },
  komturia: { make: [], want: ["zelazo", "wino", "wosk"] }, pokuta: { make: [], want: ["smola", "sol"] }, martwogrod: { make: ["wosk"], want: ["sol", "smola"] },
  altmark: { make: ["sukno"], want: ["futra"] }, salzdorf: { make: ["sol"], want: ["zelazo"] }, kielbruck: { make: ["smola"], want: ["wino"] },
  brzask: { make: ["futra"], want: ["sukno"] }, swietobor: { make: ["wosk"], want: ["sol"] }, graniczna: { make: ["futra"], want: ["zelazo"] },
  kostnica: { make: ["wosk"], want: ["sol"] }, popielisko: { make: ["smola"], want: ["sukno"] }, wilcze: { make: ["futra"], want: ["wino"] }, krucz: { make: ["smola"], want: ["sukno"] },
};
export const econOf = (sid: string) => ECON[sid] ?? { make: [], want: [] };

export interface TradeState { stock: Record<string, Partial<Record<Good, number>>>; cargo: Partial<Record<Good, { n: number; cost: number }>>; seen: Record<string, { day: number; buy: Partial<Record<Good, number>>; sell: Partial<Record<Good, number>> }>; tourney?: { town: string; until: number } }
export const tradeOf = (c: Campaign): TradeState => (c.co.trade ??= { stock: {}, cargo: {}, seen: {} });
const baseStock = (sid: string, g: Good) => econOf(sid).make.includes(g) ? 30 : econOf(sid).want.includes(g) ? 3 : 10;
function stock(c: Campaign, sid: string, g: Good) { const t = tradeOf(c); const s = (t.stock[sid] ??= {}); if (s[g] === undefined) s[g] = baseStock(sid, g); return s[g]!; }

/** Price per unit here: what you pay (buy) and what you get (sell). */
export function price(c: Campaign, sid: string, g: Good) {
  const e = econOf(sid), b = GOODS[g].base, st = stock(c, sid, g);
  const k = (e.make.includes(g) ? 0.74 : 1) * (e.want.includes(g) ? 1.32 : 1) * Math.max(0.7, Math.min(1.45, 1.3 - st / 45));
  const spread = 0.12 - 0.015 * c.co.hero.skills.handel;
  return { buy: Math.max(1, Math.round(b * k * (1 + spread))), sell: Math.max(1, Math.round(b * k * (1 - spread))), stock: st };
}
export const cargoCount = (c: Campaign) => GOOD_IDS.reduce((a, g) => a + (tradeOf(c).cargo[g]?.n ?? 0), 0);
export const cargoCap = (c: Campaign) => 30 + 10 * c.co.hero.skills.handel + Math.floor(c.men / 5) * 2;

export function buy(c: Campaign, sid: string, g: Good, n: number) {
  const t = tradeOf(c);
  for (let i = 0; i < n; i++) {
    const p = price(c, sid, g);
    if (c.co.party.gold < p.buy || p.stock <= 0 || cargoCount(c) >= cargoCap(c)) break;
    c.co.party.gold -= p.buy; t.stock[sid]![g] = p.stock - 1;
    const h = (t.cargo[g] ??= { n: 0, cost: 0 }); h.cost = (h.cost * h.n + p.buy) / (h.n + 1); h.n++;
  }
}
export function sell(c: Campaign, sid: string, g: Good, n: number) {
  const t = tradeOf(c), h = t.cargo[g]; if (!h) return 0;
  let profit = 0;
  for (let i = 0; i < n && h.n > 0; i++) { const p = price(c, sid, g); c.co.party.gold += p.sell; profit += p.sell - h.cost; t.stock[sid]![g] = p.stock + 1; h.n--; }
  if (h.n <= 0) delete t.cargo[g];
  return Math.round(profit);
}
/** Remember the prices of this place (shown elsewhere as "best known"). */
export function notePrices(c: Campaign, sid: string) {
  const buyP: Partial<Record<Good, number>> = {}, sellP: Partial<Record<Good, number>> = {};
  for (const g of GOOD_IDS) { const p = price(c, sid, g); buyP[g] = p.buy; sellP[g] = p.sell; }
  tradeOf(c).seen[sid] = { day: c.day, buy: buyP, sell: sellP };
}
export function bestKnown(c: Campaign, g: Good, here: string) {
  let best: { sid: string; v: number; day: number } | null = null;
  for (const [sid, s] of Object.entries(tradeOf(c).seen)) { if (sid === here) continue; const v = s.sell[g] ?? 0; if (!best || v > best.v) best = { sid, v, day: s.day }; }
  return best;
}

export function tradeDaily(c: Campaign) {
  const t = tradeOf(c);
  for (const [sid, st] of Object.entries(t.stock)) for (const g of GOOD_IDS) { const b = baseStock(sid, g), v = st[g] ?? b; st[g] = v + Math.sign(b - v) * Math.min(Math.abs(b - v), 2); }
  // a tournament now and then
  if (t.tourney && t.tourney.until < c.day) t.tourney = undefined;
  if (!t.tourney && c.rand() < 0.07) {
    const towns = c.w.settlements.filter((s) => s.kind === "town" && !s.burned);
    const s = towns[Math.floor(c.rand() * towns.length)];
    t.tourney = { town: s.id, until: c.day + 6 };
    c.note(`Heroldowie ogłaszają turniej w: ${s.name} (przez 6 dni). Nagroda 250 gr i sława.`, "warn");
  }
}
