// Campaign rules: the calendar, the player's company (troops, food, water,
// money, morale), parties roaming the region, settlements, battlefields left
// behind, and the daily tick that makes hunger, winter and unpaid wages bite.
import { clamp, rng } from "../core/math.ts";
import { World, buildWorld, astar, cellOf, centerOf, pathCost, terrainSpeed, nearRiver, biomeAt, Settlement, MAP } from "./world.ts";
import { TROOPS, TroopId, power } from "./troops.ts";

export const HOUR_SECONDS = 2.5;        // one game hour = 2.5 s at 1× (a day = 1 min, user decision)
export const DAYS_PER_SEASON = 30;
export const SEASONS = { pl: ["wiosna", "lato", "jesień", "zima"], en: ["spring", "summer", "autumn", "winter"] };

export interface Stack { t: TroopId; n: number; wounded: number; xp: number }
export type PartyKind = "player" | "bandits" | "deserters" | "caravan" | "peasants" | "undead";
export interface Party {
  id: number; kind: PartyKind; name: string; x: number; z: number;
  troops: Stack[]; gold: number;
  path: [number, number][]; goal?: { x: number; z: number; settlement?: string; party?: number };
  home?: { x: number; z: number }; dest?: string;
  mode: "roam" | "chase" | "flee" | "travel" | "idle" | "wait"; think: number; stunned: number;
}
export type FoodType = "grain" | "meat" | "fish" | "beer";
export const FOOD: Record<FoodType, { pl: string; en: string; price: number; spoil: number }> = {
  grain: { pl: "Chleb i kasza", en: "Bread and groats", price: 2, spoil: 999 },
  meat: { pl: "Mięso", en: "Meat", price: 4, spoil: 6 },
  fish: { pl: "Ryby", en: "Fish", price: 3, spoil: 4 },
  beer: { pl: "Piwo", en: "Ale", price: 3, spoil: 999 },
};
export interface FoodBatch { type: FoodType; n: number; age: number }
export interface Field { x: number; z: number; bodies: number; nights: number; id: number }
export interface Note { day: number; hour: number; text: string; kind: "" | "good" | "bad" | "warn" }

export interface Company {
  party: Party;
  food: FoodBatch[];
  water: number;            // days of water in skins
  waterCap: number;
  morale: number;           // 0..100
  lootShare: number;        // 0..0.5 of loot goes to the men
  hungerDays: number; thirstDays: number; unpaidWeeks: number;
  camp: boolean; resting: boolean;
  wagesDue: number;          // accumulated this week
  furs: number;              // furs and blankets against frost
  inside?: boolean;          // in a settlement: bands do not attack
  groups?: Partial<Record<TroopId, number>>;   // battle group (1–9) per troop type
}

export class Campaign {
  w: World;
  day = 20; hour = 8;            // Rok Popiołu 37, spring
  year = 37;
  parties: Party[] = [];
  fields: Field[] = [];
  notes: Note[] = [];
  co: Company;
  speed = 1;                      // 0 pause, 1, 3
  private nextId = 1;
  private r = rng(4242);
  onEncounter: ((p: Party) => void) | null = null;
  onDay: (() => void) | null = null;

  constructor(seed = 37) {
    this.w = buildWorld(seed);
    const start = this.w.settlements.find((s) => s.id === "krucz")!;
    const party: Party = { id: this.nextId++, kind: "player", name: "Twoja kompania", x: start.x + 3, z: start.z + 2, gold: 260, path: [], mode: "idle", think: 0, stunned: 0,
      troops: [{ t: "chlop", n: 8, wounded: 0, xp: 0 }, { t: "pacholek", n: 4, wounded: 0, xp: 0 }] };
    this.co = { party, food: [{ type: "grain", n: 40, age: 0 }, { type: "beer", n: 10, age: 0 }], water: 3, waterCap: 3, morale: 60, lootShare: 0.2,
      hungerDays: 0, thirstDays: 0, unpaidWeeks: 0, camp: false, resting: false, wagesDue: 0, furs: 0 };
    this.parties.push(party);
    for (let i = 0; i < 4; i++) this.spawnBandits();
    this.spawn("deserters"); this.spawn("caravan"); this.spawn("caravan"); this.spawn("peasants"); this.spawn("peasants");
    this.note("Rok Popiołu 37. Twoja kompania stoi pod Kruczym Brodem. Zapasy na kilka dni, srebra niewiele.", "");
  }

