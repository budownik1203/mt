// The player character, Warband-style: attributes, skills (capped by their
// attribute), weapon proficiencies that grow with use, levels from experience,
// renown; plus equipment, the item stash and prices.
import type { WeaponId } from "../char/weapons.ts";
import type { Loadout } from "../char/gear.ts";

export type Attr = "cialo" | "refleks" | "wiedza" | "posluch";
export const ATTRS: Record<Attr, { pl: string; en: string; desc: string }> = {
  cialo: { pl: "Ciało", en: "Body", desc: "siła ciosu, zdrowie, noszenie zbroi" },
  refleks: { pl: "Refleks", en: "Reflex", desc: "szybkość, biegłości w broni, atletyka" },
  wiedza: { pl: "Wiedza", en: "Lore", desc: "medycyna, taktyka, zwiad, więcej punktów umiejętności" },
  posluch: { pl: "Posłuch", en: "Command", desc: "dowodzenie, handel, perswazja, jeńcy" },
};
export type Skill = "twarde" | "sila" | "atletyka" | "dowodzenie" | "handel" | "chirurgia" | "leczenie" | "szkolenie" | "taktyka" | "tropienie" | "zwiad" | "lupy" | "jency" | "perswazja";
export const SKILLS: Record<Skill, { pl: string; attr: Attr; desc: string }> = {
  twarde: { pl: "Twarde ciało", attr: "cialo", desc: "+4 zdrowia na poziom" },
  sila: { pl: "Siła ciosu", attr: "cialo", desc: "+8% obrażeń wręcz na poziom" },
  atletyka: { pl: "Atletyka", attr: "refleks", desc: "+3% szybkości biegu na poziom" },
  dowodzenie: { pl: "Dowodzenie", attr: "posluch", desc: "+5 miejsc w kompanii i +3 morale na poziom" },
  handel: { pl: "Handel", attr: "posluch", desc: "−5% cen przy kupnie, +5% przy sprzedaży na poziom" },
  chirurgia: { pl: "Chirurgia", attr: "wiedza", desc: "4% szans na poziom, że zabity okaże się tylko ranny" },
  leczenie: { pl: "Leczenie ran", attr: "wiedza", desc: "+20% szybkości leczenia na poziom" },
  szkolenie: { pl: "Szkolenie", attr: "cialo", desc: "codzienne doświadczenie dla żołnierzy" },
  taktyka: { pl: "Taktyka", attr: "wiedza", desc: "+6% siły przy rozstrzyganiu bez walki na poziom" },
  tropienie: { pl: "Tropienie", attr: "wiedza", desc: "+3% szybkości na mapie na poziom" },
  zwiad: { pl: "Zwiad", attr: "wiedza", desc: "+10% zasięgu widzenia na mapie na poziom" },
  lupy: { pl: "Łupiestwo", attr: "refleks", desc: "+10% łupów na poziom" },
  jency: { pl: "Pilnowanie jeńców", attr: "posluch", desc: "+5 miejsc na jeńców na poziom" },
  perswazja: { pl: "Perswazja", attr: "posluch", desc: "jeńcy łatwiej przechodzą na twoją stronę" },
};
export type Prof = "oh" | "th" | "pa";
export const PROFS: Record<Prof, string> = { oh: "Broń jednoręczna", th: "Broń dwuręczna", pa: "Broń drzewcowa" };

export type Item = { kind: "weapon"; id: WeaponId } | { kind: "armour"; id: Loadout };
export interface Hero {
  name: string; origin: string;
  level: number; xp: number; attrPts: number; skillPts: number;
  attr: Record<Attr, number>; skills: Record<Skill, number>; prof: Record<Prof, number>;
  renown: number; kills: number; won: number; lost: number;
  armour: Loadout; weapons: WeaponId[]; shield: boolean;
}
export function newHero(): Hero {
  const skills = Object.fromEntries(Object.keys(SKILLS).map((k) => [k, 0])) as Record<Skill, number>;
  return { name: "Bezimienny", origin: "", level: 1, xp: 0, attrPts: 0, skillPts: 1, attr: { cialo: 7, refleks: 6, wiedza: 5, posluch: 6 }, skills, prof: { oh: 70, th: 50, pa: 55 },
    renown: 0, kills: 0, won: 0, lost: 0, armour: "levy", weapons: ["sword"], shield: true };
}
/** Skill cap from its attribute (Warband: attribute / 3). */
export const skillCap = (h: Hero, s: Skill) => Math.floor(h.attr[SKILLS[s].attr] / 3);
export const xpForLevel = (l: number) => Math.round(400 * Math.pow(l, 1.7));
/** Give experience; returns how many levels were gained. */
export function addXp(h: Hero, xp: number): number {
  h.xp += Math.round(xp); let n = 0;
  while (h.xp >= xpForLevel(h.level)) { h.level++; h.attrPts += 1; h.skillPts += 1 + Math.floor(h.attr.wiedza / 6); n++; }
  return n;
}
export const heroHp = (h: Hero) => 90 + h.attr.cialo * 3 + h.skills.twarde * 4;
export const partyLimit = (h: Hero) => 25 + h.skills.dowodzenie * 5 + h.attr.posluch + Math.floor(h.renown / 20);
export const prisonerLimit = (h: Hero) => 3 + h.skills.jency * 5;

