export type Lang = "pl" | "en";
export let lang: Lang = "pl";
try { const s = localStorage.getItem("mb2.lang"); if (s === "en" || s === "pl") lang = s; } catch { /* storage blocked */ }
export function setLang(l: Lang) { lang = l; try { localStorage.setItem("mb2.lang", l); } catch { /* ignore */ } }

const D = {
  pl: {
    start: "Kliknij, by stanąć do walki", subtitle: "Pole Wisielców · próbna bitwa",
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
      ["WSAD", "ruch"], ["Shift", "bieg"], ["Mysz", "rozglądanie i wybór kierunku"],
      ["LPM", "cios: kierunek z ostatniego ruchu myszy (góra, lewo, prawo, dół = pchnięcie). Trzymaj, by zatrzymać zamach"],
      ["PPM", "blok w kierunku ruchu myszy. Podczas zamachu = zwód"],
      ["1–4", "broń: miecz z tarczą, topór, buzdygan z tarczą, włócznia"],
      ["V", "kamera 1./3. osoba"], ["T", "+1 godzina"], ["Y", "deszcz"], ["H", "podpowiedź bloku"], ["L", "język"], ["F1", "ta pomoc"],
    ],
    hintsOn: "Podpowiedź bloku: wł.", hintsOff: "Podpowiedź bloku: wył.",
    you: "ty",
  },
  en: {
    start: "Click to take the field", subtitle: "Gallows Field · trial battle",
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
      ["WASD", "move"], ["Shift", "run"], ["Mouse", "look and choose direction"],
      ["LMB", "strike: direction from your last mouse movement (up, left, right, down = thrust). Hold to keep the swing ready"],
      ["RMB", "block toward mouse movement. During a windup = feint"],
      ["1–4", "weapon: sword and shield, axe, mace and shield, spear"],
      ["V", "1st/3rd person"], ["T", "+1 hour"], ["Y", "rain"], ["H", "block hint"], ["L", "language"], ["F1", "this help"],
    ],
    hintsOn: "Block hint: on", hintsOff: "Block hint: off",
    you: "you",
  },
};

export function t(key: keyof typeof D.pl, vars: Record<string, string | number> = {}): string {
  let s = D[lang][key] as string;
  for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}
export function helpRows(): string[][] { return D[lang].helpText; }
