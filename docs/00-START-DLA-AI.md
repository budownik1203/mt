# START: przekazanie projektu następnemu AI

Jesteś kolejnym AI, które przejmuje grę **Montablate 2.0 (mb2)**. Właściciel nie chce niczego tłumaczyć od nowa. Po przeczytaniu tego pliku masz pracować dokładnie tak, jak poprzedni czat: samodzielnie, build za buildem, bez wstępów i bez pytania o rzeczy już ustalone.

## 1. Kim jest właściciel i jak z nim rozmawiać
- Pisze po polsku, krótko, często dyktuje głosem (literówki typu „Wasnar” = Vasnar, „Mountain Blade” = Mount & Blade). Odpowiadaj po polsku.
- Najczęstsze polecenia: **„pracuj i nie czekaj na mnie”**, „działaj z dalszymi buildami”, „aktualizuj repo”. Znaczy to: rób kolejny build z planu (`06-stan-i-plan.md`), testuj, commituj, wypychaj, raportuj, i od razu bierz następny.
- Nie zadawaj pytań, chyba że decyzja jest duża i nieodwracalna. Rozstrzygaj sam, zapisz decyzję w `docs/03-dokument-projektu.md` i wspomnij o niej w raporcie.
- Pytania projektowe (gdy naprawdę trzeba): rundami na osobnej stronie (`design/rada.html`), 15–30 pytań, z Twoją propozycją i opcją „Zdecyduj ty”.
- Priorytet od build 9: **jakość i czytelność mechanik jak w Warbandzie**. Każdy przycisk w menu mówi: ile kosztuje, ile trwa, czemu jest zablokowany. Liczby i limity widoczne.

## 2. Gra w jednym akapicie
Grimdarkowa kopia **Mount & Blade: Warband** w przeglądarce (własny silnik WebGL2 w TypeScript, jeden plik HTML). Klimat moda **World of Vasnar**: nekromancja, potwory, pogańskie kulty, gotyk i późne średniowiecze. Mapa kampanii z osadami, frakcjami, lordami, bandami, bestiami; bitwy 3D z walką wręcz kopiującą Warbanda (4 kierunki myszą, blok kierunkowy, zwód, kontra) z ciężkimi ciosami i gore (odcinanie głów i kończyn). Grafika w całości generowana w kodzie, styl „hybryda fasetowa” (low-poly PS1/PS2, grimdarkowa paleta). Czas: **1 minuta = 1 doba**.

## 3. Rytuał każdego buildu (tak robił poprzedni czat)
1. Weź pierwszy niezrobiony punkt z planu w `docs/06-stan-i-plan.md`.
2. Napisz kod (patrz mapa kodu w `docs/05-technika.md`). Trzymaj się istniejących wzorców: logika kampanii w `src/map/*.ts`, menu w `src/map/ui.ts`, bitwa w `src/main.ts`, modele w `src/char/*.ts`.
3. `npx tsc -p .` bez błędów.
4. `node build.mjs game N` → `dist/mb2-build-N.html`.
5. Nowy test `tools/bN.mjs` (Playwright przez `node tools/shot.mjs dist/mb2-build-N.html tools/bN.mjs`, sterowanie przez `window.mb2`), plus regresja: `g4 g6 g7 b6 b7 b8 b9 b10 b11 b12 b13 b14 b15 m2 m3`. Wszystkie muszą kończyć się `errors 0`.
6. Obejrzyj zrzuty z `shots/` (czy modele i menu wyglądają dobrze).
7. Zaktualizuj `docs/06-stan-i-plan.md` (wiersz w historii, braki, plan), `docs/03` (liczby mechanik), `docs/05` (nowe pliki i testy), `docs/02` (nowe polecenia właściciela, dosłownie).
8. Commit po polsku („mb2 build N: …”), **push na `budownik1203/mt` (gałąź master)**.
9. Opublikuj `dist/mb2-build-N.html` jako artefakt (jeśli masz takie narzędzie) i dopisz link w historii buildów.
10. Raport dla właściciela po polsku: co nowego (konkretnie, z liczbami), zrzut ekranu, co dalej. Potem od razu następny build.

## 4. Gdzie co jest
- `CLAUDE.md`: zasady stałe (krótko).
- `docs/01-wizja-i-styl.md`: klimat, styl, granice treści (bez przemocy seksualnej i krzywdy dzieci; tortury, egzekucje, gore tak).
- `docs/02-polecenia-uzytkownika.md`: wszystkie polecenia właściciela po kolei.
- `docs/03-dokument-projektu.md`: ustalenia z 500 pytań + liczby każdej zrobionej mechaniki.
- `docs/04-walka.md`: walka (święta, nie psuj).
- `docs/05-technika.md`: stos, polecenia, mapa `src/`, testy, pułapki.
- `docs/06-stan-i-plan.md`: historia buildów z linkami, znane braki, plan.
- `design/`: pytania i surowe odpowiedzi z rad.
- `dist/`: gotowe buildy (otwierasz plik HTML w przeglądarce i grasz).

## 5. Stan (aktualizuj przy każdym buildzie; ostatnio build 15, 2026-11-01)
Zrobione: walka wręcz (build 1–4), kampania na mapie (5), dowodzenie oddziałem i morale (6), wygląd i mechaniki Warbanda: postać, umiejętności, ekwipunek, jeńcy (7), nekromancja (8), frakcje i lordowie (9), potwory i kontrakty (10), broń dystansowa (11), wiara i obrzędy (12), konie i jazda (13), oblężenia (14), obrona osad i bitwy lordów z udziałem gracza (15).
**Następny: build 16, handel i zadania** (szczegóły w planie `06-stan-i-plan.md`).

## 6. Pułapki
- Odpowiedzi właściciela wklejane z Windows mają CRLF.
- `tick()` w hookach testowych przelicza pozy (strefy trafień z ostatniej klatki).
- W bitwie ze spotkania najpierw jest rozstawienie (spacja zaczyna).
- Nie przepisuj animacji walki bez potrzeby; to najbardziej dopracowana część.
- Artefakty claude.ai: jeden plik, skrypty tylko z CDN z białej listy (gra nie używa żadnych).
