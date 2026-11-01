// Campaign HUD and menus (DOM): top bar, chronicle, settlement, encounter,
// aftermath and company panels. Pure presentation over Campaign; battle
// start/end goes through the hooks the game passes in.
import { Campaign, Party, FOOD, FoodType, Stack } from "./campaign.ts";
import { TROOPS, TroopId, DEFAULT_GROUP } from "./troops.ts";
import { lang } from "../core/i18n.ts";
import { Settlement } from "./world.ts";
import { ATTRS, SKILLS, PROFS, Attr, Skill, Item, itemName, itemPrice, skillCap, xpForLevel, addXp, heroHp, partyLimit, prisonerLimit, ORIGINS, WEAPON_PRICE, ARMOUR_PRICE, ARMOUR_NAME } from "./hero.ts";
import type { TravelEvent } from "./events.ts";
import { power } from "./troops.ts";
import { WEAPONS, WeaponId } from "../char/weapons.ts";
import type { Loadout } from "../char/gear.ts";

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const tn = (t: TroopId) => TROOPS[t].name[lang];

export interface Act { label: string; sub?: string; on: () => void; off?: boolean; kind?: "go" | "bad" | "" }
export interface Hooks { fight: (p: Party) => void; refresh: () => void; snapshot: (x: number, z: number, dist: number) => string | null }

