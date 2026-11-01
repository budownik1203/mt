// Monsters and contracts (build 10): lairs keep a beast (or a pack) that hunts
// villages at night; villages and towns post contracts; a short investigation
// in three steps (talk, tracks, preparation) weakens the beast before the fight.
import type { Campaign, Party } from "./campaign.ts";
import type { TroopId } from "./troops.ts";
import { lordRel } from "./factions.ts";

export interface MonsterDef { id: string; lair: string; name: string; troops: [TroopId, number, number][]; reward: number; renown: number; hunt: string; weakness: string; clues: [string, string, string]; bait: string }
export const MONSTERS: MonsterDef[] = [
  { id: "wilkolak", lair: "lair_wolf", name: "Wilkołak z Wilczej Jamy", troops: [["wilkolak", 1, 1]], reward: 380, renown: 30,
    hunt: "Zagryzione bydło, potem pasterz. Ślady łap wielkich jak talerz, ale chodzi na dwóch nogach.",
    weakness: "srebro i ogień; za dnia śpi w ludzkiej skórze",
    clues: ["Wdowa po pasterzu: „Wył przy pełni, a rano Jasiek od młynarza miał krew pod paznokciami”.", "Tropy prowadzą na wschód, do jamy pod korzeniami starego dębu. Sierść na cierniach, siwa.", "Kowal przetapia twój srebrny grosz na groty. Ludzie smarują ostrza czosnkiem i smołą."],
    bait: "srebrne groty i smoła: wilkołak traci jedną czwartą sił" },
  { id: "utopce", lair: "lair_water", name: "Utopce z Topieli", troops: [["utopiec", 5, 9]], reward: 220, renown: 15,
    hunt: "Z Topieli wyłażą nocą i wciągają do wody każdego, kto stanie na kładce. Trzy dzieci zaginęły przy praniu.",
    weakness: "nie znoszą suchej ziemi i ognia; poza wodą słabną",
    clues: ["Rybak: „Wychodzą, kiedy księżyc na wodzie. Śpiewają jak dziewczyny, a zęby mają jak szczupak”.", "Na brzegu ścieżki w szuwarach, wydeptane od wody. Gnijące sieci, kości ryb i ludzi.", "Zasypujecie kładkę piachem i stawiacie ogniska wzdłuż brzegu: utopce wyjdą na suchy grunt."],
    bait: "ogniska na brzegu: utopce wychodzą na suchą ziemię i słabną" },
  { id: "strzyga", lair: "lair_strzyga", name: "Strzyga z kurhanu", troops: [["strzyga", 1, 1], ["zywy_trup", 2, 4]], reward: 320, renown: 25,
    hunt: "Ktoś wychodzi z kurhanu i pije krew śpiących. We wsi trzy trupy blade jak płótno, z ranami na szyi.",
    weakness: "ma dwie dusze: jedną trzeba zabić, drugą przybić do ziemi",
    clues: ["Babka zielarka: „Urodziła się z dwoma rzędami zębów. Pochowali ją twarzą do ziemi, ale ktoś odkopał”.", "Grób w kurhanie rozkopany od środka. Na kamieniach ślady paznokci i stara krew.", "Ksiądz daje osikowy kołek i sierp. Z sierpem pod głową nie wstanie drugi raz."],
    bait: "osikowe kołki i sierp: strzyga słabsza o jedną czwartą, jej trupy padają szybciej" },
];
export const monsterDef = (id: string) => MONSTERS.find((m) => m.id === id)!;

export interface Contract { monster: string; from: string; reward: number; until: number; steps: number; party: number }

/** Spawn the beast of a lair (if not alive). */
export function spawnMonster(c: Campaign, id: string) {
  const d = monsterDef(id), L = c.w.pois.find((q) => q.id === d.lair)!;
  const troops = d.troops.map(([t, a, b]) => ({ t, n: a + Math.floor(c.rand() * (b - a + 1)), wounded: 0, xp: 0 }));
  const p = c.newParty("monster", d.name, L.x + 1, L.z + 1, troops);
  p.monster = id; p.home = { x: L.x, z: L.z }; p.gold = 0; p.mode = "idle";
  return p;
}
export const monsterParty = (c: Campaign, id: string) => c.parties.find((p) => p.monster === id);

