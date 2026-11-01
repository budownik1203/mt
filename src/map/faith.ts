// Faith and rites (build 12): the Church (monotheist, its own symbols, the
// Inquisition) and the Old Faith (a hungry Slavic-Baltic pantheon). The hero's
// faith, piety and the gods' favour; the company's faiths and their quarrels;
// chaplains and żercy; monastery and sacred grove on the map; rites in camp
// that grant a blessing for a few days; Kupała and Dziady; excommunication.
import type { Campaign } from "./campaign.ts";
import { TROOPS, TroopId } from "./troops.ts";
import { changeRel } from "./factions.ts";

export type Faith = "kosciol" | "stara" | "brak";
export const FAITH_NAME: Record<Faith, string> = { kosciol: "Kościół", stara: "Stara wiara", brak: "bez wiary" };
/** Which faith a soldier keeps (undead and beasts keep none). */
export function troopFaith(t: TroopId): Faith {
  const T = TROOPS[t]; if (T.undead || T.beast) return "brak";
  if (["chlop", "chlop_luk", "pacholek", "lucznik", "zerca"].includes(t)) return "stara";
  if (["rozbojnik", "dezerter", "herszt", "nekromanta", "kupiec"].includes(t)) return "brak";
  return "kosciol";
}

export interface Boon { id: BoonId; until: number }
export type BoonId = "blogoslawienstwo" | "perun" | "weles" | "mokosz";
export const BOONS: Record<BoonId, { name: string; effect: string }> = {
  blogoslawienstwo: { name: "Błogosławieństwo przed bitwą", effect: "morale w bitwie +12" },
  perun: { name: "Łaska Peruna", effect: "obrażenia twoich ludzi +10%" },
  weles: { name: "Łaska Welesa", effect: "ranni wracają do sił 2× szybciej, umarli nie wstają z twoich pól" },
  mokosz: { name: "Łaska Mokoszy", effect: "jedzenie psuje się wolniej, +2 morale dziennie" },
};

export interface FaithState { hero: Faith; piety: number; favor: number; excom: boolean; boon?: Boon; lastRite?: number }
export const newFaith = (): FaithState => ({ hero: "kosciol", piety: 10, favor: 0, excom: false });
export const faithOf = (c: Campaign) => (c.co.faith ??= newFaith());
export const boon = (c: Campaign, id: BoonId) => { const f = faithOf(c); return f.boon?.id === id && f.boon.until >= c.day; };

/** Shares of each faith among the living men (and the hero). */
export function faithShares(c: Campaign) {
  const n: Record<Faith, number> = { kosciol: 0, stara: 0, brak: 0 };
  for (const s of c.co.party.troops) { if (TROOPS[s.t].undead || TROOPS[s.t].beast) continue; n[troopFaith(s.t)] += s.n; }
  const tot = Math.max(1, n.kosciol + n.stara + n.brak);
  return { kosciol: n.kosciol / tot, stara: n.stara / tot, brak: n.brak / tot, count: n };
}
const has = (c: Campaign, t: TroopId) => c.co.party.troops.some((s) => s.t === t && s.n > 0);

/** Daily morale effect of faith in the company: returns the change and the reasons (shown in the Company panel). */
export function faithMorale(c: Campaign): { d: number; why: string[] } {
  const f = faithOf(c), sh = faithShares(c), why: string[] = [];
  let d = 0;
  if (f.hero !== "brak") {
    const other = f.hero === "kosciol" ? sh.stara : sh.kosciol;
    if (other > 0.35) { const k = Math.round((other - 0.35) * 10); d -= k; why.push(`${Math.round(other * 100)}% ludzi innej wiary niż ty: −${k}`); }
  }
  if (sh.kosciol > 0.2 && sh.stara > 0.2) { d -= 1; why.push("swary przy ognisku (dwie wiary): −1"); }
  if (has(c, "kapelan") && sh.kosciol > 0.2) { d += 1; why.push("kapelan odprawia msze: +1"); }
  if (has(c, "zerca") && sh.stara > 0.2) { d += 1; why.push("żerca pilnuje obrzędów: +1"); }
  if (f.excom && sh.kosciol > 0.2) { d -= 2; why.push("ekskomunika: ludzie Kościoła się boją: −2"); }
  if (boon(c, "mokosz")) { d += 2; why.push("łaska Mokoszy: +2"); }
  return { d, why };
}

