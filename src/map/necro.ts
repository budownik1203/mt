// Necromancy (build 8): the Black Abbot's book, corpses and bones, camp rites,
// corruption with thresholds, necromancers on the map and the Inquisition's
// hunters that come for you once your eyes go black.
import type { Campaign, Party } from "./campaign.ts";
import { TROOPS, TroopId } from "./troops.ts";
import { undeadLimit } from "./hero.ts";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const undeadCount = (c: Campaign) => c.co.party.troops.reduce((a, s) => a + (TROOPS[s.t].undead ? s.n : 0), 0);
export const livingCount = (c: Campaign) => c.co.party.troops.reduce((a, s) => a + (TROOPS[s.t].undead ? 0 : s.n), 0);
export const corruption = (c: Campaign) => c.co.hero.corruption ?? 0;

const THRESH: [number, string][] = [
  [25, "Skóra blednie, dłonie są zimne. Psy warczą na twój widok."],
  [50, "Oczy ciemnieją jak węgle. W miastach ktoś napisał do Inkwizycji."],
  [75, "Czuć od ciebie grób. Wsie zamykają bramy, straże miast nie wpuszczają."],
  [100, "Serce bije raz na kilka oddechów. Jesteś bliżej nich niż żywych."],
];
/** Add (or remove) corruption; crossing a threshold leaves a line in the chronicle. */
export function corrupt(c: Campaign, n: number) {
  const h = c.co.hero, before = h.corruption ?? 0;
  h.corruption = clamp(before + n, 0, 100);
  for (const [t, txt] of THRESH) if (before < t && h.corruption >= t) c.note(txt, "bad");
}

/** Learn the art (book or teacher). */
export function learnNecromancy(c: Campaign, how: string) {
  const h = c.co.hero;
  if (h.necro) return false;
  h.necro = true; h.skills.nekromancja = Math.max(1, h.skills.nekromancja ?? 0);
  corrupt(c, 5);
  c.note(`${how} Znasz pierwsze słowa, które budzą martwych (Nekromancja 1).`, "warn");
  return true;
}

export interface Rite { id: "bones" | "flesh" | "empower" | "release" | "lich"; name: string; sub: string; off: boolean; why?: string }

function enemiesNear(c: Campaign, r: number) {
  const me = c.co.party;
  return c.parties.some((p) => p !== me && c.hostile(p) && Math.hypot(p.x - me.x, p.z - me.z) < r);
}

/** What can be done in the camp tonight. */
export function rites(c: Campaign): Rite[] {
  const co = c.co, h = co.hero, sk = h.skills.nekromancja ?? 0;
  const room = undeadLimit(h) - undeadCount(c);
  const danger = enemiesNear(c, 14);
  const bones = co.bones ?? 0, corpses = co.corpses ?? 0;
  const per = 3 + Math.floor(sk / 2);
  const out: Rite[] = [];
  const block = danger ? "wrogowie w pobliżu: rytuał zostałby przerwany" : !co.camp ? "najpierw rozbij obóz" : "";
  out.push({ id: "bones", name: "Podnieś szkielety z kości", sub: block || `6 kości na szkielet · do ${Math.min(per, room, Math.floor(bones / 6))} · 3 h · zepsucie +3`, off: !!block || room <= 0 || bones < 6 });
  out.push({ id: "flesh", name: "Ożyw ghule ze zwłok", sub: block || `2 ciała na ghula · do ${Math.min(Math.max(1, per - 1), room, Math.floor(corpses / 2))} · 4 h · zepsucie +5`, off: !!block || room <= 0 || corpses < 2 });
  const canUp = co.party.troops.some((s) => TROOPS[s.t].undead && TROOPS[s.t].upTo);
  out.push({ id: "empower", name: "Wzmocnij nieumarłych", sub: block || `do ${1 + sk} sztuk awansuje · 5 h · zepsucie +4`, off: !!block || !canUp });
  out.push({ id: "release", name: "Uwolnij nieumarłych", sub: "kości wracają do worka, ludzie odetchną", off: undeadCount(c) === 0 });
  if (sk >= 6 && (h.corruption ?? 0) >= 90 && !h.lich) out.push({ id: "lich", name: "Rytuał Licza", sub: block || "12 h · śmierć i powrót · limit nieumarłych ×2", off: !!block });
  return out;
}