/** Map AI: hunt the nearest village at night, sleep in the lair by day. */
export function monsterThink(c: Campaign, p: Party, h: number, dPlayer: number) {
  const me = c.co.party;
  p.think -= 0;
  if (dPlayer < (c.night ? 8 : 4) && c.partyPower(p) > c.partyPower(me) * 0.4) { if (p.mode !== "chase" || p.think <= 0) { p.mode = "chase"; p.path = [[me.x, me.z]]; p.think = 0.5; } return; }
  if (p.path.length) return;
  const home = p.home!;
  if (p.mode === "travel" && p.dest) {      // arrived at a village: blood
    const s = c.w.settlements.find((q) => q.id === p.dest);
    p.dest = undefined;
    if (s && !s.burned) {
      s.pop = Math.max(20, s.pop - 3); s.prosperity = Math.max(0.1, s.prosperity - 0.04);
      const near = Math.hypot(s.x - me.x, s.z - me.z) < 50;
      c.note(`${p.name} napada nocą na ${s.name}. Rano liczą trupy.${near ? "" : " (wieści z daleka)"}`, "bad");
      if (!c.contracts.some((k) => k.monster === p.monster) && !c.offers.includes(p.monster!)) c.offers.push(p.monster!);
    }
  }
  if (c.night && p.think <= 0) {
    const vs = c.w.settlements.filter((s) => s.kind === "village" && !s.burned).sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z)).slice(0, 2);
    const s = vs[Math.floor(c.rand() * vs.length)];
    if (s && c.rand() < 0.35) { p.path = c.route(p, s.x + 1, s.z + 1) ?? []; p.dest = s.id; p.mode = "travel"; p.think = 20; return; }
    p.think = 6;
  }
  if (!c.night && Math.hypot(p.x - home.x, p.z - home.z) > 2) { p.path = c.route(p, home.x + 1, home.z + 1) ?? []; p.mode = "roam"; }
}

/** Daily: lairs refill; contracts run out. */
export function monstersDaily(c: Campaign) {
  for (const d of MONSTERS) if (c.w.pois.some((q) => q.id === d.lair) && !monsterParty(c, d.id) && c.rand() < 0.04) { spawnMonster(c, d.id); c.note(`Mówią, że w miejscu zwanym ${c.w.pois.find((q) => q.id === d.lair)!.name} znów coś się zalęgło.`, "warn"); }
  for (const k of [...c.contracts]) if (c.day > k.until) {
    c.contracts.splice(c.contracts.indexOf(k), 1);
    const s = c.w.settlements.find((q) => q.id === k.from)!;
    c.co.hero.renown = Math.max(0, c.co.hero.renown - 5);
    const lid = c.fx.fief[s.id]; if (lid && lid !== "player") lordRel(c, lid, -5);
    c.note(`Kontrakt z ${s.name} przepadł. Ludzie mówią, że wziąłeś zaliczkę na nic.`, "bad");
  }
}

/** Who has a job here: a beast that has hit this place or is within reach. */
export function offerAt(c: Campaign, sid: string) {
  const s = c.w.settlements.find((q) => q.id === sid)!;
  if (!s) return null;
  for (const d of MONSTERS) {
    if (c.contracts.some((k) => k.monster === d.id)) continue;
    const p = monsterParty(c, d.id); if (!p) continue;
    const L = p.home!;
    if (Math.hypot(L.x - s.x, L.z - s.z) < 75) return d;
  }
  return null;
}
export function takeContract(c: Campaign, sid: string, d: MonsterDef) {
  const p = monsterParty(c, d.id)!;
  const s = c.w.settlements.find((q) => q.id === sid)!;
  const reward = Math.round(d.reward * (s.kind === "town" ? 1.3 : 1) * (0.7 + s.prosperity * 0.6));
  c.contracts.push({ monster: d.id, from: sid, reward, until: c.day + 20, steps: 0, party: p.id });
  c.offers = c.offers.filter((x) => x !== d.id);
  c.note(`Kontrakt: ${d.name}. Nagroda ${reward} gr, 20 dni.`, "warn");
}
/** Called after a won battle against a monster party. */
export function monsterSlain(c: Campaign, p: Party): string {
  const d = monsterDef(p.monster!);
  const k = c.contracts.find((x) => x.monster === d.id);
  c.co.hero.renown += d.renown;
  if (!k) { c.note(`${d.name} nie żyje. Nikt ci za to nie zapłaci, ale ludzie będą mówić.`, "good"); return `<p>Bez kontraktu nikt nie zapłaci, ale wieść się rozniesie (sława +${d.renown}). Trofeum na wozie.</p>`; }
  c.contracts.splice(c.contracts.indexOf(k), 1);
  const s = c.w.settlements.find((q) => q.id === k.from)!;
  c.co.party.gold += k.reward; s.prosperity = Math.min(1, s.prosperity + 0.08);
  const lid = c.fx.fief[s.id]; if (lid && lid !== "player") lordRel(c, lid, 6);
  c.note(`Kontrakt wypełniony: ${d.name}. ${k.reward} gr z ${s.name}.`, "good");
  return `<p>Głowę wieziecie do: <b>${s.name}</b>. Ludzie wychodzą na drogę. Nagroda: <b>${k.reward} gr</b>, sława +${d.renown}.</p>`;
}
