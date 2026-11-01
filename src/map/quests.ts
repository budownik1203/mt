// Quests (build 16), Warband-style: lords hand out letters to carry and
// bandits to hunt; village elders ask for goods or for a band to be driven
// off. Each quest shows reward, target and days left in the Chronicle.
import type { Campaign, Party } from "./campaign.ts";
import { LORDS, lordDef, lordRel, atWar } from "./factions.ts";
import { GOODS, Good, GOOD_IDS, econOf, tradeOf } from "./trade.ts";

export type QuestKind = "list" | "bandyci" | "dostawa";
export interface Quest { id: number; kind: QuestKind; giver: string; giverLord?: string; target?: string; party?: number; good?: Good; n?: number; reward: number; until: number; text: string }
let qid = 1;
const ql = (c: Campaign) => (c.co.quests ??= []);
export const quests = ql;

/** A lord offers a task (one at a time per giver). */
export function lordQuest(c: Campaign, lord: string): Quest | null {
  if (ql(c).some((q) => q.giverLord === lord)) return null;
  const d = lordDef(lord), f = c.fx.lords[lord].faction;
  if (c.rand() < 0.5) {
    const others = LORDS.filter((l) => l.id !== lord && c.fx.lords[l.id].faction === f && c.parties.some((p) => p.lord === l.id));
    const t = others[Math.floor(c.rand() * others.length)];
    if (t) return { id: qid++, kind: "list", giver: lord, giverLord: lord, target: t.id, reward: 70, until: c.day + 12, text: `Zanieś list od: ${d.title} ${d.name} do: ${t.title} ${t.name}` };
  }
  const p = spawnQuestBand(c);
  return p ? { id: qid++, kind: "bandyci", giver: lord, giverLord: lord, party: p.id, reward: 140, until: c.day + 10, text: `Rozbij bandę „${p.name}” grasującą na ziemiach: ${d.title} ${d.name}` } : null;
}
/** A village elder (or town council) asks for something. */
export function villageQuest(c: Campaign, sid: string): Quest | null {
  if (ql(c).some((q) => q.giver === sid)) return null;
  const s = c.w.settlements.find((q) => q.id === sid)!;
  if (c.rand() < 0.55) {
    const want = econOf(sid).want.length ? econOf(sid).want : GOOD_IDS;
    const g = want[Math.floor(c.rand() * want.length)], n = 6 + Math.floor(c.rand() * 8);
    return { id: qid++, kind: "dostawa", giver: sid, good: g, n, reward: Math.round(GOODS[g].base * n * 1.35), until: c.day + 14, text: `Przywieź do ${s.name}: ${n} × ${GOODS[g].name}` };
  }
  const p = spawnQuestBand(c, s.x, s.z);
  return p ? { id: qid++, kind: "bandyci", giver: sid, party: p.id, reward: 110, until: c.day + 10, text: `Przegoń bandę „${p.name}” spod ${s.name}` } : null;
}
function spawnQuestBand(c: Campaign, x?: number, z?: number) {
  const s = x === undefined ? c.w.settlements[Math.floor(c.rand() * c.w.settlements.length)] : { x, z: z! };
  const names = ["Psy Rogatego", "Bracia Szubienicy", "Kompania Wrony", "Ludzie Bez Twarzy", "Czerwone Kaptury"];
  const n = 8 + Math.floor(c.rand() * 6);
  const p = c.newParty("bandits", names[Math.floor(c.rand() * names.length)], s.x + 14 * (c.rand() - 0.5) + 8, s.z + 14 * (c.rand() - 0.5) + 8, [{ t: "rozbojnik", n, wounded: 0, xp: 0 }, { t: "herszt", n: 1, wounded: 0, xp: 0 }, { t: "chlop_luk", n: 2, wounded: 0, xp: 0 }]);
  p.home = { x: p.x, z: p.z }; p.gold = 60 + n * 6;
  return p;
}
export function accept(c: Campaign, q: Quest) { ql(c).push(q); c.note(`Zadanie: ${q.text}. Nagroda ${q.reward} gr, ${q.until - c.day} dni.`, "warn"); }

function complete(c: Campaign, q: Quest, extra = "") {
  c.co.quests = ql(c).filter((x) => x !== q);
  c.co.party.gold += q.reward; c.co.hero.renown += 5;
  if (q.giverLord) lordRel(c, q.giverLord, 8);
  else { const s = c.w.settlements.find((x) => x.id === q.giver); if (s) s.prosperity = Math.min(1, s.prosperity + 0.06); }
  c.note(`Zadanie wykonane: ${q.text}. ${q.reward} gr${extra}.`, "good");
}
/** Letters: deliver when you meet the addressee. */
export function letterFor(c: Campaign, lord: string) { return ql(c).find((q) => q.kind === "list" && q.target === lord); }
export function deliverLetter(c: Campaign, q: Quest) { if (q.target) lordRel(c, q.target, 3); complete(c, q, ", relacje +8 / +3"); }
/** Bands: after beating the party. */
export function bandBeaten(c: Campaign, p: Party) { const q = ql(c).find((x) => x.kind === "bandyci" && x.party === p.id); if (q) complete(c, q, q.giverLord ? `, ${lordDef(q.giverLord).name}: relacja +8` : ", wieś odetchnie"); return !!q; }
/** Deliveries: in the giver's settlement. */
export function deliveryHere(c: Campaign, sid: string) { return ql(c).find((q) => q.kind === "dostawa" && q.giver === sid); }
export function deliver(c: Campaign, q: Quest) {
  const h = tradeOf(c).cargo[q.good!]; if (!h || h.n < q.n!) return false;
  h.n -= q.n!; if (h.n <= 0) delete tradeOf(c).cargo[q.good!];
  complete(c, q, ", wieś bogatsza"); return true;
}
export function questsDaily(c: Campaign) {
  for (const q of [...ql(c)]) {
    if (q.kind === "bandyci" && !c.parties.some((p) => p.id === q.party)) { complete(c, q, " (bandę rozbił ktoś inny, ale zapłacili)"); continue; }
    if (q.kind === "list" && q.target && atWar(c.fx, c.fx.lords[q.target].faction, c.fx.lords[q.giverLord!].faction)) { c.co.quests = ql(c).filter((x) => x !== q); continue; }
    if (c.day > q.until) {
      c.co.quests = ql(c).filter((x) => x !== q);
      if (q.giverLord) lordRel(c, q.giverLord, -6);
      c.co.hero.renown = Math.max(0, c.co.hero.renown - 3);
      c.note(`Zadanie niewykonane w terminie: ${q.text}.`, "bad");
    }
  }
}