/** Perform a rite; returns a paragraph for the menu. Time passes. */
export function doRite(c: Campaign, id: Rite["id"]): string {
  const co = c.co, h = co.hero, sk = h.skills.nekromancja ?? 0;
  const room = undeadLimit(h) - undeadCount(c);
  const per = 3 + Math.floor(sk / 2);
  const failP = clamp(0.3 - 0.04 * sk + (c.night ? -0.05 : 0.05), 0.04, 0.4);
  const fail = c.rand() < failP;
  const add = (t: TroopId, n: number) => { if (n > 0) c.addTroops(co.party, t, n); };
  if (id === "release") {
    const n = undeadCount(c);
    co.bones = (co.bones ?? 0) + n * 3;
    co.party.troops = co.party.troops.filter((s) => !TROOPS[s.t].undead);
    co.morale = Math.min(100, co.morale + 4);
    c.note(`Uwolniłeś ${n} nieumarłych. Kości stukają w worku.`, "");
    return `<p>Słowa wypowiedziane wspak. ${n} ciał osuwa się na ziemię jak sznurki bez lalkarza. Ludzie przy ognisku po raz pierwszy od dni rozmawiają głośno.</p>`;
  }
  if (id === "bones") {
    const n = Math.min(per, room, Math.floor((co.bones ?? 0) / 6));
    c.passHours(3); co.bones = (co.bones ?? 0) - n * 6;
    corrupt(c, 3);
    if (fail) return failed(c, n, "szkielety");
    add("szkielet", n);
    c.note(`Rytuał: wstało ${n} szkieletów.`, "warn");
    return `<p>Kości układacie w krąg, czaszki do środka. Przy trzecim powtórzeniu słów coś trzaska. ${n} szkieletów wstaje i czeka na rozkaz.</p>`;
  }
  if (id === "flesh") {
    const n = Math.min(Math.max(1, per - 1), room, Math.floor((co.corpses ?? 0) / 2));
    c.passHours(4); co.corpses = (co.corpses ?? 0) - n * 2;
    corrupt(c, 5);
    if (fail) return failed(c, n, "ghule");
    add("ghul", n);
    c.note(`Rytuał: ${n} ghuli wypełzło ze stosu ciał.`, "warn");
    return `<p>Dwa ciała na jedno. Ciało zrasta się z ciałem, skóra szarzeje, paznokcie czernieją. ${n} ghuli kuca u twoich stóp, dysząc bez potrzeby.</p>`;
  }
  if (id === "empower") {
    c.passHours(5); corrupt(c, 4);
    if (fail) { c.note("Rytuał wzmocnienia nie powiódł się.", "bad"); return `<p>Krew na kościach zasycha, a nic się nie dzieje. Stracona noc.</p>`; }
    let left = 1 + sk; const done: string[] = [];
    for (const s of [...co.party.troops]) {
      const T = TROOPS[s.t]; if (!T.undead || !T.upTo || left <= 0) continue;
      const k = Math.min(s.n, left); s.n -= k; left -= k; add(T.upTo, k); done.push(`${k} × ${TROOPS[T.upTo].name.pl}`);
    }
    co.party.troops = co.party.troops.filter((s) => s.n > 0);
    c.note(`Wzmocnienie: ${done.join(", ")}.`, "warn");
    return `<p>Stare żelazo z grobów, rdza i twoja krew. Nad ranem: ${done.join(", ")}.</p>`;
  }
  // lich
  c.passHours(12);
  h.lich = true; corrupt(c, 10);
  c.note("Rytuał Licza. Umarłeś o północy i wstałeś o świcie.", "bad");
  return `<p>O północy serce staje. O świcie otwierasz oczy i nie czujesz zimna. Martwi słuchają cię teraz jak własnej ręki (limit nieumarłych ×2). Żywi nie spojrzą ci już w oczy.</p>`;
}

function failed(c: Campaign, n: number, what: string) {
  corrupt(c, 3);
  if (n >= 2 && c.rand() < 0.5) {
    const me = c.co.party;
    c.spawn("undead", { x: me.x + 2, z: me.z + 1 }, n + 1);
    c.note(`Rytuał wymknął się spod kontroli: ${what} rzucają się na obóz.`, "bad");
    return `<p>Słowo pada źle. To, co wstaje, nie patrzy na ciebie, tylko na twoich ludzi. Wypadają z kręgu i biegną w ciemność. Zaraz wrócą.</p>`;
  }
  c.note(`Rytuał nie powiódł się (${what}).`, "bad");
  return `<p>Krąg pęka. Z nosa leci ci krew, a materiał rozsypuje się w proch. Stracona noc.</p>`;
}

