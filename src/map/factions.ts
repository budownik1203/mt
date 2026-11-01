// Factions and lords (build 9), Warband-style: three realms of the region,
// hand-written lords with personalities and memory (relation with the player),
// fiefs, wars and peace, lord armies that recruit, patrol, raid villages,
// besiege castles and fight each other; the player as mercenary or vassal.
import type { Campaign, Party, Stack } from "./campaign.ts";
import type { TroopId } from "./troops.ts";
import type { Settlement } from "./world.ts";

export type FactionId = "cesarstwo" | "arcybiskupstwo" | "wronsk";
export type Persona = "honorowy" | "okrutny" | "chciwy" | "ostrozny" | "fanatyk";
export const PERSONA: Record<Persona, { pl: string; hint: string }> = {
  honorowy: { pl: "honorowy", hint: "ceni dane słowo i uwolnionych jeńców; nie znosi grabieży" },
  okrutny: { pl: "okrutny", hint: "lubi, gdy wieś płonie; litość uważa za słabość" },
  chciwy: { pl: "chciwy", hint: "wszystko ma cenę; łupy i srebro poprawiają relację" },
  ostrozny: { pl: "ostrożny", hint: "nie atakuje silniejszych; szanuje zwycięzców" },
  fanatyk: { pl: "fanatyk", hint: "nienawidzi nekromancji i pogan; spowiedź i krucjata go cieszą" },
};

export interface FactionDef { id: FactionId; name: string; short: string; color: number; culture: Settlement["culture"]; ruler: string; troops: [TroopId, number][]; title: string }
export const FACTIONS: Record<FactionId, FactionDef> = {
  cesarstwo: { id: "cesarstwo", name: "Cesarstwo Popielne", short: "Cesarstwo", color: 0x8a2a1c, culture: "german", ruler: "ulrich", title: "margrabia",
    troops: [["halabardnik", 4], ["zbrojny", 3], ["pacholek", 2], ["kusznik", 2], ["arkebuzer", 1.2], ["plytowy", 1.2], ["rycerz", 0.5], ["jezdziec", 1], ["rycerz_konny", 0.6]] },
  arcybiskupstwo: { id: "arcybiskupstwo", name: "Arcybiskupstwo Morweńskie", short: "Arcybiskupstwo", color: 0xc9b98a, culture: "church", ruler: "lotar", title: "arcybiskup",
    troops: [["zbrojny", 4], ["lowca", 1], ["pacholek", 2], ["kusznik", 1.5], ["chlop", 2], ["rycerz", 0.8], ["jezdziec", 1]] },
  wronsk: { id: "wronsk", name: "Księstwo Wrońskie", short: "Wrońsk", color: 0x2a4a6a, culture: "slav", ruler: "wsiewolod", title: "kniaź",
    troops: [["chlop", 4], ["pacholek", 3], ["lucznik", 3], ["zbrojny", 2], ["halabardnik", 1], ["rycerz", 0.8], ["jezdziec", 1.5], ["rycerz_konny", 0.3]] },
};
export const FIDS = Object.keys(FACTIONS) as FactionId[];

