# Montablate 2.0 (mb2): instrukcja dla AI

Czytaj to pierwsze. Ten plik i folder `docs/` to **jedyne źródło prawdy** o projekcie. Właściciel pracuje z różnymi kontami i czatami Claude'a; każdy nowy czat ma z repo wiedzieć, co robić i jak, bez pytania o rzeczy już ustalone.

## Kim jesteś w tym projekcie
- Robisz **całą grę sam**: kod, grafikę (proceduralnie, w kodzie), animacje, projekt, teksty. Właściciel ocenia, decyduje i daje polecenia.
- Język rozmowy i gry: **polski** (gra ma też przełącznik na angielski, klawisz L).
- Tryb pracy: **pracuj samodzielnie i nie czekaj** („pracuj i nie czekaj na mnie”). Pytaj tylko o duże, nieodwracalne decyzje; resztę rozstrzygaj sam, zapisz decyzję w `docs/` i powiedz o niej w podsumowaniu.
- Pytania projektowe zadawaj **rundami na osobnej stronie** (rada projektowa, `design/rada.html`), po 15–30 pytań na obszar, z Twoją propozycją oznaczoną i opcją „Zdecyduj ty”. Odpowiedzi właściciel wkleja jako tekst; zapisz je w `design/odpowiedzi-turaN.txt` i przenieś do `docs/03-dokument-projektu.md`.

## Zanim cokolwiek zmienisz
1. Przeczytaj `docs/README.md` (spis), potem `docs/06-stan-i-plan.md` (co jest zrobione, co dalej, znane braki).
2. Styl i klimat: `docs/01-wizja-i-styl.md`. Polecenia właściciela, dosłownie i po kolei: `docs/02-polecenia-uzytkownika.md`.
3. Ustalenia z 500 pytań i liczby mechanik: `docs/03-dokument-projektu.md`.
4. Walka (święta rzecz, kopia Warbanda): `docs/04-walka.md`. Technika i testy: `docs/05-technika.md`.

## Zasady stałe (nie łam bez wyraźnego polecenia)
- Wygląd całości: **układ, kamera, menu i interfejs jak w Mount & Blade: Warband**, ale paleta i klimat grimdarkowe. Mechaniki bazowe też jak w Warbandzie.
- Styl graficzny: **„hybryda fasetowa”** (shader 8, `LEVELS.hfa`), grimdarkowa korekcja barw (post 3), low-poly w duchu PS1/PS2. Wszystko generowane w kodzie.
- Walka: **kopia Mount & Blade: Warband** (4 kierunki myszą, osobne animacje na klasę broni, blok kierunkowy, zwód, kontra). Ciężkie, fizyczne ciosy, gore z odcinaniem kończyn.
- Ton: low / dark / grimdark fantasy w stylu moda **World of Vasnar** do Warbanda: nekromancja, potwory, pogańskie kulty, gotyk z późnym średniowieczem. Nie klasyczne high fantasy.
- Granica treści: tortury, egzekucje, wnętrzności tak; **przemocy seksualnej i krzywdy dzieci nie robimy** (najwyżej ogólny fakt świata poza kadrem).
- Buildy: nazwa **„mb2 build N”**, plik `dist/mb2-build-N.html` (jeden plik, gra w przeglądarce). Każdy build: działający link + commit w repo + szczegółowy changelog dla właściciela + zrzuty/GIF-y.
- Testy automatyczne przed każdym wydaniem (Playwright, `tools/*.mjs`), zero błędów konsoli.
- Czas na mapie: **1 minuta = 1 doba** przy tempie 1× (decyzja właściciela).

## Po każdej pracy
- Zaktualizuj `docs/06-stan-i-plan.md` (historia buildów, co dalej, braki) i inne pliki `docs/`, jeśli zmieniły się ustalenia.
- Dopisz nowe polecenia właściciela do `docs/02-polecenia-uzytkownika.md`.
- Commit z opisem po polsku. Repo: `budownik1203/mt` na GitHubie (jeśli dostęp nie działa, zostaw commity lokalnie i daj właścicielowi paczkę `git bundle`).

## Budowanie (skrót, szczegóły w docs/05-technika.md)
```
npm i                                  # esbuild, typescript, playwright (lokalnie)
npx tsc -p .                           # typecheck
node build.mjs game N                  # -> dist/mb2-build-N.html
node build.mjs lab N                   # -> dist/mb2-lab-N.html (pracownia modeli)
node tools/shot.mjs dist/mb2-build-N.html tools/m2.mjs   # test w headless Chrome
```