export function faithDaily(c: Campaign) {
  const f = faithOf(c), co = c.co;
  co.morale += faithMorale(c).d;
  if (has(c, "kapelan")) f.piety = Math.min(100, f.piety + 0.3);
  if (has(c, "zerca")) f.favor = Math.min(100, f.favor + 0.3);
  // the gods are hungry: favour fades
  f.favor = Math.max(0, f.favor - 0.2);
  if (f.boon && f.boon.until < c.day) { c.note(`${BOONS[f.boon.id].name} przemija.`, ""); f.boon = undefined; }
  // excommunication: corruption or human sacrifice
  if (!f.excom && (co.hero.corruption ?? 0) >= 60) excommunicate(c, "plotki o nekromancji doszły do Sankt Morwen");
  // feasts
  const dy = c.day % 120;
  if (dy === 50) c.note("Noc Kupały. Ogniska na wzgórzach, wianki na wodzie. Stara wiara świętuje, księża grzmią.", "warn");
  if (dy === 85) c.note("Dziady. Zmarli wracają tej nocy po jadło. Kto ich nie nakarmi, ten ich spotka.", "bad");
}
export function excommunicate(c: Campaign, why: string) {
  const f = faithOf(c); if (f.excom) return;
  f.excom = true; f.piety = Math.max(0, f.piety - 30);
  changeRel(c, "arcybiskupstwo", -30, "ekskomunika");
  c.note(`Ekskomunika: ${why}. Arcybiskupstwo wyklina cię z ambon.`, "bad");
}
export const isDziady = (c: Campaign) => c.day % 120 === 85;
export const isKupala = (c: Campaign) => c.day % 120 === 50;

// ---------- places: monastery and grove ----------
export interface FaithAct { label: string; sub: string; off?: boolean; kind?: "go" | "bad" | ""; run: () => string }
const nearPoi = (c: Campaign, kind: string) => { const me = c.co.party; return c.w.pois.find((q) => q.kind === kind && Math.hypot(q.x - me.x, q.z - me.z) < 7) ?? null; };
function food(c: Campaign, n: number) { let left = n; for (const b of c.co.food) { const k = Math.min(b.n, left); b.n -= k; left -= k; } c.co.food = c.co.food.filter((b) => b.n > 0); return n - left; }