export interface LordDef { fem?: boolean; id: string; name: string; title: string; faction: FactionId; persona: Persona; size: number; seat: string; line: string }
export const LORDS: LordDef[] = [
  { id: "ulrich", name: "Ulrich von Asch", title: "Margrabia", faction: "cesarstwo", persona: "honorowy", size: 46, seat: "grauburg", line: "Cesarstwo spłonęło, ale popiół jeszcze pamięta, kto tu rządził." },
  { id: "brenner", name: "Konrad Brenner", title: "Hauptmann", faction: "cesarstwo", persona: "chciwy", size: 34, seat: "lindenau", line: "Mów szybko. Każda godzina gadania to godzina żołdu za darmo." },
  { id: "ottokar", name: "Ottokar Grau", title: "Rycerz", faction: "cesarstwo", persona: "okrutny", size: 30, seat: "harz", line: "Chłop, który nie płaci, wisi. Chłop, który płaci, też kiedyś zawiśnie." },
  { id: "lotar", name: "Lotar z Morwen", title: "Arcybiskup", faction: "arcybiskupstwo", persona: "fanatyk", size: 44, seat: "morwen", line: "Bóg milczy od dwudziestu lat. Ktoś musi mówić w Jego imieniu." },
  { id: "anzelm", name: "Anzelm Szary", title: "Komtur", faction: "arcybiskupstwo", persona: "ostrozny", size: 32, seat: "popielec", line: "Martwi wstają szybciej, niż zdążamy ich palić. Liczę każdego człowieka." },
  { id: "mateusz", name: "Brat Mateusz Kat", title: "Inkwizytor", faction: "arcybiskupstwo", persona: "okrutny", size: 28, seat: "zablocie", line: "Każdy ma coś do wyznania. Pytanie tylko, ile to potrwa." },
  { id: "wsiewolod", name: "Wsiewołod Wroński", title: "Kniaź", faction: "wronsk", persona: "chciwy", size: 48, seat: "wronsk", line: "Wrońsk stał, zanim przyszli Niemcy i księża. Będzie stał, gdy odejdą." },
  { id: "bratumil", name: "Bratumił z Brzezia", title: "Wojewoda", faction: "wronsk", persona: "honorowy", size: 36, seat: "straznica", line: "Strażnica trzyma granicę z Trupim Polem. Ktoś musi." },
  { id: "zyroslaw", name: "Żyrosław Czarny", title: "Bojar", faction: "wronsk", persona: "okrutny", size: 30, seat: "gnilowo", line: "Na moich ziemiach wieszamy na wierzbach. Tańsze niż szubienica." },
  { fem: true, id: "dobroslawa", name: "Dobrosława z Ostrowia", title: "Bojarka", faction: "wronsk", persona: "ostrozny", size: 26, seat: "ostrowie", line: "Mój mąż poległ pod Grauburgiem. Teraz to ja prowadzę jego ludzi." },
];
export const lordDef = (id: string) => LORDS.find((l) => l.id === id)!;

export interface LordState { id: string; rel: number; party: number; down: number; captive: boolean; faction: FactionId }
export interface FxState {
  owner: Record<string, FactionId>;          // settlement → faction
  fief: Record<string, string>;              // settlement → lord id ("player" for the player's own)
  garrison: Record<string, number>;
  looted: Record<string, number>;            // village → days until rebuilt
  wars: string[];                            // "a|b" sorted pairs at war
  warDay: Record<string, number>;            // pair → day of last change
  rel: Record<FactionId, number>;            // faction → relation with the player
  lords: Record<string, LordState>;
  join?: { f: FactionId; role: "mercenary" | "vassal"; until: number };
  captives?: string[];                       // lords the player holds
}

const pair = (a: FactionId, b: FactionId) => [a, b].sort().join("|");
export const atWar = (fx: FxState, a: FactionId, b: FactionId) => a !== b && fx.wars.includes(pair(a, b));

export function newFx(c: Campaign): FxState {
  const fx: FxState = { owner: {}, fief: {}, garrison: {}, looted: {}, wars: [pair("cesarstwo", "wronsk")], warDay: {}, rel: { cesarstwo: 0, arcybiskupstwo: 5, wronsk: 0 }, lords: {}, captives: [] };
  for (const s of c.w.settlements) {
    const f = FIDS.find((id) => FACTIONS[id].culture === s.culture)!;
    fx.owner[s.id] = f;
    fx.garrison[s.id] = s.kind === "town" ? 40 : s.kind === "castle" ? 30 : 0;
  }
  for (const l of LORDS) { fx.fief[l.seat] = l.id; fx.lords[l.id] = { id: l.id, rel: 0, party: 0, down: 0, captive: false, faction: l.faction }; }
  // remaining villages go to the ruler
  for (const s of c.w.settlements) if (!fx.fief[s.id]) fx.fief[s.id] = FACTIONS[fx.owner[s.id]].ruler;
  return fx;
}