  // ---------- calendar ----------
  get season() { return Math.floor((this.day % (DAYS_PER_SEASON * 4)) / DAYS_PER_SEASON); }
  get winter() { return this.season === 3; }
  get night() { return this.hour < 5.5 || this.hour >= 20.5; }
  get moon() { return this.day % 28; }                 // 14 = full moon
  get fullMoon() { return Math.abs(this.moon - 14) <= 1; }
  get eclipse() { return this.day % 120 === 75; }       // once a year, late autumn
  dateText(lang: "pl" | "en") {
    const d = (this.day % DAYS_PER_SEASON) + 1;
    const hh = Math.floor(this.hour), mm = Math.floor((this.hour - hh) * 60);
    return `${d} ${lang === "pl" ? "dzień" : "day"}, ${SEASONS[lang][this.season]}, ${lang === "pl" ? "Rok Popiołu" : "Year of Ash"} ${this.year} · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  note(text: string, kind: Note["kind"] = "") { this.notes.unshift({ day: this.day, hour: this.hour, text, kind }); this.notes.length = Math.min(this.notes.length, 40); }

  // ---------- company figures ----------
  get men() { return this.co.party.troops.reduce((a, s) => a + (TROOPS[s.t].undead ? 0 : s.n), 0) + 1; }
  get able() { return this.co.party.troops.reduce((a, s) => a + s.n - s.wounded, 0); }
  get foodTotal() { return this.co.food.reduce((a, f) => a + f.n, 0); }
  get ration() { return this.winter ? 1.5 : 1; }
  get foodDays() { return this.foodTotal / Math.max(1, this.men * this.ration); }
  get weeklyWage() { return this.co.party.troops.reduce((a, s) => a + s.n * TROOPS[s.t].wage, 0); }
  partyPower(p: Party, healthyOnly = true) {
    return p.troops.reduce((a, s) => a + (s.n - (healthyOnly ? s.wounded : 0)) * power(s.t), 0) + (p.kind === "player" ? 2.5 : 0);
  }
  partySize(p: Party) { return p.troops.reduce((a, s) => a + s.n, 0) + (p.kind === "player" ? 1 : 0); }
  addTroops(p: Party, t: TroopId, n: number) {
    const s = p.troops.find((x) => x.t === t);
    if (s) s.n += n; else p.troops.push({ t, n, wounded: 0, xp: 0 });
  }

  /** Map speed (units per game hour) of a party. */
  speedOf(p: Party) {
    let v = 3.2 * terrainSpeed(this.w, p.x, p.z);
    if (this.night) v *= 0.8;
    if (this.winter) v *= 0.7;
    const size = this.partySize(p);
    v *= 1 - Math.min(0.3, size / 300);
    if (p.kind === "player") {
      const wounded = p.troops.reduce((a, s) => a + s.wounded, 0);
      v *= 1 - Math.min(0.25, wounded / Math.max(1, size) * 0.5);
      if (this.co.hungerDays > 0) v *= 0.85;
    }
    if (p.kind === "caravan") v *= 0.85;
    if (p.kind === "undead") v *= 0.7;
    return v;
  }
  /** How far a party sees (map units): shorter at night and in forest. */
  sight(p: Party) {
    let s = this.night ? 7 : 13;
    if (biomeAt(this.w, p.x, p.z) === "forest") s *= 0.7;
    if (p.kind === "undead") s = 9;
    return s;
  }

  // ---------- orders ----------
  orderMove(x: number, z: number, settlement?: string, party?: number) {
    const p = this.co.party;
    const path = this.route(p, x, z);
    if (!path) { this.note("Tam nie da się dojść.", "warn"); return false; }
    p.path = path; p.goal = { x, z, settlement, party }; p.mode = "travel";
    this.co.camp = false; this.co.resting = false;
    return true;
  }
  route(p: Party, x: number, z: number) {
    const cost = pathCost(this.w, this.winter);
    const from = cellOf(p.x, p.z), to = cellOf(x, z);
    const cells = astar(from, to, cost);
    if (!cells) return null;
    const pts = cells.map(([i, j]) => centerOf(i, j));
    pts.push([x, z]);
    return pts;
  }

  // ---------- time ----------
  /** Does the clock run? Only while the company moves, camps or rests (or AI events demand it). */
  get clockRuns() { return this.speed > 0 && (this.co.party.path.length > 0 || this.co.camp || this.co.resting); }

  step(dtReal: number) {
    if (!this.clockRuns) return;
    let hours = (dtReal / HOUR_SECONDS) * this.speed;
    while (hours > 0) { const h = Math.min(hours, 0.25); this.advance(h); hours -= h; }
  }

  /** Let time pass at once (rest, burial), with all the daily rules. */
  passHours(h: number) { while (h > 0) { const d = Math.min(h, 0.25); this.advance(d); h -= d; } }

  private advance(h: number) {
    const prevDay = this.day;
    this.hour += h;
    if (this.hour >= 24) { this.hour -= 24; this.day++; }
    for (const p of this.parties) this.moveParty(p, h);
    this.thinkAI(h);
    if (this.day !== prevDay) { this.daily(); this.onDay?.(); }
    // camp heals faster; resting in town is handled by the menu
    const co = this.co;
    if (co.camp || co.resting) for (const s of co.party.troops) if (s.wounded > 0 && this.r() < h * (co.resting ? 0.06 : 0.04)) s.wounded--;
    if (co.party.path.length === 0 && co.party.goal) this.arrived();
  }

  private moveParty(p: Party, h: number) {
    if (p.stunned > 0) { p.stunned -= h; return; }
    let budget = this.speedOf(p) * h;
    while (budget > 0 && p.path.length) {
      const [tx, tz] = p.path[0];
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d <= budget) { p.x = tx; p.z = tz; p.path.shift(); budget -= d; }
      else { p.x += (dx / d) * budget; p.z += (dz / d) * budget; budget = 0; }
    }
    // the player walks toward a moving target
    if (p.kind === "player" && p.goal?.party) {
      const t = this.parties.find((q) => q.id === p.goal!.party);
      if (t && Math.hypot(t.x - p.x, t.z - p.z) > 2 && (p.path.length === 0 || Math.hypot(t.x - p.goal.x, t.z - p.goal.z) > 4)) {
        const path = this.route(p, t.x, t.z); if (path) { p.path = path; p.goal = { x: t.x, z: t.z, party: t.id }; }
      }
    }
  }

  private arrived() {
    const g = this.co.party.goal!;
    this.co.party.goal = undefined; this.co.party.mode = "idle";
    if (g.settlement) this.enterSettlement?.(g.settlement);
  }
  enterSettlement: ((id: string) => void) | null = null;

  // ---------- AI parties ----------
  private spawnBandits() {
    const hide = this.w.pois.filter((p) => p.kind === "hideout" && p.alive);
    if (!hide.length) return;
    const H = hide[Math.floor(this.r() * hide.length)];
    const n = 4 + Math.floor(this.r() * 9);
    const p = this.newParty("bandits", "Rozbójnicy", H.x + (this.r() - 0.5) * 6, H.z + (this.r() - 0.5) * 6, [{ t: "rozbojnik", n, wounded: 0, xp: 0 }]);
    if (n > 8) this.addTroops(p, "herszt", 1);
    p.home = { x: H.x, z: H.z }; p.gold = 20 + n * 6;
  }
  spawn(kind: PartyKind, at?: { x: number; z: number }, n?: number) {
    const towns = this.w.settlements.filter((s) => s.kind === "town" && !s.burned);
    const vill = this.w.settlements.filter((s) => s.kind === "village" && !s.burned);
    if (kind === "deserters") {
      const s = vill[Math.floor(this.r() * vill.length)];
      const p = this.newParty("deserters", "Dezerterzy", s.x + 12, s.z - 9, [{ t: "dezerter", n: 5 + Math.floor(this.r() * 6), wounded: 0, xp: 0 }]);
      p.home = { x: s.x, z: s.z }; p.gold = 60;
    } else if (kind === "caravan") {
      const a = towns[Math.floor(this.r() * towns.length)];
      const p = this.newParty("caravan", "Karawana kupiecka", a.x + 4, a.z + 4, [{ t: "kupiec", n: 4 + Math.floor(this.r() * 4), wounded: 0, xp: 0 }]);
      p.gold = 300 + Math.floor(this.r() * 300); p.dest = a.id; p.mode = "travel";
    } else if (kind === "peasants") {
      const a = vill[Math.floor(this.r() * vill.length)];
      const p = this.newParty("peasants", "Chłopi na targ", a.x + 2, a.z + 2, [{ t: "chlop", n: 3 + Math.floor(this.r() * 5), wounded: 0, xp: 0 }]);
      p.gold = 15; p.dest = a.id; p.mode = "travel";
    } else if (kind === "undead" && at) {
      const p = this.newParty("undead", "Żywe trupy", at.x, at.z, [{ t: "zywy_trup", n: n ?? 6, wounded: 0, xp: 0 }]);
      p.home = { x: at.x, z: at.z }; p.gold = 0;
    }
  }
  private newParty(kind: PartyKind, name: string, x: number, z: number, troops: Stack[]): Party {
    const [i, j] = cellOf(x, z); const [cx, cz] = centerOf(i, j);
    const p: Party = { id: this.nextId++, kind, name, x: cx, z: cz, troops, gold: 0, path: [], mode: "roam", think: this.r() * 2, stunned: 0 };
    this.parties.push(p); return p;
  }
  hostile(p: Party) { return p.kind === "bandits" || p.kind === "deserters" || p.kind === "undead"; }

  private thinkAI(h: number) {
    const me = this.co.party;
    const myPow = this.partyPower(me);
    for (const p of this.parties) {
      if (p.kind === "player") continue;
      p.think -= h;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      // contact with the player
      if (d < 1.6 && p.stunned <= 0 && !this.co.inside && (this.hostile(p) && p.mode === "chase" || me.goal?.party === p.id)) {
        me.path = []; me.goal = undefined; this.co.camp = false; this.co.resting = false;
        this.speed = 0;
        this.onEncounter?.(p);
        return;
      }
      if (this.hostile(p)) {
        const pow = this.partyPower(p);
        const sees = d < this.sight(p) || (p.kind === "undead" && d < 9);
        // undead are stronger at night; nobody else is
        const nightK = p.kind === "undead" && this.night ? 1.4 : 1;
        if (sees && pow * nightK > myPow * 0.75) {
          if (p.mode !== "chase" || p.think <= 0) { p.mode = "chase"; p.path = [[me.x, me.z]]; p.think = 0.5; }
        } else if (sees && pow < myPow * 0.5 && p.kind !== "undead") {
          if (p.mode !== "flee" || p.think <= 0) {
            const ax = p.x + (p.x - me.x) / (d || 1) * 12, az = p.z + (p.z - me.z) / (d || 1) * 12;
            p.path = this.route(p, ax, az) ?? []; p.mode = "flee"; p.think = 1.5;
          }
        } else if (p.think <= 0 || p.path.length === 0) {
          // roam around home
          const hm = p.home ?? { x: p.x, z: p.z };
          const a = this.r() * Math.PI * 2, rr = 6 + this.r() * 18;
          p.path = this.route(p, hm.x + Math.cos(a) * rr, hm.z + Math.sin(a) * rr) ?? []; p.mode = "roam"; p.think = 6 + this.r() * 8;
        }
      } else if (p.path.length === 0) {
        // caravans go town to town, peasants village to town and back
        const pool = this.w.settlements.filter((s) => !s.burned && s.id !== p.dest && (p.kind === "caravan" ? s.kind === "town" : true));
        const s = pool[Math.floor(this.r() * pool.length)];
        p.dest = s.id; p.path = this.route(p, s.x + 2, s.z + 2) ?? []; p.mode = "travel";
      }
      // flee from a hostile band on the way
    }
  }

  // ---------- daily rules ----------
  private daily() {
    const co = this.co, p = co.party;
    // food: eat the spoiling things first, keep beer for morale
    let need = Math.ceil(this.men * this.ration);
    co.food.sort((a, b) => (FOOD[a.type].spoil - a.age) - (FOOD[b.type].spoil - b.age));
    const kinds = new Set<FoodType>();
    for (const f of co.food) { if (need <= 0) break; const eat = Math.min(f.n, need); f.n -= eat; need -= eat; if (eat > 0) kinds.add(f.type); }
    for (const f of co.food) f.age++;
    const spoiled = co.food.filter((f) => f.age > FOOD[f.type].spoil && f.n > 0);
    for (const f of spoiled) { this.note(`${FOOD[f.type].pl}: zepsuło się ${f.n} porcji.`, "warn"); f.n = 0; }
    co.food = co.food.filter((f) => f.n > 0);
    if (need > 0) {
      co.hungerDays++;
      if (co.hungerDays <= 2) { co.morale -= 8; this.note("Brak jedzenia. Ludzie głodują.", "bad"); }
      else if (co.hungerDays < 5) { co.morale -= 10; this.desert(1 + Math.floor(this.men / 15), "z głodu"); }
      else { co.morale -= 12; this.kill(1 + Math.floor(this.men / 12), "Ludzie umierają z głodu"); }
    } else {
      co.hungerDays = 0;
      if (kinds.size >= 3) co.morale += 2; else if (kinds.size === 1) co.morale -= 0.5;
      if (kinds.has("beer")) co.morale += 1;
    }
    // water: skins refill at rivers and in settlements
    const atWater = nearRiver(this.w, p.x, p.z, 5) || this.w.settlements.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 8);
    if (atWater) co.water = co.waterCap; else co.water = Math.max(0, co.water - 1);
    if (co.water <= 0 && !atWater) {
      co.thirstDays++; co.morale -= 10; this.note("Bukłaki puste. Pragnienie.", "bad");
      if (co.thirstDays >= 2) this.kill(1 + Math.floor(this.men / 10), "Ludzie padają z pragnienia");
    } else co.thirstDays = 0;
    // winter: frost kills those without shelter, fire or furs
    if (this.winter && !co.resting) {
      const cover = co.furs / Math.max(1, this.men);
      const risk = (co.camp ? 0.03 : 0.08) * (1 - clamp(cover, 0, 1));
      const dead = Math.floor(this.men * risk + this.r());
      if (dead > 0) this.kill(dead, "Mróz zabiera ludzi");
    }
    // wages, once a week
    co.wagesDue += this.weeklyWage / 7;
    if (this.day % 7 === 0) {
      const due = Math.ceil(co.wagesDue); co.wagesDue = 0;
      if (p.gold >= due) { p.gold -= due; co.unpaidWeeks = 0; this.note(`Wypłacono żołd: ${due} groszy.`, ""); }
      else {
        p.gold = 0; co.unpaidWeeks++;
        if (co.unpaidWeeks === 1) { co.morale -= 15; this.note("Nie starczyło na żołd. Ludzie szemrzą.", "bad"); }
        else if (co.unpaidWeeks === 2) { co.morale -= 15; this.desert(Math.ceil(this.men * 0.2), "bez żołdu"); }
        else { this.mutiny(); }
      }
    }
    // morale drifts back toward a grim normal; camp and rest help
    co.morale += (50 - co.morale) * 0.06;
    if (co.camp) co.morale += 2;
    if (biomeAt(this.w, p.x, p.z) === "cursed") co.morale -= 4;
    if (this.winter) co.morale -= 1;
    co.morale = clamp(co.morale, 0, 100);
    if (co.morale < 20 && this.r() < 0.5) this.desert(1 + Math.floor(this.men / 20), "z braku ducha");
    // recruits come back slowly, in proportion to people left
    for (const s of this.w.settlements) if (s.kind === "village" && !s.burned) s.recruits = Math.min(3 + Math.floor(s.pop / 40), s.recruits + (this.r() < s.pop / 300 ? 1 : 0));
    // battlefields: the unburied rise after 2–3 nights
    for (const f of [...this.fields]) {
      f.nights++;
      if (f.nights >= 2 + Math.floor(this.r() * 2) && f.bodies >= 3) {
        this.spawn("undead", { x: f.x, z: f.z }, Math.max(3, Math.floor(f.bodies * 0.5)));
        this.note("Nad pobojowiskiem krążą kruki. Ciała, których nikt nie pochował, wstały.", "bad");
        this.fields.splice(this.fields.indexOf(f), 1);
      }
    }
    // the land refills its bands
    const bandits = this.parties.filter((q) => q.kind === "bandits").length;
    if (bandits < 4 && this.r() < 0.4) this.spawnBandits();
    if (this.parties.filter((q) => q.kind === "caravan").length < 2 && this.r() < 0.3) this.spawn("caravan");
    if (this.parties.filter((q) => q.kind === "peasants").length < 2 && this.r() < 0.4) this.spawn("peasants");
    if (this.parties.filter((q) => q.kind === "deserters").length < 1 && this.r() < 0.2) this.spawn("deserters");
    if (this.moon === 14) this.note("Pełnia. W borach coś wyje.", "warn");
    if (this.eclipse) {
      this.note("Zaćmienie. Na cmentarzach ruszyła ziemia.", "bad");
      for (const g of this.w.pois.filter((q) => q.kind === "graveyard" || q.kind === "cursed")) this.spawn("undead", { x: g.x, z: g.z }, 8);
    }
    if (this.day % (DAYS_PER_SEASON * 4) === 0) this.year++;
    if (this.day % DAYS_PER_SEASON === 0) this.note(`Nastaje ${SEASONS.pl[this.season]}.`, "warn");
  }

  private pickVictims(n: number, cb: (s: Stack, k: number) => void) {
    const st = this.co.party.troops.filter((s) => s.n > 0 && !TROOPS[s.t].undead);
    for (let i = 0; i < n && st.length; i++) {
      const s = st[Math.floor(this.r() * st.length)];
      cb(s, 1); if (s.n <= 0) st.splice(st.indexOf(s), 1);
    }
    this.co.party.troops = this.co.party.troops.filter((s) => s.n > 0);
  }
  desert(n: number, why: string) {
    let k = 0; this.pickVictims(n, (s) => { s.n--; s.wounded = Math.min(s.wounded, s.n); k++; });
    if (k) this.note(`Dezercja ${why}: odeszło ${k} ludzi.`, "bad");
  }
  kill(n: number, why: string) {
    let k = 0; this.pickVictims(n, (s) => { s.n--; s.wounded = Math.min(s.wounded, s.n); k++; });
    if (k) this.note(`${why}: ${k} martwych.`, "bad");
  }
  private mutiny() {
    const n = Math.ceil(this.men * 0.5);
    this.desert(n, "w buncie");
    this.co.party.gold = 0; this.co.unpaidWeeks = 0; this.co.morale = 30;
    this.note("Bunt. Połowa kompanii odeszła, zabierając kasę.", "bad");
  }

  // ---------- encounters ----------
  /** Lanchester-style auto-resolve. Returns the losses on both sides. */
  autoResolve(enemy: Party) {
    const me = this.co.party;
    let a = this.partyPower(me), b = this.partyPower(enemy);
    const a0 = a, b0 = b;
    while (a > a0 * 0.25 && b > b0 * 0.15) { const da = b * 0.08 * (0.8 + this.r() * 0.4), db = a * 0.08 * (0.8 + this.r() * 0.4); a -= da; b -= db; }
    const win = b <= b0 * 0.15;
    const myLossFrac = 1 - Math.max(0, a) / a0, enLossFrac = 1 - Math.max(0, b) / b0;
    const res = this.applyLosses(me, myLossFrac, true);
    const er = this.applyLosses(enemy, win ? 1 : enLossFrac, false);
    return { win, mine: res, theirs: er };
  }
  /** Remove a fraction of a party's strength: blades kill, the rest are wounded. */
  applyLosses(p: Party, frac: number, mine: boolean) {
    let killed = 0, wounded = 0;
    for (const s of p.troops) {
      const lost = Math.round((s.n - s.wounded) * frac);
      const dead = mine ? Math.round(lost * 0.55) : lost, wnd = lost - dead;
      s.n -= dead; s.wounded = Math.min(s.n, s.wounded + wnd); killed += dead; wounded += wnd;
    }
    p.troops = p.troops.filter((s) => s.n > 0);
    return { killed, wounded };
  }
  removeParty(p: Party) { const i = this.parties.indexOf(p); if (i >= 0) this.parties.splice(i, 1); }
  leaveField(x: number, z: number, bodies: number) { if (bodies > 0) this.fields.push({ x, z, bodies, nights: 0, id: this.nextId++ }); }

  settlementAt(x: number, z: number, r = 5): Settlement | undefined {
    return this.w.settlements.find((s) => Math.hypot(s.x - x, s.z - z) < r);
  }
  // ---------- save / load (autosave once a day, browser storage) ----------
  save(): string {
    return JSON.stringify({ v: 1, day: this.day, hour: this.hour, year: this.year, parties: this.parties, fields: this.fields, notes: this.notes.slice(0, 20), co: { ...this.co, party: undefined }, nextId: this.nextId,
      sett: this.w.settlements.map((s) => ({ id: s.id, pop: s.pop, prosperity: s.prosperity, recruits: s.recruits, burned: s.burned })) });
  }
  load(json: string): boolean {
    try {
      const d = JSON.parse(json); if (d.v !== 1) return false;
      this.day = d.day; this.hour = d.hour; this.year = d.year; this.parties = d.parties; this.fields = d.fields; this.notes = d.notes; this.nextId = d.nextId;
      const me = this.parties.find((p) => p.kind === "player")!;
      this.co = { ...d.co, party: me };
      for (const q of d.sett) { const s = this.w.settlements.find((x) => x.id === q.id); if (s) Object.assign(s, q); }
      return true;
    } catch { return false; }
  }
  clampToMap(v: number) { return clamp(v, -MAP / 2 + 10, MAP / 2 - 10); }
  rand() { return this.r(); }
}
