# Technika

## Stos
- **TypeScript + własny silnik WebGL2**, bez frameworków (w środowisku Claude'a npm/CDN bywały zablokowane, więc wszystko jest własne). Bundel esbuild do **jednego pliku HTML** (`dist/mb2-build-N.html`), który działa w przeglądarce i jako artefakt claude.ai.
- Narzędzia (devDependencies w `package.json`): esbuild 0.28, typescript 6.0, playwright 1.63. W środowisku Claude Code były też globalnie w `/opt/npm-tools/node_modules` (`/opt/npm-tools/node_modules/.bin/tsc -p .`).
- Grafika w całości generowana w kodzie: meshe z loftów/boxów (`TMesh`, `MeshBuilder`), atlasy tekstur malowane piksel po pikselu (`atlas.ts`, `gear.ts`).

## Polecenia
```
npm i
npx tsc -p .                         # typecheck (musi przejść bez błędów)
node build.mjs game N                # dist/mb2-build-N.html (szablon web/index.html, "build 1" w szablonie podmieniane na N)
node build.mjs lab N                 # dist/mb2-lab-N.html (pracownia modeli/stylów, web/lab.html)
node tools/shot.mjs <plik.html> <skrypt.mjs>   # headless Chrome (SwiftShader), zrzuty do shots/, log błędów konsoli
```
Zmienna `CHROME` wskazuje własną przeglądarkę dla Playwrighta.

## Struktura `src/`
| Plik | Rola |
| --- | --- |
| `main.ts` | pętla gry, tryby (`title` / `map` / `battle`), bitwa falami i bitwa ze spotkania, rozstrzyganie ciosów (`resolve`), gore, HUD, światło dnia (`lightAt`), kamera, rozkazy i morale w bitwie, render mapy, autozapis, hooki testowe `window.mb2` |
| `char/psx.ts` | renderer retro: niska rozdzielczość, dithering, style/shadery (8 = hybryda fasetowa), metale, post-proces (3 = grimdark), `upload`/`free` meshy |
| `char/human.ts` | style `LEVELS`, szkielet (`RIG`, stawy), budowa ciała, `solve` (macierze stawów) |
| `char/gear.ts`, `atlas.ts`, `weapons.ts`, `tmesh.ts` | wyposażenie warstwowe, atlasy tekstur, bronie, loftowanie meshy; `grime()` brudzi atlasy |
| `char/anim.ts` | animacje: klucze broni, klasy (OH/TH/PA), `TIMING`, IK, unikanie ciała, chód kierunkowy, pochylenie, reakcja na trafienie, `makeTrack` z masą broni |
| `game/warrior.ts` | wojownik: stany, tempo (`TEMPO`), ruch kierunkowy, hit-stop, odrzut, morale, grupa, sztandar; `WSTATS` broni (zasięg, szybkość, masa, obrażenia) |
| `game/combat.ts` | kierunki, blok, pancerze, wzór obrażeń |
| `game/ai.ts` | AI walki wręcz (dystans, tokeny ataku, czytanie zamachu, blok, kontra) |
| `game/gore.ts` | strefy trafień (kapsuły), mapa odcinania (`SEVER`), latające części (`Gib`) |
| `game/tactics.ts` | grupy, rozkazy, formacje i sloty, promień walki, progi morale |
| `world/terrain.ts`, `props.ts` | teren i dekoracje pola bitwy; `setBattlefield(biome, seed, zima, droga)` dla bitew z mapy, `setClassicField()` dla próbnej bitwy |
| `map/world.ts` | region kampanii: wysokości, biomy, rzeka z brodami, drogi (MST + A*), osady (ręczny układ), punkty POI, A* i koszty ruchu |
| `map/campaign.ts` | reguły kampanii: kalendarz (`HOUR_SECONDS = 2.5` → 1 min = 1 doba), kompania, jedzenie/woda/zima/żołd/morale, AI band, spotkania, autoresolve, pobojowiska i wstający umarli, zapis/odczyt |
| `map/troops.ts` | typy żołnierzy (kit do bitwy, żołd, awans), siła, domyślne grupy |
| `map/mapmesh.ts` | geometria mapy (teren lato/zima, rzeka, drogi, lasy, osady, POI, figurki oddziałów) |
| `map/ui.ts` | HUD mapy i menu (osady, targ, karczma, plotki, awanse, spotkania, po bitwie, kompania) |
| `core/i18n.ts`, `audio.ts`, `math.ts` | teksty PL/EN, dźwięk syntetyzowany, matematyka |
| `core/settings.ts`, `optionsui.ts` | opcje gracza (liczebność bitwy, jakość, przemoc, trudność, blok, czułość, głośność), zapis w przeglądarce, okno Opcje |
| `map/hero.ts` | bohater: atrybuty (Ciało, Refleks, Wiedza, Posłuch), 14 umiejętności z limitem atrybut/3, biegłości, poziomy i doświadczenie, sława, limity kompanii i jeńców, pochodzenia (tworzenie postaci), przedmioty i ceny |
| `map/events.ts` | wydarzenia w podróży (17 scen z wyborami) |
| `map/factions.ts` | frakcje, lordowie (dane i stan), wojny i rozejmy, AI lordów (werbunek, patrol, grabież, oblężenie, bitwy AI–AI), służba gracza (najemnik, wasal), czynsze, przejęcia osad |
| `map/monsters.ts` | bestie i legowiska, AI nocnych napadów, kontrakty, śledztwo (3 kroki), nagrody |
| `char/monster.ts` | modele bestii: wilkołak, utopiec, strzyga (`Kit.undead` = werewolf/drowner/strzyga) |
| `map/necro.ts` | nekromancja: zepsucie i progi, rytuały obozowe, miejsca (kaplica, cmentarz), zbiór zwłok, łowcy, nekromanci, reguły dzienne |
| `char/undead.ts` | modele nieumarłych (szkielet, ghul, żywy trup) na tym samym szkielecie co ludzie; `Kit.undead`, `Kit.tier` |
| `lab.ts` + `web/lab.html` | pracownia modeli (style, zestawy, bronie, pozy, światło) |

## Testy
Skrypty w `tools/` uruchamiane przez `tools/shot.mjs` sterują grą przez `window.mb2` (`start`, `campaign`, `tick`, `mapTick`, `look`, `attack`, `block`, `spawn`, `noAI`, `pause`, `cam`, `killFoes`, `endBattle`…). Najważniejsze:
- `g4.mjs` ścięcie głowy / odcięcie ręki / nogi; `g5.mjs` strefy wg pochylenia + prędkości ruchu; `g6.mjs` blokada po sparowaniu i okno kontry; `g7.mjs` dym-test AI (40 s, zero błędów).
- `m1–m5.mjs` mapa: start, podróż, spotkanie → bitwa → po bitwie, głód, wstający umarli, zima, targ, zapis.
- `b6.mjs` rozstawienie, formacje, rozkazy, morale i ucieczki.
- `b10.mjs` legowiska, nocne napady, kontrakt, śledztwo, osłabiona bestia, nagroda, modele bestii.
- `b9.mjs` symulacja 120 dni świata, okno Frakcje, lord: kontrakt i hołd, grabież wsi, szturm miasta, pojmanie i okup lorda.
- `b8.mjs` nekromancja od księgi po spowiedź, wskrzeszanie (N), rozsypanie armii nekromanty; `b8show.mjs` zbliżenia modeli.
- `b7.mjs` menu główne, opcje, tworzenie postaci, miasto, kowal, postać, ekwipunek, bitwa z ekwipunkiem bohatera, jeńcy, doświadczenie.
- `lab*.mjs`, `gif*.mjs` zrzuty i GIF-y z pracowni.
Przed wydaniem: typecheck, build, co najmniej `g4`, `g6`, `g7`, `m2`, `b6` bez błędów konsoli.

## Pułapki
- `tick()` w hookach przelicza też pozy (`draw([])`), bo strefy trafień liczą się z ostatniej klatki. W bitwie ze spotkania pierwsze jest **rozstawienie** (czas stoi do spacji).
- Odpowiedzi wklejane z Windows mają CRLF (parsując, dziel po `/\r?\n/`).
- Artefakty claude.ai: jeden plik HTML, CDN tylko z białej listy; fonty z Google Fonts.
- `dist/` jest w repo (gotowe buildy do pobrania), `shots/` i `node_modules/` nie.