/** Spawn every lord's army at his seat (start of a campaign). */
export function spawnLords(c: Campaign) {
  for (const l of LORDS) spawnLord(c, l.id, 0.7);
}
function armyFor(f: FactionId, n: number): Stack[] {
  const mix = FACTIONS[f].troops, tot = mix.reduce((a, m) => a + m[1], 0);
  return mix.map(([t, w]) => ({ t, n: Math.max(0, Math.round(n * w / tot)), wounded: 0, xp: 0 })).filter((s) => s.n > 0);
}
export function spawnLord(c: Campaign, id: string, frac = 0.5) {
  const fx = c.fx, d = lordDef(id), st = fx.lords[id];
  const seat = c.w.settlements.find((s) => s.id === seatOf(c, id)) ?? c.w.settlements.find((s) => fx.owner[s.id] === st.faction) ?? c.w.settlements[0];
  const p = c.newParty("lord", `${d.title} ${d.name}`, seat.x + 3, seat.z - 2, armyFor(st.faction, Math.round(d.size * frac)));
  p.lord = id; p.faction = st.faction; p.gold = 200; p.home = { x: seat.x, z: seat.z }; p.mode = "idle";
  st.party = p.id; st.down = 0;
  return p;
}
/** The lord's seat: his first fief, or the faction's capital. */
export function seatOf(c: Campaign, id: string) {
  const own = Object.keys(c.fx.fief).filter((s) => c.fx.fief[s] === id);
  const d = lordDef(id);
  return own.includes(d.seat) ? d.seat : own[0] ?? c.w.settlements.find((s) => c.fx.owner[s.id] === c.fx.lords[id].faction && s.kind !== "village")?.id ?? d.seat;
}

// ---------- the player and the realms ----------
export const playerFaction = (c: Campaign) => c.fx.join?.f;
/** Is this faction at war with the player (personally, or through his liege)? */
export function hostileTo(c: Campaign, f: FactionId) {
  const fx = c.fx, mine = fx.join?.f;
  if (mine === f) return false;
  return fx.rel[f] <= -20 || (!!mine && atWar(fx, mine, f));
}
export function changeRel(c: Campaign, f: FactionId, n: number, why = "") {
  const before = c.fx.rel[f];
  c.fx.rel[f] = Math.max(-100, Math.min(100, before + n));
  if (before > -20 && c.fx.rel[f] <= -20) c.note(`${FACTIONS[f].name} uważa cię za wroga${why ? ` (${why})` : ""}.`, "bad");
  if (c.fx.join?.f === f && c.fx.rel[f] < -10) { c.note(`${FACTIONS[f].name} zrywa twoją służbę.`, "bad"); c.fx.join = undefined; }
}
export function lordRel(c: Campaign, id: string, n: number) {
  const st = c.fx.lords[id]; st.rel = Math.max(-100, Math.min(100, st.rel + n));
}
export const relWord = (r: number) => r >= 50 ? "przyjaciel" : r >= 20 ? "życzliwy" : r > -10 ? "obojętny" : r > -40 ? "nieufny" : "wróg";

/** Mercenary contract: 30 days, paid weekly by the realm. */
export function hire(c: Campaign, f: FactionId) {
  c.fx.join = { f, role: "mercenary", until: c.day + 30 };
  changeRel(c, f, 5);
  c.note(`Kontrakt najemny z: ${FACTIONS[f].name} (30 dni). Jej wrogowie są teraz twoimi wrogami.`, "warn");
}
export function vassal(c: Campaign, f: FactionId) {
  c.fx.join = { f, role: "vassal", until: 0 };
  changeRel(c, f, 10);
  // a village fief from the ruler's own hand
  const r = FACTIONS[f].ruler;
  const v = c.w.settlements.find((s) => s.kind === "village" && c.fx.owner[s.id] === f && c.fx.fief[s.id] === r && !s.burned);
  if (v) { c.fx.fief[v.id] = "player"; c.note(`Hołd lenny złożony. ${lordDef(r).title} ${lordDef(r).name} nadaje ci wieś ${v.name}.`, "good"); }
  else c.note(`Hołd lenny złożony. Na nadanie ziemi trzeba poczekać.`, "good");
}
export function leaveService(c: Campaign) {
  const j = c.fx.join; if (!j) return;
  if (j.role === "vassal") {
    for (const s of Object.keys(c.fx.fief)) if (c.fx.fief[s] === "player") c.fx.fief[s] = FACTIONS[j.f].ruler;
    changeRel(c, j.f, -25, "zerwałeś hołd");
  } else changeRel(c, j.f, j.until > c.day ? -10 : 0);
  c.note(`Opuszczasz służbę: ${FACTIONS[j.f].name}.`, "warn");
  c.fx.join = undefined;
}
export const vassalNeeds = { renown: 100, rel: 0 };