// ---------- the start: who were you? (Warband-like character creation) ----------
export interface Origin { id: string; name: string; text: string; apply: (h: Hero) => { gold: number } }
export const ORIGINS: Origin[] = [
  { id: "dezerter", name: "Dezerter", text: "Służyłeś w pospolitym ruszeniu, aż przestali płacić. Umiesz trzymać włócznię i uciekać, kiedy trzeba.",
    apply: (h) => { h.attr.cialo += 2; h.prof.pa += 40; h.skills.atletyka = 1; h.armour = "levy"; h.weapons = ["spear", "kord"]; h.shield = false; return { gold: 120 }; } },
  { id: "kowal", name: "Syn kowala", text: "Wyrosłeś przy kowadle. Wiesz, ile wart jest dobry hartowany miecz i ile za niego żądać.",
    apply: (h) => { h.attr.cialo += 1; h.attr.posluch += 1; h.skills.handel = 1; h.prof.oh += 30; h.armour = "levy"; h.weapons = ["sword", "hatchet"]; return { gold: 260 }; } },
  { id: "kleryk", name: "Wyklęty kleryk", text: "Uczyłeś się w klasztorze ksiąg i leczenia, dopóki nie zadałeś o jedno pytanie za dużo.",
    apply: (h) => { h.attr.wiedza += 3; h.skills.chirurgia = 1; h.skills.leczenie = 1; h.armour = "base"; h.weapons = ["mace"]; return { gold: 180 }; } },
  { id: "zboj", name: "Zbój z gościńca", text: "Żyłeś z cudzej sakiewki. Szybki nóż, szybkie nogi, żadnych pytań.",
    apply: (h) => { h.attr.refleks += 2; h.skills.lupy = 1; h.prof.oh += 40; h.armour = "base"; h.weapons = ["kord", "hatchet"]; h.shield = false; return { gold: 200 }; } },
  { id: "szlachcic", name: "Zubożały szlachcic", text: "Herb na tarczy, dziury w butach. Umiesz rozkazywać, a ludzie jeszcze pamiętają twoje nazwisko.",
    apply: (h) => { h.attr.posluch += 2; h.skills.dowodzenie = 1; h.prof.oh += 20; h.armour = "sergeant"; h.weapons = ["sword"]; return { gold: 300 }; } },
];

// ---------- items and prices ----------
import { WEAPONS } from "../char/weapons.ts";
export const WEAPON_PRICE: Record<WeaponId, number> = { kord: 40, hatchet: 35, mace: 60, sword: 110, spear: 45, longsword: 220, greataxe: 160, glaive: 130 };
export const ARMOUR_PRICE: Record<Loadout, number> = { base: 10, levy: 70, sergeant: 320, knight: 900, plate: 1400 };
export const ARMOUR_NAME: Record<Loadout, string> = { base: "Łachmany i owijacze", levy: "Przeszywanica i kapalin", sergeant: "Kolczuga, czepiec i szyszak", knight: "Kolczuga, wappenrock i hełm garnczkowy", plate: "Zbroja płytowa" };
export const itemName = (it: Item) => (it.kind === "weapon" ? WEAPONS[it.id].name : ARMOUR_NAME[it.id]);
export const itemPrice = (it: Item) => (it.kind === "weapon" ? WEAPON_PRICE[it.id] : ARMOUR_PRICE[it.id]);
export const profOf = (w: WeaponId): Prof => WEAPONS[w].cls as Prof;
