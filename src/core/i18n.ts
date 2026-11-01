export type Lang = "pl" | "en";
export let lang: Lang = "pl";
try { const s = localStorage.getItem("mb2.lang"); if (s === "en" || s === "pl") lang = s; } catch { /* storage blocked */ }
export function setLang(l: Lang) { lang = l; try { localStorage.setItem("mb2.lang", l); } catch { /* ignore */ } }

const D = {
  pl: {
    start: "Próbna bitwa", subtitle: "Pole Wisielców · próbna bitwa",
    wave: "Fala", cleared: "Fala odparta", next: "Następna za", dead: "Padłeś", deadSub: "Wytrwałeś {n} fal. R — powstań jeszcze raz.",
    kills: "Zabici", hp: "Zdrowie",
    cut: "cięte", pierce: "kłute", blunt: "obuchowe",
    head: "głowa", body: "tułów", legs: "nogi",
    youHit: "Trafiasz {who}: {part}, {dmg} ({type} vs {arm})",
    hitYou: "{who} trafia cię: {part}, {dmg} ({type})",
    blocked: "{who} blokuje", youBlocked: "Blokujesz cios", shieldBlock: "Tarcza zatrzymuje cios",
    killed: "{who} pada", friendly: "{a} rani swojego",
    rain: "deszcz", clear: "sucho",
    help: "Pomoc",
    helpText: [
      ["WSAD", "ruch: przód najszybciej, w bok wolniej, w tył najwolniej"], ["Shift", "bieg"], ["Mysz", "rozglądanie i wybór kierunku. Patrząc w górę lub w dół celujesz w głowę albo w nogi (kropka na celowniku pokazuje wysokość)"],
      ["LPM", "cios: kierunek z ostatniego ruchu myszy (góra, lewo, prawo, dół = pchnięcie). Trzymaj, by zatrzymać zamach"],
      ["PPM", "blok w kierunku ruchu myszy. Podczas zamachu = zwód. Udany blok daje chwilę na szybszą kontrę (kropka świeci), a sparowany przeciwnik nie może od razu atakować"],
      ["1–9", "broń: miecz, kord, topór, buzdygan (z tarczą), miecz i topór dwuręczny, włócznia, glewia, łuk (kółko: kusza, arkebuz); broń dystansowa: LPM trzymaj = celuj, puść = strzał"], ["B", "automatyczny kierunek bloku"], ["1–9, F1–F3", "w bitwie z kompanią: wybór grup, ruch, formacja, rezerwa; F4 ogień (wedle uznania / wstrzymać / salwami); X okrzyk; N wskrześ poległych (nekromancja)"], ["Kółko", "zmiana broni"],
      ["V", "kamera 1./3. osoba"], ["T", "+1 godzina"], ["H", "podpowiedź bloku"], ["L", "język"], ["F1", "ta pomoc"],
    ],
    hintsOn: "Podpowiedź bloku: wł.", hintsOff: "Podpowiedź bloku: wył.", autoOn: "Automatyczny blok: wł.", autoOff: "Automatyczny blok: ręczny (mysz)", parried: "{who} paruje cios", chamber: "",
    you: "ty",
  },
  en: {
    start: "Trial battle", subtitle: "Gallows Field · trial battle",
    wave: "Wave", cleared: "Wave repelled", next: "Next in", dead: "You fell", deadSub: "You lasted {n} waves. R to rise again.",
    kills: "Kills", hp: "Health",
    cut: "cut", pierce: "pierce", blunt: "blunt",
    head: "head", body: "torso", legs: "legs",
    youHit: "You hit {who}: {part}, {dmg} ({type} vs {arm})",
    hitYou: "{who} hits you: {part}, {dmg} ({type})",
    blocked: "{who} blocks", youBlocked: "You block", shieldBlock: "Shield stops the blow",
    killed: "{who} falls", friendly: "{a} wounds an ally",
    rain: "rain", clear: "dry",
    help: "Help",
    helpText: [
      ["WASD", "move: forward fastest, sideways slower, backwards slowest"], ["Shift", "run"], ["Mouse", "look and choose direction. Look up or down to aim at the head or the legs (the dot shows the height)"],
      ["LMB", "strike: direction from your last mouse movement (up, left, right, down = thrust). Hold to keep the swing ready"],
      ["RMB", "block toward mouse movement. During a windup = feint. A good block opens a short window for a faster riposte (dot glows); a parried foe cannot swing straight away"],
      ["1–9", "weapon: sword, kord, axe, mace (with shield), longsword, great axe, spear, glaive, bow (wheel: crossbow, arquebus); ranged: hold LMB = aim, release = shoot"], ["B", "automatic block direction"], ["1–9, F1–F3", "with your company: groups, movement, formation, reserve; F4 fire (at will / hold / volleys); X war cry; N raise the fallen (necromancy)"], ["Wheel", "switch weapon"],
      ["V", "1st/3rd person"], ["T", "+1 hour"], ["H", "block hint"], ["L", "language"], ["F1", "this help"],
    ],
    hintsOn: "Block hint: on", hintsOff: "Block hint: off", autoOn: "Auto block: on", autoOff: "Auto block: manual (mouse)", parried: "{who} parries", chamber: "",
    you: "you",
  },
};

export function t(key: keyof typeof D.pl, vars: Record<string, string | number> = {}): string {
  let s = D[lang][key] as string;
  for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}
export function helpRows(): string[][] { return D[lang].helpText; }