// ---------- daily: wars, pay, rents, recovery ----------
export function factionsDaily(c: Campaign) {
  const fx = c.fx;
  // the player starving a town or castle out
  if (c.co.siegeOf) {
    const s = c.w.settlements.find((q) => q.id === c.co.siegeOf)!, me = c.co.party;
    if (Math.hypot(s.x - me.x, s.z - me.z) > 10 || !c.co.camp || !fx.join || !hostileTo(c, fx.owner[s.id])) { c.note(`Oblężenie ${s.name} przerwane.`, "warn"); c.co.siegeOf = undefined; }
    else {
      c.co.siegeDays = (c.co.siegeDays ?? 0) + 1;
      const g = fx.garrison[s.id], lost = Math.max(2, Math.round(g * 0.12));
      fx.garrison[s.id] = g - lost - 1; s.prosperity = Math.max(0.1, s.prosperity - 0.03);   // the daily +1 refill is cancelled
      if (fx.garrison[s.id] <= 3) {
        transfer(c, s, fx.join.f, fx.join.role === "vassal" ? "player" : FACTIONS[fx.join.f].ruler);
        c.co.hero.renown += 15; c.co.siegeOf = undefined;
        c.note(`${s.name} poddaje się z głodu po ${c.co.siegeDays} dniach${fx.join.role === "vassal" ? ". Władca oddaje ją tobie w lenno" : ""}.`, "good");
      } else c.note(`Oblężenie ${s.name}, dzień ${c.co.siegeDays}: załoga ${fx.garrison[s.id]} (−${lost} z głodu i dezercji).`, "");
    }
  }
  // wars are rare but long: at least 20 days either way
  for (let i = 0; i < FIDS.length; i++) for (let j = i + 1; j < FIDS.length; j++) {
    const a = FIDS[i], b = FIDS[j], k = pair(a, b), since = c.day - (fx.warDay[k] ?? -99);
    if (since < 20) continue;
    if (fx.wars.includes(k)) { if (c.rand() < 0.035) { fx.wars = fx.wars.filter((w) => w !== k); fx.warDay[k] = c.day; c.note(`Pokój: ${FACTIONS[a].short} i ${FACTIONS[b].short} podpisują rozejm.`, "warn"); } }
    else if (c.rand() < 0.012) { fx.wars.push(k); fx.warDay[k] = c.day; c.note(`Wojna! ${FACTIONS[a].name} i ${FACTIONS[b].name} chwytają za broń.`, "bad"); }
  }
  // the player's contract and rents
  const j = fx.join, me = c.co.party;
  if (j && c.day % 7 === 0) {
    if (j.role === "mercenary") { const pay = 4 * c.men; me.gold += pay; c.note(`Żołd od ${FACTIONS[j.f].short}: ${pay} gr.`, "good"); }
  }
  if (j?.role === "mercenary" && c.day >= j.until) {
    if (fx.rel[j.f] >= 0) { j.until = c.day + 30; c.note(`Kontrakt z ${FACTIONS[j.f].short} przedłużony o 30 dni.`, ""); }
    else leaveService(c);
  }
  if (c.day % 7 === 0) {
    let rent = 0;
    for (const s of c.w.settlements) if (fx.fief[s.id] === "player" && !s.burned) rent += Math.round((s.kind === "town" ? 120 : s.kind === "castle" ? 50 : 30) * (0.5 + s.prosperity));
    if (rent) { me.gold += rent; c.note(`Czynsze z twoich lenn: ${rent} gr.`, "good"); }
  }
  // looted villages rebuild, garrisons refill
  for (const s of c.w.settlements) {
    if (fx.looted[s.id] > 0 && --fx.looted[s.id] <= 0) { s.burned = false; delete fx.looted[s.id]; c.note(`${s.name} odbudowuje się po grabieży.`, ""); }
    const cap = s.kind === "town" ? 40 : s.kind === "castle" ? 30 : 0;
    if (fx.garrison[s.id] < cap) fx.garrison[s.id]++;
  }
  // beaten lords come back with a new army
  for (const l of LORDS) {
    const st = fx.lords[l.id];
    if (st.captive) continue;
    if (!c.parties.some((p) => p.id === st.party)) { st.down++; if (st.down >= 5) { spawnLord(c, l.id, 0.4); c.note(`${l.title} ${l.name} ${l.fem ? "zebrała" : "zebrał"} nowe wojsko.`, ""); } }
  }
  // the factions' leftover land when a faction holds nothing
}