// ---------- places ----------
export interface PlaceAct { label: string; sub: string; off?: boolean; run: () => string }
/** Things to do at the POI the camp stands at (graveyard, burned chapel). */
export function placeActs(c: Campaign): PlaceAct[] {
  const me = c.co.party, co = c.co, out: PlaceAct[] = [];
  const near = (id: string) => { const q = c.w.pois.find((p) => p.id === id); return q && Math.hypot(q.x - me.x, q.z - me.z) < 7 ? q : null; };
  if (near("ruin2") && !co.foundBook) out.push({ label: "Przeszukaj zgliszcza kaplicy", sub: "2 h · coś tu było pod posadzką", run: () => {
    c.passHours(2); co.foundBook = true;
    learnNecromancy(c, "W krypcie Spalonej Kaplicy, w ołowianej skrzyni: Księga Czarnego Opata.");
    return `<p>Pod spękaną płytą ołtarza jest krypta, a w niej ołowiana skrzynia. W środku księga oprawiona w coś, co nie jest skórą cielęcą. Litery ruszają się, gdy na nie patrzysz.</p><p class="meta">Nauczyłeś się nekromancji. Umiejętność Nekromancja (Wiedza) rośnie jak inne. Rytuały w menu obozu.</p>`;
  } });
  const g = near("grave1");
  if (g) {
    const wait = (co.dugDay ?? -99) + 6 - c.day;
    out.push({ label: "Rozkop groby", sub: wait > 0 ? `ziemia jeszcze świeża (${wait} d)` : "3 h · kości · morale żywych spada · ryzyko", off: wait > 0, run: () => {
      c.passHours(3); co.dugDay = c.day;
      const n = 6 + Math.floor(c.rand() * 9);
      co.bones = (co.bones ?? 0) + n; corrupt(c, 2);
      if (livingCount(c) > 0) co.morale -= 5;
      if (c.rand() < 0.25) {
        c.spawn("undead", { x: g.x + 1, z: g.z + 1 }, 5 + Math.floor(c.rand() * 4));
        c.note("Coś pod cmentarzem nie chciało być ruszane.", "bad");
        return `<p>Wydobywacie ${n} kości, gdy łopata trafia na coś, co chwyta za trzonek. Ziemia rusza się w kilku miejscach naraz.</p>`;
      }
      c.note(`Rozkopane groby: ${n} kości.`, "warn");
      return `<p>Łopaty, worki, smród. ${n} kości trafia do worka. Grabarz z pobliskiej wsi patrzy z daleka i żegna się.</p>`;
    } });
  }
  return out;
}

// ---------- daily ----------
export function necroDaily(c: Campaign) {
  const co = c.co, h = co.hero;
  co.corpses = Math.floor((co.corpses ?? 0) * 0.7);          // flesh rots, bones keep
  const und = undeadCount(c), liv = livingCount(c);
  if (und && liv) co.morale -= Math.min(6, und * 0.3) * (1 - 0.08 * h.skills.dowodzenie);
  if (und) corrupt(c, 0.25);
  // hunters come at corruption 50+
  const cor = h.corruption ?? 0;
  if (cor >= 50 && !c.parties.some((p) => p.kind === "hunters") && c.rand() < 0.25 + (cor - 50) / 200) spawnHunters(c);
  for (const p of c.parties) if (p.kind === "hunters" && cor >= 50) p.home = { x: c.co.party.x, z: c.co.party.z };   // they ask around and follow
  // a necromancer walks the cursed places
  if (!c.parties.some((p) => p.kind === "necro") && c.rand() < 0.08) spawnNecromancer(c);
}
export function spawnHunters(c: Campaign) {
  const t = c.w.settlements.find((s) => s.id === "morwen") ?? c.w.settlements[0];
  const n = 5 + Math.floor((corruption(c) - 40) / 10);
  const p = c.newParty("hunters", "Łowcy czarownic", t.x + 3, t.z + 3, [{ t: "lowca", n: Math.max(4, n), wounded: 0, xp: 0 }, { t: "zbrojny", n: 4, wounded: 0, xp: 0 }]);
  p.gold = 90; p.mode = "roam"; p.home = { x: t.x, z: t.z };
  c.note("Ze Sankt Morwen wyjechał oddział łowców czarownic. Pytają o ciebie.", "bad");
  return p;
}
export function spawnNecromancer(c: Campaign, at?: { x: number; z: number }) {
  const cur = c.w.pois.filter((q) => q.kind === "cursed" || q.kind === "graveyard");
  const q = at ?? cur[Math.floor(c.rand() * cur.length)];
  const p = c.newParty("necro", "Nekromanta", q.x, q.z, [{ t: "nekromanta", n: 1, wounded: 0, xp: 0 }, { t: "szkielet", n: 5 + Math.floor(c.rand() * 5), wounded: 0, xp: 0 }, { t: "ghul", n: 2 + Math.floor(c.rand() * 3), wounded: 0, xp: 0 }]);
  p.gold = 60; p.home = { x: q.x, z: q.z };
  c.note("Ludzie mówią o człowieku w czarnym, za którym idą kości.", "warn");
  return p;
}

/** After a won fight: what the necromancer can carry off the field. */
export function harvest(c: Campaign, p: Party, livingDead: number, undeadDead: number) {
  const co = c.co;
  co.corpses = (co.corpses ?? 0) + livingDead;
  co.bones = (co.bones ?? 0) + undeadDead * 2 + Math.floor(livingDead / 2);
  corrupt(c, 1);
  if (livingCount(c) > 0) co.morale -= 3;
  return `${livingDead} ciał i ${undeadDead * 2 + Math.floor(livingDead / 2)} kości do worków`;
}