export function placeFaithActs(c: Campaign): FaithAct[] {
  const out: FaithAct[] = [], f = faithOf(c), co = c.co, me = co.party;
  const room = () => c.partySize(me) < 25 + co.hero.skills.dowodzenie * 5 + co.hero.attr.posluch + Math.floor(co.hero.renown / 20);
  if (nearPoi(c, "monastery")) {
    out.push({ label: "Msza i spowiedź", sub: `3 h · 20 gr na tacę · pobożność +8, ludzie Kościoła +morale${f.excom ? " · ekskomunikowanych nie wpuszczą" : ""}`, off: f.excom || me.gold < 20, run: () => {
      c.passHours(3); me.gold -= 20; f.piety = Math.min(100, f.piety + 8); co.morale += 6 * faithShares(c).kosciol;
      c.note("Msza w klasztorze. Mnisi śpiewają nisko, kadzidło gryzie w oczy.", "good");
      return `<p>Mnisi śpiewają po łacinie, której nikt z twoich ludzi nie rozumie. Ci, którzy wierzą, wychodzą lżejsi.</p>`;
    } });
    out.push({ label: "Pokuta", sub: f.excom ? `${120 + Math.round((co.hero.corruption ?? 0) * 3)} gr i 2 dni postu · zdejmuje ekskomunikę (zepsucie musi być < 60)` : "nie jesteś wyklęty", off: !f.excom || me.gold < 120 + Math.round((co.hero.corruption ?? 0) * 3) || (co.hero.corruption ?? 0) >= 60, run: () => {
      const cost = 120 + Math.round((co.hero.corruption ?? 0) * 3);
      me.gold -= cost; c.passHours(48); f.excom = false; changeRel(c, "arcybiskupstwo", 15);
      c.note("Pokuta odbyta. Opat zdejmuje klątwę.", "good");
      return `<p>Dwa dni na kolanach na kamiennej posadzce, o chlebie i wodzie. Opat liczy srebro i zdejmuje klątwę.</p>`;
    } });
    out.push({ label: "Kup relikwię", sub: "150 gr · kość świętego w srebrze · pobożność +10, zepsucie −10", off: me.gold < 150, run: () => {
      me.gold -= 150; f.piety = Math.min(100, f.piety + 10); co.hero.corruption = Math.max(0, (co.hero.corruption ?? 0) - 10);
      c.note("Kupiłeś relikwię: palec świętego Morwena (podobno).", "good");
      return `<p>Brat furtian przynosi szkatułkę. W środku kość palca, owinięta w złotą nić. „Święty Morwen”, mówi. Kto by sprawdzał.</p>`;
    } });
    out.push({ label: "Przyjmij kapelana", sub: room() ? "60 gr · kapelan w kompanii: +1 morale dziennie (ludzie Kościoła), pobożność rośnie" : "kompania pełna", off: me.gold < 60 || !room() || f.excom, run: () => {
      me.gold -= 60; c.addTroops(me, "kapelan", 1); c.note("Kapelan dołącza do kompanii.", "good");
      return `<p>Młody mnich z wytartym brewiarzem wsiada na wóz. Pyta, gdzie będzie spał, i czy są tu grzesznicy. Są.</p>`;
    } });
    if (f.hero !== "kosciol") out.push({ label: "Przyjmij chrzest", sub: "porzucasz starą wiarę · łaska bogów spada do 0", kind: "bad", run: () => { f.hero = "kosciol"; f.favor = 0; f.piety = Math.max(f.piety, 10); c.note("Przyjąłeś chrzest w klasztorze.", "warn"); return `<p>Zimna woda na głowę, sól na język. Gdzieś w lesie ktoś splunął w ogień.</p>`; } });
  }
  if (nearPoi(c, "grove")) {
    const prisoners = (co.prisoners ?? []).reduce((a, p) => a + p.n, 0);
    out.push({ label: "Ofiara z jadła", sub: "15 porcji · 2 h · łaska +10, Łaska Mokoszy (5 dni)", off: c.foodTotal < 15, run: () => {
      food(c, 15); c.passHours(2); f.favor = Math.min(100, f.favor + 10); f.boon = { id: "mokosz", until: c.day + 5 };
      c.note("Ofiara w gaju: chleb, miód, piwo na kamieniu.", "good");
      return `<p>Na płaskim kamieniu pod dębem kładziecie chleb, miód i dzban piwa. Wiatr cichnie. Ktoś mówi, że to dobry znak.</p>`;
    } });
    out.push({ label: "Ofiara z czarnego koguta i krwi", sub: "40 gr · 2 h · łaska +12, Łaska Welesa (5 dni)", off: me.gold < 40, run: () => {
      me.gold -= 40; c.passHours(2); f.favor = Math.min(100, f.favor + 12); f.boon = { id: "weles", until: c.day + 5 };
      return `<p>Kogut trzepocze się chwilę na kamieniu. Krew wsiąka w mech. Weles, pan bydła i zmarłych, patrzy z dołu.</p>`;
    } });
    out.push({ label: "Ofiara z jeńca", sub: prisoners ? `jeniec ginie na dębie · łaska +25, Łaska Peruna (4 dni) · Kościół: ekskomunika` : "nie masz jeńców", off: !prisoners, kind: "bad", run: () => {
      const pr = co.prisoners!.find((p) => p.n > 0)!; pr.n--; co.prisoners = co.prisoners!.filter((p) => p.n > 0);
      c.passHours(2); f.favor = Math.min(100, f.favor + 25); f.boon = { id: "perun", until: c.day + 4 };
      co.fear = (co.fear ?? 0) + 2; co.morale += faithShares(c).stara * 6 - faithShares(c).kosciol * 8;
      excommunicate(c, "złożyłeś człowieka w ofierze pogańskim bogom");
      c.note("Jeniec zawisł na świętym dębie. Grzmot, choć niebo czyste.", "bad");
      return `<p>Wieszacie go na najniższym konarze, twarzą na wschód. Gdy przestaje się ruszać, za lasem grzmi, choć nie ma chmur. Twoi poganie klękają. Twoi chrześcijanie odwracają wzrok.</p>`;
    } });
    out.push({ label: "Przyjmij żercę", sub: room() ? "30 gr · żerca w kompanii: +1 morale dziennie (stara wiara), łaska rośnie" : "kompania pełna", off: me.gold < 30 || !room(), run: () => {
      me.gold -= 30; c.addTroops(me, "zerca", 1); c.note("Żerca dołącza do kompanii.", "good");
      return `<p>Stary człowiek w niedźwiedziej skórze. Nie pyta o żołd, pyta, czy jest gdzie rozpalić ogień.</p>`;
    } });
    if (f.hero !== "stara") out.push({ label: "Wróć do starych bogów", sub: "porzucasz Kościół · pobożność 0 · Arcybiskupstwo −20", kind: "bad", run: () => { f.hero = "stara"; f.piety = 0; f.favor = Math.max(f.favor, 10); changeRel(c, "arcybiskupstwo", -20, "apostazja"); c.note("Złożyłeś ofiarę starym bogom jako jeden z nich.", "warn"); return `<p>Żerca maluje ci krwią znak na czole. Perun ma znów jednego syna więcej.</p>`; } });
  }
  return out;
}

