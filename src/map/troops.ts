// Troop types: what a soldier is on the campaign map (wage, strength) and in
// battle (the Kit the fighter is built from).
import { ARMOURS } from "../game/combat.ts";
import type { Kit } from "../game/warrior.ts";

export type TroopId = "chlop" | "pacholek" | "zbrojny" | "halabardnik" | "plytowy" | "rycerz" | "rozbojnik" | "herszt" | "dezerter" | "kupiec" | "zywy_trup"
  | "szkielet" | "kosciany_wojownik" | "kosciany_straznik" | "rycerz_grobu" | "ghul" | "ghul_cmentarny" | "straznik_krypty" | "nekromanta" | "lowca";
export interface TroopType {
  id: TroopId; name: { pl: string; en: string };
  kit: Omit<Kit, "name">; wage: number; tier: number; upTo?: TroopId; upCost?: number;
  undead?: boolean;
}
const k = (loadout: Kit["loadout"], weapon: Kit["weapon"], shield: boolean, armour: keyof typeof ARMOURS, hp: number, skill: number): Omit<Kit, "name"> => ({ loadout, weapon, shield, armour: ARMOURS[armour], hp, skill });

const u = (body: "skeleton" | "ghoul" | "zombie", tier: number, weapon: Kit["weapon"], shield: boolean, armour: keyof typeof ARMOURS, hp: number, skill: number): Omit<Kit, "name"> => ({ ...k("base", weapon, shield, armour, hp, skill), undead: body, tier });

export const TROOPS: Record<TroopId, TroopType> = {
  chlop: { id: "chlop", name: { pl: "Chłop z siekierą", en: "Peasant with an axe" }, kit: k("base", "hatchet", false, "rags", 75, 0.25), wage: 1, tier: 0, upTo: "pacholek", upCost: 30 },
  pacholek: { id: "pacholek", name: { pl: "Pachołek z włócznią", en: "Spear levy" }, kit: k("levy", "spear", false, "gambeson", 85, 0.4), wage: 3, tier: 1, upTo: "zbrojny", upCost: 90 },
  zbrojny: { id: "zbrojny", name: { pl: "Zbrojny", en: "Sergeant" }, kit: k("sergeant", "sword", true, "mail", 100, 0.55), wage: 8, tier: 2, upTo: "plytowy", upCost: 220 },
  halabardnik: { id: "halabardnik", name: { pl: "Halabardnik", en: "Glaiveman" }, kit: k("levy", "glaive", false, "gambeson", 95, 0.55), wage: 6, tier: 2 },
  plytowy: { id: "plytowy", name: { pl: "Zbrojny w płytach", en: "Plated man-at-arms" }, kit: k("plate", "mace", false, "plate", 110, 0.68), wage: 14, tier: 3 },
  rycerz: { id: "rycerz", name: { pl: "Rycerz", en: "Knight" }, kit: k("knight", "longsword", false, "plate", 125, 0.78), wage: 25, tier: 4 },
  rozbojnik: { id: "rozbojnik", name: { pl: "Rozbójnik", en: "Brigand" }, kit: k("base", "hatchet", false, "rags", 80, 0.3), wage: 2, tier: 0 },
  herszt: { id: "herszt", name: { pl: "Herszt zbójców", en: "Brigand chief" }, kit: k("sergeant", "kord", true, "gambeson", 110, 0.55), wage: 10, tier: 2 },
  dezerter: { id: "dezerter", name: { pl: "Dezerter", en: "Deserter" }, kit: k("levy", "spear", false, "gambeson", 90, 0.45), wage: 4, tier: 1 },
  kupiec: { id: "kupiec", name: { pl: "Najemny strażnik", en: "Caravan guard" }, kit: k("sergeant", "sword", true, "mail", 100, 0.5), wage: 8, tier: 2 },
  // ---------- the dead (build 8): no food, no wage, no morale; they advance by ritual, not by experience ----------
  zywy_trup: { id: "zywy_trup", name: { pl: "Żywy trup", en: "Risen corpse" }, kit: u("zombie", 0, "hatchet", false, "rags", 70, 0.2), wage: 0, tier: 0, undead: true },
  szkielet: { id: "szkielet", name: { pl: "Szkielet", en: "Skeleton" }, kit: u("skeleton", 0, "kord", false, "rags", 60, 0.3), wage: 0, tier: 0, undead: true, upTo: "kosciany_wojownik" },
  kosciany_wojownik: { id: "kosciany_wojownik", name: { pl: "Kościany wojownik", en: "Bone warrior" }, kit: u("skeleton", 1, "sword", true, "gambeson", 72, 0.45), wage: 0, tier: 1, undead: true, upTo: "kosciany_straznik" },
  kosciany_straznik: { id: "kosciany_straznik", name: { pl: "Kościany strażnik", en: "Bone warden" }, kit: u("skeleton", 2, "glaive", false, "mail", 82, 0.55), wage: 0, tier: 2, undead: true, upTo: "rycerz_grobu" },
  rycerz_grobu: { id: "rycerz_grobu", name: { pl: "Rycerz grobu", en: "Grave knight" }, kit: u("skeleton", 3, "longsword", false, "plate", 105, 0.7), wage: 0, tier: 3, undead: true },
  ghul: { id: "ghul", name: { pl: "Ghul", en: "Ghoul" }, kit: u("ghoul", 0, "claws", false, "rags", 72, 0.35), wage: 0, tier: 0, undead: true, upTo: "ghul_cmentarny" },
  ghul_cmentarny: { id: "ghul_cmentarny", name: { pl: "Ghul cmentarny", en: "Graveyard ghoul" }, kit: u("ghoul", 1, "claws", false, "gambeson", 88, 0.5), wage: 0, tier: 1, undead: true, upTo: "straznik_krypty" },
  straznik_krypty: { id: "straznik_krypty", name: { pl: "Strażnik krypty", en: "Crypt warden" }, kit: u("ghoul", 2, "greataxe", false, "mail", 115, 0.62), wage: 0, tier: 2, undead: true },
  nekromanta: { id: "nekromanta", name: { pl: "Nekromanta", en: "Necromancer" }, kit: k("base", "mace", false, "gambeson", 85, 0.5), wage: 30, tier: 2 },
  lowca: { id: "lowca", name: { pl: "Łowca czarownic", en: "Witch hunter" }, kit: k("sergeant", "sword", true, "mail", 110, 0.66), wage: 12, tier: 3 },
};

export function kitOf(t: TroopId): Kit { const T = TROOPS[t]; return { ...T.kit, name: T.name }; }
/** Rough fighting worth of one soldier (for auto-resolve and AI decisions). */
export function power(t: TroopId): number {
  const T = TROOPS[t], a = T.kit.armour;
  return (T.kit.hp / 100) * (1 + (a.body + a.head) / 90) * (0.55 + T.kit.skill);
}

/** Default battle group per troop type (1 melee, 2 polearms, 3 heavy). */
export const DEFAULT_GROUP: Partial<Record<TroopId, number>> = { chlop: 1, pacholek: 2, zbrojny: 1, halabardnik: 2, plytowy: 3, rycerz: 3, kupiec: 1, rozbojnik: 1, dezerter: 2, herszt: 1, zywy_trup: 1, szkielet: 4, kosciany_wojownik: 4, kosciany_straznik: 4, rycerz_grobu: 4, ghul: 5, ghul_cmentarny: 5, straznik_krypty: 5, lowca: 1, nekromanta: 1 };