export class MapUI {
  open = false;
  /** Picture of the place at the top of the menu (Warband-style), rendered from the 3D map. */
  pic: string | null = null;
  private picFor = "";
  constructor(public c: Campaign, public h: Hooks) {
    $("mspeed").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button"); if (!b) return;
      this.c.speed = Number(b.dataset.s); this.hud();
    });
    $("mcamp").addEventListener("click", () => this.toggleCamp());
    $("mparty").addEventListener("click", () => this.partyPanel());
    $("menu").addEventListener("click", (e) => { if (e.target === $("menu")) this.close(); });
  }

  toggleCamp() {
    const co = this.c.co;
    co.camp = !co.camp; co.party.path = []; co.party.goal = undefined;
    if (co.camp && this.c.speed === 0) this.c.speed = 1;
    this.c.note(co.camp ? "Rozbijacie obóz. Ognisko trzyma potwory z daleka, ale widać je z daleka." : "Zwijacie obóz.", "");
    this.hud();
  }

  hud() {
    const c = this.c, co = c.co;
    $("mdate").textContent = c.dateText(lang);
    const fd = c.foodDays;
    const moraleWord = co.morale > 75 ? "wysokie" : co.morale > 50 ? "znośne" : co.morale > 25 ? "niskie" : "bliskie buntu";
    $("mstats").innerHTML =
      `<span title="Srebro"><b>${co.party.gold}</b> gr</span>` +
      `<span title="Ludzie zdolni do walki / wszyscy"><b>${c.able + 1}</b>/${c.men} ludzi</span>` +
      `<span class="${fd < 2 ? "warn" : ""}" title="Jedzenia na tyle dni"><b>${fd.toFixed(1)}</b> dni jedzenia</span>` +
      `<span class="${co.water < 1 ? "warn" : ""}" title="Woda w bukłakach"><b>${co.water}</b>/${co.waterCap} dni wody</span>` +
      `<span class="${co.morale < 30 ? "warn" : ""}" title="Morale ${Math.round(co.morale)}/100">morale <b>${moraleWord}</b></span>`;
    for (const b of $("mspeed").querySelectorAll("button")) b.classList.toggle("on", Number((b as HTMLElement).dataset.s) === c.speed);
    $("mcamp").classList.toggle("on", co.camp);
    $("mcamp").textContent = co.camp ? "Zwiń obóz" : "Obóz";
    const flags: string[] = [];
    if (c.night) flags.push("noc");
    if (c.winter) flags.push("zima");
    if (c.fullMoon) flags.push("pełnia");
    if (co.hungerDays) flags.push(`głód ${co.hungerDays} d`);
    if (!c.clockRuns) flags.push("czas stoi");
    $("mflags").textContent = flags.join(" · ");
    $("mnotes").innerHTML = c.notes.slice(0, 6).map((n) => `<div class="${n.kind}">${esc(n.text)}</div>`).join("");
  }

  // ---------- generic panel ----------
  /** Take (or reuse) a picture of a place for the menu. */
  picture(key: string, x: number, z: number, dist: number) {
    if (this.picFor !== key || !this.pic) { this.pic = this.h.snapshot(x, z, dist); this.picFor = key; }
  }
  show(title: string, body: string, acts: Act[], wide = false) {
    this.open = true;
    $("menu").hidden = false; $("menu").classList.toggle("wide", wide);
    const img = $("mpic") as HTMLImageElement;
    img.hidden = wide || !this.pic; if (this.pic && !wide) img.src = this.pic;
    $("mtitle").textContent = title;
    $("mbody").innerHTML = body;
    const box = $("macts"); box.textContent = "";
    for (const a of acts) {
      const b = document.createElement("button"); b.type = "button"; b.className = "act " + (a.kind ?? "");
      b.disabled = !!a.off;
      b.innerHTML = `<span>${esc(a.label)}</span>${a.sub ? `<small>${esc(a.sub)}</small>` : ""}`;
      b.addEventListener("click", () => { a.on(); this.hud(); });
      box.append(b);
    }
  }
  close() { this.open = false; this.picFor = ""; this.pic = null; $("menu").hidden = true; this.c.co.resting = false; this.c.co.inside = false; this.h.refresh(); }

  // ---------- settlements ----------
  settlement(id: string) {
    const c = this.c, s = c.w.settlements.find((q) => q.id === id)!;
    c.co.inside = true;
    c.speed = 0;
    this.picture("s:" + s.id, s.x, s.z, s.kind === "town" ? 15 : 11);
    if (s.burned) { this.show(s.name, `<p>Zgliszcza. Wiatr nosi popiół. Nikt tu nie został.</p>`, [{ label: "Odejdź", on: () => this.close() }]); return; }
    const kind = s.kind === "town" ? "Miasto" : s.kind === "castle" ? "Zamek" : "Wieś";
    const mood = s.prosperity > 0.6 ? "syta" : s.prosperity > 0.4 ? "biedna" : "głodująca";
    const body = `<p class="meta">${kind} · ${s.pop} dusz · ludność ${mood}</p>` + flavour(s);
    const acts: Act[] = [];
    const room = partyLimit(c.co.hero) - c.partySize(c.co.party);
    if (s.kind === "village") acts.push({ label: `Werbuj ochotników`, sub: room <= 0 ? "kompania pełna (limit z Dowodzenia i sławy)" : `${s.recruits} chętnych · 10 gr za głowę`, off: s.recruits <= 0 || c.co.party.gold < 10 || room <= 0, on: () => this.recruit(s) });
    if (s.kind !== "castle") acts.push({ label: s.kind === "town" ? "Targ" : "Kup żywność", sub: "jedzenie, piwo, futra, bukłaki", on: () => this.market(s) });
    if (s.kind === "town") {
      acts.push({ label: "Karczma: najemnicy", sub: "zbrojni i halabardnicy za srebro", on: () => this.tavern(s) });
      acts.push({ label: "Plotki", sub: "kto, gdzie, za ile", on: () => this.rumours(s) });
      acts.push({ label: "Zbrojownia: awanse", sub: "doświadczeni ludzie dostają lepszy sprzęt", on: () => this.upgrades(s) });
      acts.push({ label: "Kowal i płatnerz", sub: "broń i zbroje dla ciebie; sprzedaż łupów", on: () => this.smith(s) });
      if (c.prisonerCount) acts.push({ label: "Pośrednik okupów", sub: `${c.prisonerCount} jeńców do sprzedania`, on: () => this.ransom(s) });
    }
    if (s.kind === "castle") acts.push({ label: "Pod bramą", sub: "kasztelan każe czekać", off: true, on: () => {} });
    acts.push({ label: s.kind === "town" ? "Gospoda: odpocznij do rana" : "Przenocuj", sub: s.kind === "town" ? `${Math.ceil(c.men / 2)} gr, ranni szybciej wracają do sił` : "za darmo, w stodole", on: () => this.rest(s) });
    acts.push({ label: "Wyjdź", on: () => this.close() });
    this.show(s.name, body, acts);
  }
  private recruit(s: Settlement) {
    const c = this.c, n = Math.min(s.recruits, Math.floor(c.co.party.gold / 10), partyLimit(c.co.hero) - c.partySize(c.co.party));
    if (n <= 0) return;
    c.co.party.gold -= n * 10; s.recruits -= n; s.pop = Math.max(20, s.pop - n);
    c.addTroops(c.co.party, "chlop", n);
    c.note(`${n} chłopów z ${s.name} zaciąga się za miskę i parę groszy.`, "good");
    this.settlement(s.id);
  }
  private market(s: Settlement) {
    const c = this.c, co = c.co;
    const types: FoodType[] = ["grain", "meat", "beer"]; if (s.culture !== "german" || s.kind === "town") types.push("fish");
    const price = (t: FoodType) => Math.ceil(FOOD[t].price * (c.winter ? 1.5 : 1) * (1.3 - s.prosperity * 0.5));
    const stock = co.food.map((f) => `${FOOD[f.type].pl}: ${f.n}${FOOD[f.type].spoil < 99 ? ` (${Math.max(0, FOOD[f.type].spoil - f.age)} d do zepsucia)` : ""}`).join(", ") || "nic";
    const body = `<p>W taborze: ${esc(stock)}.</p><p class="meta">Kompania zjada ${Math.ceil(c.men * c.ration)} porcji dziennie${c.winter ? " (zima: półtorej racji)" : ""}.</p>`;
    const acts: Act[] = types.map((t) => ({ label: `${FOOD[t].pl} × 10`, sub: `${price(t) * 10} gr`, off: co.party.gold < price(t) * 10, on: () => { co.party.gold -= price(t) * 10; const b = co.food.find((f) => f.type === t && f.age === 0); if (b) b.n += 10; else co.food.push({ type: t, n: 10, age: 0 }); this.market(s); } }));
    acts.push({ label: "Futra i koce × 5", sub: `${30} gr · chronią przed mrozem`, off: co.party.gold < 30, on: () => { co.party.gold -= 30; co.furs += 5; this.market(s); } });
    acts.push({ label: "Bukłak na wodę", sub: `20 gr · +1 dzień wody`, off: co.party.gold < 20 || co.waterCap >= 6, on: () => { co.party.gold -= 20; co.waterCap++; co.water = co.waterCap; this.market(s); } });
    acts.push({ label: "Wróć", on: () => this.settlement(s.id) });
    this.show(`${s.name}: targ`, body, acts);
  }
  private tavern(s: Settlement) {
    const c = this.c, co = c.co;
    const offers: [TroopId, number, number][] = [["zbrojny", 60, 3], ["halabardnik", 45, 4]];
    const body = `<p>Dym, kwaśne piwo, ludzie z bliznami. Najemnicy biorą wyższy żołd i są wierni tylko srebru.</p>`;
    const full = c.partySize(co.party) >= partyLimit(co.hero);
    const acts: Act[] = offers.map(([t, cost]) => ({ label: `${tn(t)}`, sub: full ? "kompania pełna" : `${cost} gr zaliczki · ${TROOPS[t].wage} gr żołdu tygodniowo`, off: co.party.gold < cost || full, on: () => { co.party.gold -= cost; c.addTroops(co.party, t, 1); c.note(`${tn(t)} dołącza do kompanii.`, "good"); this.tavern(s); } }));
    acts.push({ label: "Wróć", on: () => this.settlement(s.id) });
    this.show(`${s.name}: karczma`, body, acts);
  }
  private rumours(s: Settlement) {
    const c = this.c, me = c.co.party;
    const hostile = c.parties.filter((p) => c.hostile(p)).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
    const lines: string[] = [];
    for (const p of hostile.slice(0, 3)) {
      const near = c.w.settlements.reduce((a, q) => (Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? q : a));
      const n = c.partySize(p) + (c.rand() < 0.3 ? Math.floor(c.rand() * 8) : 0);   // rumours lie a bit
      lines.push(`${p.name}, z ${n} ludźmi, widziani koło ${near.name}.`);
    }
    if (c.fields.length) lines.push("Mówią, że nad starym pobojowiskiem kruki nie odlatują. Niepochowani nie leżą długo.");
    if (c.winter) lines.push("Zboże drożeje. Kto ma zapasy, ten przeżyje do wiosny.");
    this.show(`${s.name}: plotki`, lines.map((l) => `<p>„${esc(l)}”</p>`).join("") || "<p>Nikt nic nie wie. Albo nie chce powiedzieć.</p>", [{ label: "Wróć", on: () => this.settlement(s.id) }]);
  }
  private upgrades(s: Settlement) {
    const c = this.c, co = c.co;
    const acts: Act[] = [];
    for (const st of co.party.troops) {
      const T = TROOPS[st.t]; if (!T.upTo) continue;
      const ready = Math.min(st.n - st.wounded, Math.floor(st.xp));
      acts.push({ label: `${tn(st.t)} → ${tn(T.upTo)}`, sub: `${ready} gotowych · ${T.upCost} gr za człowieka`, off: ready <= 0 || co.party.gold < T.upCost!, on: () => {
        const n = Math.min(ready, Math.floor(co.party.gold / T.upCost!)); if (n <= 0) return;
        co.party.gold -= n * T.upCost!; st.n -= n; st.xp -= n; c.addTroops(co.party, T.upTo!, n); co.party.troops = co.party.troops.filter((x) => x.n > 0);
        c.note(`${n} × ${tn(T.upTo!)}: nowy sprzęt, nowy żołd.`, "good"); this.upgrades(s);
      } });
    }
    acts.push({ label: "Wróć", on: () => this.settlement(s.id) });
    this.show(`${s.name}: zbrojownia`, `<p>Awans wymaga doświadczenia z bitew (jedna bitwa przeżyta przez człowieka) i srebra na lepszy sprzęt.</p>`, acts);
  }
  private rest(s: Settlement) {
    const c = this.c, co = c.co;
    if (s.kind === "town") { const cost = Math.ceil(c.men / 2); if (co.party.gold < cost) return; co.party.gold -= cost; }
    const until = c.hour < 7 ? 7 - c.hour : 31 - c.hour;
    co.resting = true; co.inside = true;
    c.passHours(until);
    co.resting = false;
    for (const st of co.party.troops) st.wounded = Math.max(0, st.wounded - Math.ceil(st.wounded * (s.kind === "town" ? 0.5 : 0.25)));
    co.morale = Math.min(100, co.morale + (s.kind === "town" ? 6 : 3));
    c.note(`Noc w ${s.name}. Ludzie odpoczęli.`, "good");
    this.settlement(s.id);
  }

  // ---------- encounters ----------
  encounter(p: Party) {
    const c = this.c, me = c.co.party;
    this.picture("p:" + p.id, (p.x + me.x) / 2, (p.z + me.z) / 2, 7);
    const mine = c.partyPower(me), theirs = c.partyPower(p);
    const ratio = theirs / Math.max(0.1, mine);
    const odds = ratio < 0.5 ? "przewaga po twojej stronie" : ratio < 0.9 ? "wyrównane, z lekką przewagą twoich" : ratio < 1.3 ? "wyrównane" : ratio < 2 ? "przewaga wroga" : "beznadziejne";
    const comp = p.troops.map((s) => `${s.n} × ${tn(s.t)}`).join(", ");
    const hostile = c.hostile(p);
    const intro = p.kind === "bandits" ? "Z zarośli wychodzą ludzie z siekierami. Nie pytają o drogę." :
      p.kind === "deserters" ? "Dezerterzy. Głodni, uzbrojeni i bez nic do stracenia." :
      p.kind === "undead" ? "Smród dochodzi pierwszy. Potem kroki, nierówne, bez oddechu." :
      p.kind === "caravan" ? "Wozy pod plandekami, strażnicy w kolczugach. Kupiec zerka nieufnie." : "Chłopi z wózkiem. Na twój widok cofają się do rowu.";
    const body = `<p>${intro}</p><p class="meta">${esc(p.name)}: ${esc(comp)}.</p><p class="meta">Siły: ${odds}.</p>`;
    const acts: Act[] = [];
    if (hostile) {
      acts.push({ label: "Do walki", sub: "bitwa na tym terenie, o tej porze", kind: "go", on: () => { this.close(); this.h.fight(p); } });
      acts.push({ label: "Rozstrzygnij bez walki", sub: "kapitanowie prowadzą ludzi, ty patrzysz", on: () => this.auto(p) });
      if (p.kind !== "undead") {
        const bribe = 5 * c.partySize(p);
        acts.push({ label: "Przekup", sub: `${bribe} gr za spokój`, off: me.gold < bribe, on: () => { me.gold -= bribe; p.stunned = 6; c.note(`Zapłaciłeś ${bribe} gr. ${p.name} odchodzą, licząc srebro.`, "warn"); this.close(); } });
      }
      const faster = c.speedOf(me) > c.speedOf(p) * 1.1;
      if (faster) acts.push({ label: "Wycofaj się", sub: "jesteście szybsi", on: () => { p.stunned = 1.5; c.note("Wycofujecie się, zanim zdążą zewrzeć szyk.", ""); this.close(); } });
      const rg = Math.max(1, Math.ceil((c.able) * 0.15));
      acts.push({ label: "Uciekaj, zostaw straż tylną", sub: `${rg} ludzi zostaje, by was osłonić`, kind: "bad", off: c.able < 2, on: () => { c.kill(rg, "Straż tylna"); p.stunned = 3; c.co.morale -= 8; this.close(); } });
    } else {
      acts.push({ label: "Przepuść ich", on: () => { p.stunned = 0.5; this.close(); } });
      if (p.kind === "peasants") acts.push({ label: "Kup od nich zboże", sub: "10 porcji za 15 gr", off: me.gold < 15, on: () => { me.gold -= 15; const b = c.co.food.find((f) => f.type === "grain"); if (b) b.n += 10; else c.co.food.push({ type: "grain", n: 10, age: 0 }); p.stunned = 0.5; c.note("Chłopi sprzedają zboże i szybko odchodzą.", ""); this.close(); } });
      acts.push({ label: "Napadnij", sub: "ich srebro i wozy będą twoje; wieść się rozniesie", kind: "bad", on: () => { c.co.morale += p.kind === "caravan" ? 2 : -3; this.close(); this.h.fight(p); } });
    }
    this.show(p.name, body, acts);
  }
  private auto(p: Party) {
    const c = this.c;
    const before = c.partySize(p);
    const res = c.autoResolve(p);
    const body = `<p>${res.win ? "Wróg pękł i rozbiegł się." : "Twoi ludzie nie wytrzymali naporu."}</p>` +
      `<p class="meta">Twoje straty: ${res.mine.killed} zabitych, ${res.mine.wounded} rannych. Wróg: ${res.theirs.killed} zabitych, ${res.theirs.wounded} rannych.</p>`;
    this.after(p, res.win, res.mine.killed, res.theirs.killed + (res.win ? 0 : 0), before, body);
  }

  /** Aftermath: loot, xp, and what to do with the dead. */
  after(p: Party, win: boolean, myDead: number, theirDead: number, _before: number, body: string) {
    const c = this.c, co = c.co, me = co.party;
    this.picture("after", me.x, me.z, 8);
    let lootText = "";
    if (win) {
      const loot = Math.round((p.gold + (p.kind === "caravan" ? 120 : 0)) * (1 + 0.1 * co.hero.skills.lupy));
      const share = Math.round(loot * co.lootShare);
      me.gold += loot - share;
      co.morale = Math.min(100, co.morale + 8 + co.lootShare * 20);
      const food = p.kind === "undead" ? 0 : Math.floor((c.partySize(p) + theirDead) * 2 + (p.kind === "caravan" ? 30 : 0));
      if (food) { const b = co.food.find((f) => f.type === "grain" && f.age === 0); if (b) b.n += food; else co.food.push({ type: "grain", n: food, age: 0 }); }
      for (const s of me.troops) s.xp = Math.min(s.n, s.xp + (s.n - s.wounded));
      const h = co.hero;
      // prisoners: the enemy's wounded, as many as you can guard
      let took = 0;
      if (p.kind !== "undead") {
        co.prisoners = co.prisoners ?? [];
        for (const st of p.troops) {
          const room = prisonerLimit(h) - c.prisonerCount; if (room <= 0) break;
          const k = Math.min(st.wounded, room); if (k <= 0) continue;
          st.n -= k; st.wounded -= k; took += k;
          const pr = co.prisoners.find((x) => x.t === st.t); if (pr) pr.n += k; else co.prisoners.push({ t: st.t, n: k });
        }
        p.troops = p.troops.filter((x) => x.n > 0);
      }
      // spoils: a weapon now and then from what the dead carried
      const items: Item[] = [];
      const drops = Math.floor(theirDead / 4 + c.rand() * (1 + h.skills.lupy * 0.3));
      const pool = [...new Set(p.troops.map((x) => x.t).concat(["rozbojnik"] as TroopId[]))].map((t) => TROOPS[t].kit.weapon as WeaponId);
      for (let i = 0; i < drops; i++) items.push({ kind: "weapon", id: pool[Math.floor(c.rand() * pool.length)] });
      if (p.kind === "caravan" && c.rand() < 0.5) items.push({ kind: "armour", id: "sergeant" });
      co.stash = [...(co.stash ?? []), ...items];
      // experience and renown
      const xp = Math.round(theirDead * 55 + 60 + p.troops.reduce((a, x) => a + power(x.t) * x.n, 0) * 10);
      const ups = addXp(h, xp);
      h.won++; h.renown += Math.round((theirDead + c.partySize(p)) * 0.5) + 1;
      lootText = `<p class="meta">Łup: ${loot} gr (ludzie biorą ${share}), ${food} porcji jedzenia${items.length ? ", " + items.map(itemName).join(", ") : ""}.${took ? ` Jeńcy: ${took}.` : ""}</p><p class="meta">Doświadczenie +${xp}${ups ? ` · <b>Nowy poziom (${h.level})</b>: punkty do rozdania w oknie Postać` : ""} · sława ${h.renown}</p>`;
      if (c.partySize(p) > 0) { p.stunned = 6; p.mode = "flee"; p.gold = 0; }   // the routed survive and scatter
      else c.removeParty(p);
      c.note(`Zwycięstwo nad: ${p.name}.`, "good");
    } else {
      co.morale -= 15; me.gold = Math.floor(me.gold * 0.6); co.hero.lost++;
      lootText = `<p class="meta">Uciekacie. Część srebra zostaje na drodze.</p>`;
      p.stunned = 4;
      c.note(`Klęska w starciu z: ${p.name}.`, "bad");
    }
    const bodies = myDead + theirDead;
    const acts: Act[] = [];
    if (bodies > 0 && win) {
      const buryH = Math.max(1, Math.round(bodies / 14 * 10) / 10), burnH = Math.max(0.5, Math.round(buryH * 4) / 10);
      acts.push({ label: `Pochowajcie zabitych`, sub: `${bodies} ciał · ok. ${buryH.toFixed(1)} h · morale i wiara`, on: () => { c.passHours(buryH); co.morale += myDead ? 5 : 2; c.note("Zabici leżą w ziemi. Ktoś odmówił modlitwę.", ""); this.close(); } });
      acts.push({ label: `Spalcie ciała`, sub: `ok. ${burnH.toFixed(1)} h · szybciej, ale bez obrzędu`, on: () => { c.passHours(burnH); co.morale += 1; c.note("Stos płonie do świtu. Nic z tych ciał już nie wstanie.", ""); this.close(); } });
      acts.push({ label: "Zostawcie ich krukom", sub: "nic nie kosztuje… na razie", kind: "bad", on: () => { c.leaveField(me.x + 1, me.z + 1, bodies); co.morale -= myDead ? 8 : 2; c.note("Zostawiacie pobojowisko krukom.", "warn"); this.close(); } });
    } else {
      if (bodies > 0) c.leaveField(me.x + 1, me.z + 1, bodies);
      acts.push({ label: "Dalej", on: () => this.close() });
    }
    this.show(win ? "Po bitwie" : "Po klęsce", body + lootText, acts);
  }

  private prisonersHtml() {
    const co = this.c.co, pr = co.prisoners ?? [];
    if (!pr.length) return `<p class="meta">Jeńcy: brak (miejsc: ${prisonerLimit(co.hero)}).</p>`;
    return `<table class="tbl"><thead><tr><th>Jeńcy (${this.c.prisonerCount}/${prisonerLimit(co.hero)})</th><th>Ilu</th><th></th></tr></thead><tbody>` +
      pr.map((p) => `<tr><td>${esc(tn(p.t as TroopId))}</td><td>${p.n}</td><td><button type="button" class="ib" data-join="${p.t}">Namów do służby</button> <button type="button" class="ib" data-free="${p.t}">Wypuść</button></td></tr>`).join("") + `</tbody></table>`;
  }
  // ---------- character (Warband: attributes, skills, proficiencies) ----------
  characterPanel() {
    const c = this.c, h = c.co.hero;
    const need = xpForLevel(h.level);
    const attrRows = (Object.keys(ATTRS) as Attr[]).map((a) => `<tr><td>${ATTRS[a].pl}<small>${ATTRS[a].desc}</small></td><td class="num">${h.attr[a]}</td><td>${h.attrPts ? `<button type="button" class="ib plus" data-a="${a}">+</button>` : ""}</td></tr>`).join("");
    const skillRows = (Object.keys(SKILLS) as Skill[]).map((k) => { const cap = skillCap(h, k), v = h.skills[k]; return `<tr><td>${SKILLS[k].pl}<small>${SKILLS[k].desc} · limit ${cap} (${ATTRS[SKILLS[k].attr].pl} / 3)</small></td><td class="num">${v}</td><td>${h.skillPts && v < cap ? `<button type="button" class="ib plus" data-s="${k}">+</button>` : ""}</td></tr>`; }).join("");
    const profRows = (Object.keys(PROFS) as (keyof typeof PROFS)[]).map((p) => `<tr><td>${PROFS[p]}</td><td class="num">${Math.round(h.prof[p])}</td><td></td></tr>`).join("");
    const nick = h.kills >= 40 ? "Rzeźnik" : (c.co.fear ?? 0) >= 6 ? "Wieszatiel" : h.won >= 10 ? "Pogromca band" : h.won >= 3 ? "Kapitan z gościńca" : "nikt szczególny";
    const body = `<p class="meta"><input id="hname" value="${esc(h.name)}" maxlength="24" aria-label="Imię"> · ${esc(h.origin || "")} · przydomek: <b>${nick}</b></p>` +
      `<p class="meta">Poziom ${h.level} · doświadczenie ${h.xp}/${need} · sława ${h.renown} · zdrowie ${heroHp(h)} · limit kompanii ${partyLimit(h)} · jeńcy do ${prisonerLimit(h)}</p>` +
      `<p class="meta">Bitwy wygrane ${h.won}, przegrane ${h.lost} · zabitych własną ręką ${h.kills}${h.attrPts ? ` · <b>punkty atrybutów: ${h.attrPts}</b>` : ""}${h.skillPts ? ` · <b>punkty umiejętności: ${h.skillPts}</b>` : ""}</p>` +
      `<div class="two"><table class="tbl"><thead><tr><th>Atrybut</th><th></th><th></th></tr></thead><tbody>${attrRows}</tbody></table>` +
      `<table class="tbl"><thead><tr><th>Biegłość (rośnie od walki)</th><th></th><th></th></tr></thead><tbody>${profRows}</tbody></table></div>` +
      `<table class="tbl"><thead><tr><th>Umiejętność</th><th></th><th></th></tr></thead><tbody>${skillRows}</tbody></table>`;
    this.show("Postać", body, [{ label: "Zamknij", on: () => this.close() }], true);
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody .plus")) b.addEventListener("click", () => {
      if (b.dataset.a && h.attrPts > 0) { h.attr[b.dataset.a as Attr]++; h.attrPts--; }
      if (b.dataset.s && h.skillPts > 0) { h.skills[b.dataset.s as Skill]++; h.skillPts--; }
      this.characterPanel();
    });
    const nm = document.getElementById("hname") as HTMLInputElement;
    nm.addEventListener("change", () => { h.name = nm.value.trim() || "Bezimienny"; });
  }

  // ---------- inventory (Warband: equipment slots + what you carry) ----------
  inventoryPanel(town?: Settlement) {
    const c = this.c, h = c.co.hero, st = c.co.stash = c.co.stash ?? [];
    const slot = (label: string, v: string, act = "") => `<tr><td>${label}</td><td>${v}</td><td>${act}</td></tr>`;
    let rows = slot("Zbroja", esc(ARMOUR_NAME[h.armour]));
    for (let i = 0; i < 4; i++) { const w = h.weapons[i]; rows += slot(`Broń ${i + 1}`, w ? esc(WEAPONS[w].name) : "—", w && h.weapons.length > 1 ? `<button type="button" class="ib" data-un="${i}">Zdejmij</button>` : ""); }
    rows += slot("Tarcza", h.shield ? "tak (do broni jednoręcznej)" : "nie", `<button type="button" class="ib" data-sh="1">${h.shield ? "Zdejmij" : "Załóż"}</button>`);
    const items = st.map((it, i) => `<tr><td>${esc(itemName(it))}</td><td>${it.kind === "weapon" ? PROFS[WEAPONS[it.id].cls as keyof typeof PROFS] : "zbroja"}</td><td><button type="button" class="ib" data-eq="${i}">Użyj</button>${town ? ` <button type="button" class="ib" data-sell="${i}">Sprzedaj ${this.sellPrice(it)} gr</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="3">Wóz jest pusty.</td></tr>`;
    const body = `<p class="meta">Kółkiem myszy zmieniasz broń w bitwie (po kolei sloty 1–4). Ciężka zbroja chroni lepiej, ale męczy.${town ? " Jesteś w mieście: łupy można sprzedać." : ""}</p>` +
      `<table class="tbl"><thead><tr><th>Na tobie</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table>` +
      `<table class="tbl"><thead><tr><th>Na wozie</th><th></th><th></th></tr></thead><tbody>${items}</tbody></table>`;
    this.show("Ekwipunek", body, [town ? { label: "Wróć", on: () => this.settlement(town.id) } : { label: "Zamknij", on: () => this.close() }], true);
    const re = () => this.inventoryPanel(town);
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody [data-un]")) b.addEventListener("click", () => { const i = Number(b.dataset.un); const w = h.weapons.splice(i, 1)[0]; st.push({ kind: "weapon", id: w }); re(); });
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody [data-sh]")) b.addEventListener("click", () => { h.shield = !h.shield; re(); });
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody [data-eq]")) b.addEventListener("click", () => {
      const i = Number(b.dataset.eq), it = st[i];
      if (it.kind === "weapon") { if (h.weapons.length >= 4) { const old = h.weapons.pop()!; st.push({ kind: "weapon", id: old }); } h.weapons.push(it.id); }
      else { st.push({ kind: "armour", id: h.armour }); h.armour = it.id; }
      st.splice(i, 1); re();
    });
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody [data-sell]")) b.addEventListener("click", () => { const i = Number(b.dataset.sell); c.co.party.gold += this.sellPrice(st[i]); st.splice(i, 1); re(); });
  }
  private buyPrice(it: Item) { return Math.round(itemPrice(it) * (1 - 0.05 * this.c.co.hero.skills.handel)); }
  private sellPrice(it: Item) { return Math.round(itemPrice(it) * (0.35 + 0.05 * this.c.co.hero.skills.handel)); }
  private smith(s: Settlement) {
    const c = this.c, co = c.co;
    const weapons: WeaponId[] = s.culture === "german" ? ["sword", "longsword", "greataxe", "mace", "kord"] : s.culture === "church" ? ["mace", "sword", "glaive", "spear"] : ["hatchet", "spear", "kord", "greataxe", "sword"];
    const armours: Loadout[] = s.culture === "german" ? ["levy", "sergeant", "plate"] : s.culture === "church" ? ["levy", "sergeant", "knight"] : ["levy", "sergeant"];
    const acts: Act[] = [];
    for (const w of weapons) { const it: Item = { kind: "weapon", id: w }, pr = this.buyPrice(it); acts.push({ label: WEAPONS[w].name, sub: `${pr} gr · ${PROFS[WEAPONS[w].cls as keyof typeof PROFS].toLowerCase()}`, off: co.party.gold < pr, on: () => { co.party.gold -= pr; co.stash = [...(co.stash ?? []), it]; c.note(`Kupujesz: ${WEAPONS[w].name}. Leży na wozie (Ekwipunek).`, "good"); this.smith(s); } }); }
    for (const a of armours) { const it: Item = { kind: "armour", id: a }, pr = this.buyPrice(it); acts.push({ label: ARMOUR_NAME[a], sub: `${pr} gr`, off: co.party.gold < pr, on: () => { co.party.gold -= pr; co.stash = [...(co.stash ?? []), it]; c.note(`Kupujesz: ${ARMOUR_NAME[a]}.`, "good"); this.smith(s); } }); }
    acts.push({ label: "Ekwipunek i sprzedaż łupów", on: () => this.inventoryPanel(s) });
    acts.push({ label: "Wróć", on: () => this.settlement(s.id) });
    this.show(`${s.name}: kowal`, `<p>Młoty dzwonią od świtu. Ceny są uczciwe, jak na te czasy.${co.hero.skills.handel ? ` Twój Handel (${co.hero.skills.handel}) zbija cenę.` : ""}</p>`, acts);
  }
  private ransom(s: Settlement) {
    const c = this.c, co = c.co;
    const price = (t: TroopId) => Math.round(18 + power(t) * 22) ;
    const acts: Act[] = (co.prisoners ?? []).map((pr) => ({ label: `${pr.n} × ${tn(pr.t)}`, sub: `${price(pr.t)} gr za głowę`, on: () => { co.party.gold += price(pr.t) * pr.n; c.note(`Sprzedajesz jeńców: ${pr.n} × ${tn(pr.t)}.`, "good"); pr.n = 0; co.prisoners = (co.prisoners ?? []).filter((x) => x.n > 0); this.ransom(s); } }));
    acts.push({ label: "Wróć", on: () => this.settlement(s.id) });
    this.show(`${s.name}: pośrednik okupów`, `<p>Gruby człowiek w futrze liczy głowy jak bydło. Płaci od sztuki, nie pyta, co z nimi będzie.</p>`, acts);
  }

  // ---------- chronicle ----------
  chronicle() {
    const c = this.c;
    const list = c.notes.map((n) => `<div class="${n.kind}"><span class="when">${(n.day % 30) + 1}. dzień, ${String(Math.floor(n.hour)).padStart(2, "0")}:00</span> ${esc(n.text)}</div>`).join("");
    this.show("Kronika", `<div class="chron">${list}</div>`, [{ label: "Zamknij", on: () => this.close() }], true);
  }

  // ---------- travel events ----------
  event(ev: TravelEvent) {
    const c = this.c; c.speed = 0;
    this.picture("ev:" + ev.id, c.co.party.x, c.co.party.z, 6);
    this.show(ev.title, `<p>${esc(ev.text)}</p>`, ev.choices.map((ch) => ({ label: ch.label, sub: ch.sub, off: ch.ok ? !ch.ok(c) : false, on: () => {
      const res = ch.run(c); c.note(res, "");
      this.show(ev.title, `<p>${esc(ev.text)}</p><p class="res">${esc(res)}</p>`, [{ label: "Dalej", on: () => this.close() }]);
    } })));
  }

  // ---------- new campaign: who are you? ----------
  creation(done: () => void) {
    const c = this.c, h = c.co.hero;
    const body = `<p>Rok Popiołu 37. Zanim ktokolwiek zapamięta twoje imię, ktoś musi je usłyszeć.</p><p class="meta">Imię: <input id="cname" value="${esc(h.name === "Bezimienny" ? "" : h.name)}" maxlength="24" placeholder="Bezimienny"></p><p>Kim byłeś, zanim zebrałeś kompanię?</p>`;
    this.pic = null;
    this.show("Nowa kampania", body, ORIGINS.map((o) => ({ label: o.name, sub: o.text, on: () => {
      const nm = (document.getElementById("cname") as HTMLInputElement | null)?.value.trim();
      h.name = nm || "Bezimienny"; h.origin = o.name;
      const r = o.apply(h); c.co.party.gold = r.gold;
      c.note(`${h.name}, ${o.name.toLowerCase()}, zbiera ludzi pod Kruczym Brodem.`, "");
      this.close(); done();
    } })));
  }

  partyPanel() {
    const c = this.c, co = c.co;
    const grp = (t: TroopId) => co.groups?.[t] ?? DEFAULT_GROUP[t] ?? 1;
    const row = (s: Stack) => `<tr><td>${esc(tn(s.t))}</td><td>${s.n}</td><td>${s.wounded || ""}</td><td>${Math.floor(s.xp) || ""}</td><td>${TROOPS[s.t].wage * s.n}</td><td><button type="button" class="ib grp" data-t="${s.t}" title="Zmień grupę w bitwie">${grp(s.t)}</button></td></tr>`;
    const food = co.food.map((f) => `<tr><td>${FOOD[f.type].pl}</td><td>${f.n}</td><td>${FOOD[f.type].spoil < 99 ? Math.max(0, FOOD[f.type].spoil - f.age) + " d" : "—"}</td></tr>`).join("");
    const body = `<table class="tbl"><thead><tr><th>Oddział</th><th>Ludzi</th><th>Rannych</th><th>Gotowi do awansu</th><th>Żołd/tydz.</th><th>Grupa</th></tr></thead><tbody>${co.party.troops.map(row).join("")}</tbody>` +
      `<tfoot><tr><td>Razem</td><td>${c.men - 1}</td><td></td><td></td><td>${c.weeklyWage}</td><td></td></tr></tfoot></table>` +
      `<table class="tbl"><thead><tr><th>Zapasy</th><th>Porcji</th><th>Do zepsucia</th></tr></thead><tbody>${food}</tbody></table>` +
      this.prisonersHtml() + `<p class="meta">Grupy decydują, kto stoi razem w bitwie (klawisze 1–9, F1 ruch, F2 formacja).</p><p class="meta">Woda: ${co.water}/${co.waterCap} dni · futra i koce: ${co.furs} · morale ${Math.round(co.morale)}/100 · udział ludzi w łupach: ${Math.round(co.lootShare * 100)}%</p>`;
    this.show("Kompania", body, [
      { label: "Udział w łupach −10%", sub: "więcej srebra dla ciebie, mniej serca u ludzi", off: co.lootShare <= 0, on: () => { co.lootShare = Math.max(0, co.lootShare - 0.1); this.partyPanel(); } },
      { label: "Udział w łupach +10%", sub: "ludzie walczą chętniej", off: co.lootShare >= 0.5, on: () => { co.lootShare = Math.min(0.5, co.lootShare + 0.1); this.partyPanel(); } },
      { label: "Zamknij", on: () => this.close() },
    ], true);
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody [data-join]")) b.addEventListener("click", () => {
      const pr = (co.prisoners ?? []).find((x) => x.t === b.dataset.join); if (!pr || pr.n <= 0) return;
      if (c.partySize(co.party) >= partyLimit(co.hero)) { c.note("Kompania pełna.", "warn"); this.partyPanel(); return; }
      const chance = 0.3 + 0.12 * co.hero.skills.perswazja;
      if (c.rand() < chance) { pr.n--; c.addTroops(co.party, pr.t as TroopId, 1); c.note(`${tn(pr.t as TroopId)} przysięga ci wierność. Na razie.`, "good"); }
      else { c.co.morale -= 1; c.note("Jeniec pluje ci pod nogi.", "warn"); }
      co.prisoners = (co.prisoners ?? []).filter((x) => x.n > 0); this.partyPanel();
    });
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody [data-free]")) b.addEventListener("click", () => {
      co.prisoners = (co.prisoners ?? []).filter((x) => x.t !== b.dataset.free); c.note("Wypuszczasz jeńców. Ludzie kręcą głowami.", ""); this.partyPanel();
    });
    // battle groups: click to cycle 1..9
    for (const b of document.querySelectorAll<HTMLButtonElement>("#mbody .grp")) b.addEventListener("click", () => {
      const t = b.dataset.t as TroopId; co.groups = co.groups ?? {};
      co.groups[t] = ((co.groups[t] ?? DEFAULT_GROUP[t] ?? 1) % 9) + 1; this.partyPanel();
    });
  }
}

function flavour(s: Settlement): string {
  const t: Record<string, string> = {
    grauburg: "Mury z szarego kamienia, cechowe chorągwie i kat, który ma dużo pracy. Liga płaci dobrze, ale liczy każdy grosz.",
    wronsk: "Drewniany gród na wzgórzu. Bojarzy kłócą się o resztki, a pod kościołem wciąż ktoś zostawia miód dla starych bogów.",
    morwen: "Iglica katedry widoczna z dwóch dni drogi. Procesje biczowników, stosy na rynku i najlepsze relikwie w regionie.",
    straznica: "Czarna Strażnica pilnuje przełęczy. Kasztelan nie lubi gości.",
    gnilowo: "Bagno podchodzi pod same chałupy. Ludzie mają żółte oczy i nie patrzą w stronę cmentarza.",
    krucz: "Bród na rzece i kruki na każdym płocie. Tu zaczyna się droga każdego, kto nie ma nic do stracenia.",
  };
  return `<p>${t[s.id] ?? (s.kind === "village" ? "Kilka chałup, płot z chrustu, pies, który już nie szczeka. Ludzie patrzą na twoją broń, nie na twarz." : "")}</p>`;
}
