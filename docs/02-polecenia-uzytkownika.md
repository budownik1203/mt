# Polecenia właściciela

Wszystkie ważne polecenia, po kolei, możliwie dosłownie (pisane głosem, stąd styl). Nowe dopisuj na końcu z datą. To, co tu jest, obowiązuje, dopóki właściciel tego nie zmieni.

## 2026-10-31: start projektu
1. „Okej, to jest próbna wersja. Robimy Montablate'a, wersji 2.0 tak naprawdę. I chciałem, żebyś go zrobił. **Wszystko będziesz robił ty i tylko ty.** Jeżeli masz do tego jakieś pytania, to dawaj mi w formie interaktywnych pytań na początek… z 50–100 pytań.”
2. Ankieta startowa (najważniejsze): pełne 3D w stylu Mount & Blade, grimdark fantasy, PC/Steam później, średni PC, polski + angielski. Technologię wybiera Claude („sam zdecyduj co lepsze”). Nowe repo **budownik1203/mt**. Buildy nazywane **„mb2 build N”**, dostarczane jako link + repo, ze **szczegółowymi changelogami** i **testami automatycznymi**. Tryb mieszany: pytaj o duże decyzje, resztę rób sam. Priorytety: walka i grafika.
3. „Na początek upraszczamy, etapowo robimy każdą rzecz po kolei. Najpierw **modele i grafika**: podstawowy model człowieka, **stylizowane low-poly w stylu PS1, PS2**. Zrób parę renderów i dopasujemy poziom.”
4. Pokazać hełmy, zbroje, kolczugi, przeszywanice i wyposażenie na późnym PS1, PS2 i mieszance PS1+PS2.
5. „Zbroje płytowe, kolczuga z refleksami dla metalu… z detalami, tak jakby to celowo miało tak wyglądać.”
6. Zaproponować więcej stylów low-poly z opisem, skąd pochodzą.
7. Dopracować modele: **chwytanie broni, animacja walki, bez przenikania modeli i tekstur** (np. hełmy garnczkowe), przedmioty mają wyglądać jak prawdziwe. Polecić najlepszy styl.
8. Wymieszać hybrydę z płaskimi fasetami → wybór: **„hybryda fasetowa” to standard gry.**
9. „Animacje walki i sama walka **kompletnie kopiuj-wklej jak w Mount & Blade Warband**: od dołu pchnięcie, góra, lewo, prawo… dla kategorii (jednoręczna, dwuręczna, drzewcowa) osobne animacje”, a bronie w kategorii różnią się tylko modelem.
10. Przeanalizować animacje ataku i obrony w Warbandzie i poprawić nasze. „Zamach powinien wykorzystywać całą rękę… wyciągnięcie ręki… ręka nie może przechodzić przez ciało.”
11. Obejrzeć filmy z Warbanda (linki YouTube), potem właściciel wrzucił **własne nagrania z Warbanda** (broń drzewcowa): „sprawdź czego brakuje i co poprawić”, „pracuj nad animacjami, by wyglądały naturalnie jak w Warbandzie”, „dopracuj wszystkie animacje, by wyglądały jak docelowe”.
12. „Dobra, to teraz zrobimy **build 1: walka**.”
13. „Trochę **wolniej**. Trzeba umieć **rozcinać modele**: po pierwsze, gdzie trafisz, takie obrażenie zadajesz (**głowa, nogi, tors**). Po drugie, **odcinanie kończyn i głów**. **Krew ma być gore.**” Poprawić **chodzenie i atak w trakcie chodzenia**.

## 2026-10-31 / 11-01: dopracowanie walki
14. „Opcja kierowania, gdzie uderzymy: jak w Mount & Blade **przesunę mysz góra/dół, postać się uchyla**, mam kontrolę, czy uderzę w głowę czy brzuch.” **Różne prędkości** chodu do przodu, w bok i do tyłu. **Cooldown na ataki po sparowaniu**, żeby sparowanie dawało ripostę. Bardziej szczegółowe modele.
15. „Zrób, żeby wszystko wyglądało bardziej w stylu **grimdarkowym**.”
16. „**Bardziej fizyczne jebnięcia**, animacje ociężałe, fizyczne, żeby czuć, że faktycznie ręką machamy.”
17. „Przeszukaj informacje o **World of Vasnar** (mod do Warbanda): w takiej stylistyce robimy Montablate'a: mocny nacisk na **nekromancję, potwory, kulty pogańskie**, nie high fantasy, tylko **low, dark, grimdark fantasy**. Musimy zaprojektować całą grę.”
18. Projektowanie: „rundy pytań na **oddzielnej stronce**, skompletowane nawet 300 pytań, ale **po 15–30 z danego obszaru**.” Kierunek: „**gotyk łamany na późne średniowiecze**.”
19. Odpowiedzi na turę 1 (300 pytań) i turę 2 (200 pytań o mechanikach): `design/odpowiedzi-tura1.txt`, `design/odpowiedzi-tura2.txt`; streszczenie w `03-dokument-projektu.md`.
20. „**Pracuj i nie czekaj na mnie**.” (powtórzone kilka razy: pracuj autonomicznie, buduj kolejne buildy według planu).

## 2026-11-01
21. „Prędkość przemieszczania się na mapie trzeba zwiększyć, i **jedna minuta to jeden dzień**, tak zrobimy.”
22. „Dawaj **na repo wszystkie rzeczy potrzebne**: ustalenia, moje komendy i polecenia ważne dla stylu, klimatu, mechanik i samej gry, bo będę pracował na innych kontach Claude. Żeby następne AI, następny chat wiedział, co robić i jak robić.” → stąd `CLAUDE.md` i `docs/`.
