// Travel events (Battle Brothers style): a short scene, 2–4 choices, consequences.
// Shown on the map while the company is on the move, roughly once a week.
import type { Campaign } from "./campaign.ts";
import type { WeaponId } from "../char/weapons.ts";
import { biomeAt } from "./world.ts";
import { learnNecromancy, corrupt, undeadCount, livingCount } from "./necro.ts";

export interface EvChoice { label: string; sub?: string; ok?: (c: Campaign) => boolean; run: (c: Campaign) => string }
export interface TravelEvent { id: string; title: string; text: string; when?: (c: Campaign) => boolean; choices: EvChoice[] }

const food = (c: Campaign, n: number) => { let left = n; for (const f of c.co.food) { const k = Math.min(f.n, left); f.n -= k; left -= k; } c.co.food = c.co.food.filter((f) => f.n > 0); return n - left; };
const addFood = (c: Campaign, n: number) => { const b = c.co.food.find((f) => f.type === "grain"); if (b) b.n += n; else c.co.food.push({ type: "grain", n, age: 0 }); };
const loot = (c: Campaign, w: WeaponId) => { c.co.stash = c.co.stash ?? []; c.co.stash.push({ kind: "weapon", id: w }); };

export const EVENTS: TravelEvent[] = [
  { id: "nauczyciel", title: "Starzec przy ognisku", text: "Na rozstajach siedzi starzec przy ognisku, które nie daje ciepła. Mówi, że widział, jak walczysz, i że śmierć to tylko drzwi, które da się otworzyć z obu stron. Za sto groszy pokaże ci klucz.", when: (c) => !c.co.hero.necro,
    choices: [
      { label: "Zapłacić i słuchać", sub: "100 gr · nekromancja · zepsucie", ok: (c) => c.co.party.gold >= 100, run: (c) => { c.co.party.gold -= 100; c.passHours(4); learnNecromancy(c, "Starzec z rozstajów nauczył cię słów."); return "Mówi do świtu. Część słów zapominasz, zanim wybrzmią, inne zostają w tobie jak drzazgi. Rano po starcu jest tylko popiół, zimny od dawna."; } },
      { label: "Przegnać go", run: (c) => { c.co.morale += 1; return "Śmieje się, wstaje i odchodzi w ciemność. Ognisko gaśnie razem z nim."; } },
      { label: "Kazać go spalić", sub: "jak każe Inkwizycja", run: (c) => { c.co.morale -= 2; c.co.fear = (c.co.fear ?? 0) + 2; return "Pali się długo i nie krzyczy. Ludzie nie rozmawiają o tym do wieczora."; } },
    ] },
  { id: "strach_trupow", title: "Ludzie nie śpią", text: "Żywi w kompanii nie chcą spać obok tego, co chodzi za wami bez oddechu. Kilku stoi pod twoim namiotem i żąda, żebyś się tego pozbył.", when: (c) => undeadCount(c) >= 4 && livingCount(c) > 0,
    choices: [
      { label: "Obiecać osobny obóz dla martwych", sub: "wolniej, ale spokojniej", run: (c) => { c.co.morale += 4; return "Martwi stoją odtąd sto kroków dalej, w ciemności. Żywi udają, że ich nie widzą."; } },
      { label: "Kazać im milczeć", run: (c) => { c.co.morale -= 6; c.co.fear = (c.co.fear ?? 0) + 1; return "Milkną. Na razie."; } },
    ] },
  { id: "kurhan", title: "Kurhan", text: "Przy drodze stary kurhan z rozwalonym wejściem. Ktoś kopał tu przed wami i uciekł, zostawiając łopatę.", when: (c) => !!c.co.hero.necro,
    choices: [
      { label: "Zabrać kości", sub: "2 h · zepsucie", run: (c) => { c.passHours(2); const n = 5 + Math.floor(c.rand() * 6); c.co.bones = (c.co.bones ?? 0) + n; corrupt(c, 1); return `${n} kości. Jedna czaszka ma w skroni grot strzały starszy niż Cesarstwo.`; } },
      { label: "Zostawić", run: () => "Niech śpią. Na razie." },
    ] },
  { id: "wisielec", title: "Wisielec przy drodze", text: "Na suchym dębie wisi człowiek. Wrony zdążyły już zabrać oczy. Przy pasie ma sakiewkę, a na piersi tabliczkę: ZŁODZIEJ.",
    choices: [
      { label: "Przeszukać trupa", run: (c) => { const g = 5 + Math.floor(c.rand() * 20); c.co.party.gold += g; c.co.morale -= 2; return `${g} groszy. Ludzie patrzą na ciebie krzywo: z wisielca się nie bierze.`; } },
      { label: "Zdjąć go i pochować", sub: "godzina drogi", run: (c) => { c.passHours(1); c.co.morale += 3; return "Płytki grób przy drodze. Ktoś z chłopów odmawia pacierz. Ludzie są ci za to wdzięczni bardziej, niż chcą przyznać."; } },
      { label: "Jechać dalej", run: () => "Nie twój wisielec, nie twoja sprawa." },
    ] },
  { id: "wdowa", title: "Wdowa", text: "Przy rowie siedzi kobieta w podartym płaszczu. Wieś spłonęła, mąż leży gdzieś w polu. Prosi o chleb.",
    choices: [
      { label: "Dać jej jedzenie", sub: "5 porcji", ok: (c) => c.foodTotal >= 5, run: (c) => { food(c, 5); c.co.morale += 2; return "Bierze chleb bez słowa i odchodzi w stronę lasu. Kilku twoich ludzi odprowadza ją wzrokiem."; } },
      { label: "Odpędzić ją", run: (c) => { c.co.morale -= 1; return "Odchodzi, zanim ktoś podniesie rękę. Ktoś z tyłu splunął."; } },
    ] },
  { id: "dezerter", title: "Człowiek w krzakach", text: "Zwiadowcy wywlekają z zarośli wychudzonego żołnierza w podartej przeszywanicy. Uciekł spod chorągwi, mówi, bo nie płacili. Chce do was.",
    choices: [
      { label: "Przyjąć go", run: (c) => { c.addTroops(c.co.party, "dezerter", 1); return "Dezerter staje w szeregu. Będzie walczył, dopóki będziesz płacił."; } },
      { label: "Powiesić dla przykładu", run: (c) => { c.co.morale -= 2; c.co.fear = (c.co.fear ?? 0) + 3; return "Gałąź trzeszczy. Twoi ludzie zrozumieli lekcję. Wieść pójdzie dalej."; } },
      { label: "Puścić wolno", run: () => "Znika w lesie, zanim zdążysz się rozmyślić." },
    ] },
  { id: "kolo", title: "Pęknięte koło", text: "Wóz z zapasami siada w błocie. Oś pękła. Można naprawić, ale to potrwa.",
    choices: [
      { label: "Naprawić", sub: "3 godziny", run: (c) => { c.passHours(3); return "Kołodziej klnie, ale wóz jedzie dalej."; } },
      { label: "Zostawić część ładunku", sub: "tracisz jedzenie", run: (c) => { const n = food(c, 8 + Math.floor(c.rand() * 8)); return `Zostawiacie ${n} porcji w rowie. Ktoś je znajdzie przed zmrokiem.`; } },
    ] },
  { id: "pijatyka", title: "Pijatyka", text: "Wieczorem przy ogniu ktoś odkręca beczułkę. Śpiew, kłótnie, ktoś płacze za matką.", when: (c) => c.co.food.some((f) => f.type === "beer" && f.n >= 5),
    choices: [
      { label: "Niech piją", sub: "5 porcji piwa", run: (c) => { const b = c.co.food.find((f) => f.type === "beer"); if (b) b.n -= 5; c.co.morale += 7; return "Rano bolą głowy, ale kompania śmieje się pierwszy raz od tygodni."; } },
      { label: "Zabrać beczkę", run: (c) => { c.co.morale -= 3; return "Beczka ląduje na wozie. Ktoś mruczy, że dowódca sam ją wypije."; } },
    ] },
  { id: "goraczka", title: "Gorączka", text: "Jeden z ludzi trzęsie się i majaczy. Na skórze ma ciemne plamy. Pozostali odsuwają się od niego.",
    choices: [
      { label: "Zostawić go w najbliższej wsi", sub: "tracisz człowieka", run: (c) => { c.kill(1, "Chory zostaje w tyle"); return "Zostaje z paroma groszami i bukłakiem. Nikt nie wie, czy przeżyje."; } },
      { label: "Leczyć w drodze", sub: "ryzyko zarazy", run: (c) => { if (c.rand() < 0.4) { for (const s of c.co.party.troops) s.wounded = Math.min(s.n, s.wounded + 1); return "Gorączka przechodzi na następnych. Kilku ludzi ledwo trzyma się na nogach."; } return "Po trzech dniach gorączka spada. Miał szczęście. Wy też."; } },
    ] },
  { id: "biczownicy", title: "Biczownicy", text: "Drogą idzie procesja. Plecy pocięte do żywego, śpiew jak zawodzenie. Przewodnik wyciąga do ciebie misę.",
    choices: [
      { label: "Dać jałmużnę", sub: "10 gr", ok: (c) => c.co.party.gold >= 10, run: (c) => { c.co.party.gold -= 10; c.co.morale += 3; return "Błogosławią twój miecz i twoich ludzi. Pobożniejsi z kompanii wyraźnie się prostują."; } },
      { label: "Zejść im z drogi", run: () => "Procesja przechodzi obok. Długo jeszcze słychać bicze." },
    ] },
  { id: "kapliczka", title: "Pogańska kapliczka", text: "Na rozstaju stoi rzeźbiony słup z twarzami na cztery strony. U stóp miski z kaszą, kości, zaschnięta krew. Ktoś niedawno tu był.",
    choices: [
      { label: "Złożyć ofiarę", sub: "5 porcji jedzenia", ok: (c) => c.foodTotal >= 5, run: (c) => { food(c, 5); if (c.rand() < 0.6) { c.co.morale += 5; return "Wiatr cichnie. Ludzie mówią, że stare bogi przyjęły dar. Idzie się lżej."; } return "Nic się nie dzieje. Tylko kruk siada na słupie i patrzy."; } },
      { label: "Obalić bałwana", run: (c) => { c.co.morale -= 3; return "Słup pada w błoto. Część ludzi się żegna, część patrzy z lękiem na las."; } },
      { label: "Minąć", run: () => "Lepiej nie zaczepiać tego, czego się nie rozumie." },
    ] },
  { id: "relikwia", title: "Handlarz relikwiami", text: "Obwoźny handlarz otwiera skrzyneczkę: kość palca świętego Morwena, gwarantowana. Cena: 40 groszy.",
    choices: [
      { label: "Kupić", sub: "40 gr", ok: (c) => c.co.party.gold >= 40, run: (c) => { c.co.party.gold -= 40; c.co.morale += 8; return "Relikwia wędruje do sakwy. Czy to palec świętego, czy kurza kość, ludzie czują się pewniej."; } },
      { label: "Obić oszusta", run: (c) => { const g = 15 + Math.floor(c.rand() * 15); c.co.party.gold += g; c.co.morale -= 2; return `Handlarz ucieka bez skrzynki i bez ${g} groszy.`; } },
      { label: "Odprawić go", run: () => "Handlarz wzrusza ramionami i idzie dalej szukać naiwniejszych." },
    ] },
  { id: "mgla", title: "Mgła na bagnach", text: "Mgła zgęstniała tak, że nie widać ostatniego wozu. Gdzieś z boku coś chlupie w wodzie.", when: (c) => biomeAt(c.w, c.co.party.x, c.co.party.z) === "swamp",
    choices: [
      { label: "Przeczekać", sub: "4 godziny", run: (c) => { c.passHours(4); return "Mgła opada przed świtem. Wszyscy są na miejscu. Prawie wszyscy przyznają, że coś widzieli."; } },
      { label: "Iść dalej", sub: "ryzyko", run: (c) => { if (c.rand() < 0.5) { c.kill(1, "Ktoś zostaje w bagnie"); return "Krzyk, chlupot, cisza. Jednego brakuje. Nikt nie chce wracać, żeby szukać."; } return "Przechodzicie. Za plecami długo jeszcze coś chlupie."; } },
    ] },
  { id: "grabarz", title: "Grabarz", text: "Przy cmentarnym murze stary grabarz zagaduje cicho: ma świeże ciała, nikt ich nie będzie szukał. Pyta, czy kompania nie potrzebuje… materiału.",
    choices: [
      { label: "Odejść bez słowa", run: () => "Grabarz wraca do łopaty, jakby nic nie mówił." },
      { label: "Zapytać, kto kupuje", run: (c) => { c.note("Grabarz z cmentarza wspomniał o kupcach na trupy. Czarny rynek ciał istnieje.", "warn"); return "Mówi o ludziach w kapturach, którzy płacą srebrem i nie pytają o imiona. Zapamiętujesz to."; } },
      { label: "Donieść kapłanom", run: (c) => { c.co.morale += 2; return "Kapłani dziękują. Grabarz zawiśnie przed niedzielą."; } },
    ] },
  { id: "miecz", title: "Znalezisko w rowie", text: "W rowie leży trup sprzed tygodni. Ktoś już zabrał buty, ale pod nim błyszczy jeszcze broń.",
    choices: [
      { label: "Zabrać broń", run: (c) => { const w: WeaponId[] = ["sword", "kord", "hatchet", "mace", "spear"]; const id = w[Math.floor(c.rand() * w.length)]; loot(c, id); return "Broń trafia na wóz. Czyszczenie rdzy zajmie wieczór, ale będzie z niej pożytek."; } },
      { label: "Zostawić", run: () => "Trup zostaje z tym, co mu zostało." },
    ] },
  { id: "wycie", title: "Wycie w pełnię", text: "Księżyc w pełni. Z lasu dochodzi wycie, za długie jak na wilka. Warta prosi o więcej ognia.", when: (c) => c.fullMoon,
    choices: [
      { label: "Podwoić wartę i ogień", sub: "ludzie nie wyśpią się", run: (c) => { c.co.morale -= 2; return "Do rana nic nie podchodzi. Ludzie są zmęczeni, ale żywi."; } },
      { label: "Spać jak zwykle", run: (c) => { if (c.rand() < 0.35) { c.kill(1, "Coś zabrało wartownika"); c.co.morale -= 6; return "Rano jeden posterunek jest pusty. Tylko krew na śniegu i ślady za duże na wilka."; } return "Noc mija. Wycie milknie przed świtem."; } },
    ] },
  { id: "chlopi", title: "Chłopi z widłami", text: "Na drodze stoją chłopi z widłami i cepami. Ich wieś złupili żołnierze. Biorą was za takich samych.",
    choices: [
      { label: "Przekonać ich słowem", run: (c) => { if (c.rand() < 0.6) { c.co.morale += 1; return "Ktoś rozpoznaje twoją chorągiew. Rozchodzą się, mrucząc."; } c.kill(1, "Kamień z tłumu"); return "Leci kamień, potem drugi. Jeden z twoich pada z rozbitą głową, zanim tłum się rozpierzcha."; } },
      { label: "Rozgonić ich", run: (c) => { c.co.fear = (c.co.fear ?? 0) + 2; c.co.morale -= 1; return "Wystarczy, że twoi wyciągną broń. Chłopi uciekają w pola."; } },
      { label: "Dać im zboże", sub: "10 porcji", ok: (c) => c.foodTotal >= 10, run: (c) => { food(c, 10); c.co.morale += 3; addFood(c, 0); return "Patrzą na worki jak na cud. Jeden z nich pyta, czy przyjmujecie ludzi."; } },
    ] },
];

/** Pick an event that fits right now (or nothing). */
export function pickEvent(c: Campaign, seen: Set<string>): TravelEvent | null {
  const pool = EVENTS.filter((e) => (!e.when || e.when(c)) && !seen.has(e.id));
  if (!pool.length) { seen.clear(); return null; }
  return pool[Math.floor(c.rand() * pool.length)];
}