// ---------- lord AI (called every map step for each lord party) ----------
export function lordThink(c: Campaign, p: Party, h: number, dPlayer: number) {
  const fx = c.fx, f = p.faction!, me = c.co.party, def = lordDef(p.lord!);
  const pow = c.partyPower(p), size = c.partySize(p);
  if (p.fight) {
    const q = c.parties.find((x) => x.id === p.fight!.with);
    if (!q || !q.fight) { p.fight = undefined; }
    else { if (c.now >= p.fight.until) { p.fight = undefined; q.fight = undefined; aiBattle(c, p, q); } return; }
  }
  // the player, if at war with him
  if (hostileTo(c, f) && dPlayer < c.sight(p) && pow > c.partyPower(me) * (def.persona === "ostrozny" ? 1.3 : 0.8)) {
    if (p.mode !== "chase" || p.think <= 0) { p.mode = "chase"; p.path = [[me.x, me.z]]; p.think = 0.5; }
    return;
  }
  // meeting other parties: enemy lords and bandits
  for (const q of c.parties) {
    if (q === p || q.kind === "player" || q.stunned > 0) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z); if (d > 1.6) continue;
    const enemyLord = q.kind === "lord" && atWar(fx, f, q.faction!);
    const scum = q.kind === "bandits" || q.kind === "deserters" || q.kind === "undead" || q.kind === "necro";
    if (enemyLord && !p.fight && !q.fight) {
      // armies clash for a few hours: the player can ride in and join either side
      p.fight = { with: q.id, until: c.now + 3 }; q.fight = { with: p.id, until: c.now + 3 };
      p.path = []; q.path = []; p.mode = q.mode = "wait";
      if (Math.hypot(p.x - c.co.party.x, p.z - c.co.party.z) < 45) c.note(`Bitwa! ${p.name} i ${q.name} starli się w polu. Możesz dołączyć.`, "warn");
      return;
    }
    if (scum && !p.fight) { aiBattle(c, p, q); return; }
  }
  if (p.path.length) return;
  if (p.raid || p.siege || p.mode === "travel" || p.mode === "roam") { lordArrived(c, p); return; }
  if (p.mode === "wait" && p.think > 0) return;
  // siege finished?
  if (p.mode === "wait" && p.dest) { finishSiege(c, p); p.dest = undefined; }
  const seat = c.w.settlements.find((s) => s.id === seatOf(c, p.lord!));
  // weak: go home and recruit
  if (size < def.size * 0.55 && seat) {
    if (Math.hypot(seat.x - p.x, seat.z - p.z) < 6) { for (const st of armyFor(f, Math.ceil(def.size * 0.15))) c.addTroops(p, st.t, st.n); p.mode = "wait"; p.think = 6; return; }
    go(c, p, seat.x + 2, seat.z + 2); return;
  }
  // at war: raid, besiege, or hunt
  const enemies = FIDS.filter((g) => atWar(fx, f, g));
  if (enemies.length && c.rand() < (def.persona === "ostrozny" ? 0.25 : def.persona === "okrutny" ? 0.6 : 0.45)) {
    const targets = c.w.settlements.filter((s) => enemies.includes(fx.owner[s.id]) && !s.burned)
      .map((s) => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 3);
    const t = targets[Math.floor(c.rand() * targets.length)]?.s;
    if (t) {
      if (t.kind === "village") { go(c, p, t.x + 1, t.z + 1); p.mode = "travel"; p.raid = t.id; return; }
      if (pow > wallPower(fx.garrison[t.id], t.kind)) { p.raid = undefined; p.siege = t.id; go(c, p, t.x + 3, t.z + 3); p.mode = "travel"; return; }
    }
  }
  // otherwise: patrol between own settlements
  const own = c.w.settlements.filter((s) => fx.owner[s.id] === f);
  const s = own[Math.floor(c.rand() * own.length)];
  if (s) { go(c, p, s.x + 2, s.z + 2); p.mode = "roam"; }
}
function go(c: Campaign, p: Party, x: number, z: number) { p.path = c.route(p, x, z) ?? []; p.think = 4; }