/** Rites anywhere in camp (once a day): prayer with a chaplain, or a fire offering with a żerca. */
export function campRites(c: Campaign): FaithAct[] {
  const f = faithOf(c), co = c.co, out: FaithAct[] = [];
  const done = f.lastRite === c.day;
  if (has(c, "kapelan")) out.push({ label: "Msza polowa", sub: done ? "dziś już był obrzęd" : !co.camp ? "najpierw rozbij obóz" : "1 h · Błogosławieństwo przed bitwą (2 dni): morale w bitwie +12", off: done || !co.camp || f.excom, run: () => {
    c.passHours(1); f.lastRite = c.day; f.piety = Math.min(100, f.piety + 2); f.boon = { id: "blogoslawienstwo", until: c.day + 2 };
    return `<p>Kapelan stawia ołtarz z bębna i tarczy. Kto wierzy, klęka w błocie. Kto nie, czyści broń i udaje, że nie słucha.</p>`;
  } });
  if (has(c, "zerca")) out.push({ label: "Ogień dla Swaroga", sub: done ? "dziś już był obrzęd" : !co.camp ? "najpierw rozbij obóz" : "1 h · 5 porcji w ogień · łaska +4", off: done || !co.camp || c.foodTotal < 5, run: () => {
    c.passHours(1); f.lastRite = c.day; food(c, 5); f.favor = Math.min(100, f.favor + 4);
    return `<p>Żerca wrzuca chleb w ogień i patrzy, jak dym idzie. Prosto w górę. Dobrze.</p>`;
  } });
  if (isDziady(c)) out.push({ label: "Nakarmić zmarłych (Dziady)", sub: "10 porcji na rozstajach · twoje pobojowiska nie wstaną tej nocy", off: c.foodTotal < 10, run: () => {
    food(c, 10); c.fields.length = 0; f.favor = Math.min(100, f.favor + 5);
    c.note("Dziady: jadło dla zmarłych na rozstajach. Pola bitew zostały spokojne.", "good");
    return `<p>Kasza, miód, jajka na rozstajach. Nikt się nie odwraca, gdy zmarli przychodzą jeść. Rano miski są puste.</p>`;
  } });
  return out;
}