/** Called when a lord party reaches the end of its path. */
export function lordArrived(c: Campaign, p: Party) {
  const fx = c.fx;
  if (p.raid) {
    const s = c.w.settlements.find((q) => q.id === p.raid)!;
    p.raid = undefined;
    if (atWar(fx, p.faction!, fx.owner[s.id]) && !s.burned) {
      s.burned = true; fx.looted[s.id] = 12; s.prosperity = Math.max(0.1, s.prosperity - 0.15); s.recruits = 0;
      p.gold += 60;
      const near = Math.hypot(s.x - c.co.party.x, s.z - c.co.party.z) < 40;
      c.note(`${p.name} pali wieś ${s.name}${near ? "" : " (wieści z daleka)"}.`, "bad");
      if (fx.fief[s.id] === "player") c.note(`To była twoja wieś.`, "bad");
    }
    p.mode = "wait"; p.think = 3;
  } else if (p.siege) {
    p.dest = p.siege; p.siege = undefined; p.mode = "wait"; p.think = 48;
    const s = c.w.settlements.find((q) => q.id === p.dest)!;
    if (fx.fief[s.id] === "player" || fx.owner[s.id] === fx.join?.f) { p.think = 72; c.note(`${p.name} oblega ${s.name}${fx.fief[s.id] === "player" ? " — twoje lenno" : ""}! Mury padną za 3 dni. Wejdź do osady, by bronić murów.`, "bad"); return; }
    c.note(`${p.name} oblega ${c.w.settlements.find((q) => q.id === p.dest)!.name}.`, "warn"); }
  else { p.mode = "wait"; p.think = 2 + c.rand() * 6; }
}
function finishSiege(c: Campaign, p: Party) {
  const fx = c.fx, s = c.w.settlements.find((q) => q.id === p.dest)!;
  const from = fx.owner[s.id];
  if (!atWar(fx, p.faction!, from)) return;
  const def = wallPower(fx.garrison[s.id], s.kind), att = c.partyPower(p);
  if (att > def) {
    const loss = Math.min(0.5, def / att * 0.5);
    c.applyLosses(p, loss, false);
    transfer(c, s, p.faction!, p.lord!);
    c.note(`${s.name} pada! ${p.name} zdobywa ją dla: ${FACTIONS[p.faction!].short}.`, "bad");
  } else { c.applyLosses(p, 0.3, false); fx.garrison[s.id] = Math.max(5, fx.garrison[s.id] - 10); c.note(`${p.name} odstępuje od murów ${s.name} z ciężkimi stratami.`, "warn"); }
}
/** What it takes to storm a garrison behind walls (AI sieges; the player fights it out). */
export const wallPower = (n: number, kind: string) => n * 0.8 * (kind === "town" ? 3 : 2.5);
/** A settlement changes hands; villages around a fallen castle stay with their own lords. */
export function transfer(c: Campaign, s: Settlement, f: FactionId, lord: string) {
  const fx = c.fx;
  fx.owner[s.id] = f; fx.fief[s.id] = lord; fx.garrison[s.id] = Math.round((s.kind === "town" ? 40 : 30) * 0.4);
}

/** Two AI parties meet: quick Lanchester on the spot. */
export function aiBattle(c: Campaign, a: Party, b: Party) {
  a.fight = undefined; b.fight = undefined;
  let pa = c.partyPower(a), pb = c.partyPower(b);
  const a0 = pa, b0 = pb;
  while (pa > a0 * 0.3 && pb > b0 * 0.3) { pa -= pb * 0.1; pb -= pa * 0.1; }
  const aWin = pa > pb;
  const [w, l] = aWin ? [a, b] : [b, a];
  c.applyLosses(w, 1 - Math.max(0, aWin ? pa / a0 : pb / b0), false);
  const near = Math.hypot(a.x - c.co.party.x, a.z - c.co.party.z) < 30;
  if (l.kind === "lord") {
    c.removeParty(l);
    const st = c.fx.lords[l.lord!]; st.down = 0;
    if (w.kind === "lord" && c.rand() < 0.3) { st.down = -10; c.note(`${l.name} pokonany i wzięty do niewoli przez: ${w.name} (wróci po okupie).`, near ? "bad" : "warn"); }
    else c.note(`${l.name} rozbity przez: ${w.name}.`, near ? "bad" : "warn");
  } else { c.removeParty(l); if (near) c.note(`${w.name} rozbija: ${l.name}.`, ""); }
  w.stunned = 2;
}
