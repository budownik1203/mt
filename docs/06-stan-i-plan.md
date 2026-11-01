# Stan prac i plan

Aktualizuj po każdym buildzie. Linki do artefaktów claude.ai są prywatne dla konta właściciela; z innego konta buduj grę lokalnie z repo (`node build.mjs game N`).

## Historia buildów
| Build | Data | Co wniósł | Artefakt |
| --- | --- | --- | --- |
| pracownia (lab) | 2026-10-31 | model człowieka low-poly, style PS1/PS2/mieszane (15 stylów), wyposażenie warstwowe, metale, chwyt broni, wybór standardu „hybryda fasetowa” | pliki `dist/mb2-lab-*.html`, zestawienia `dist/*.png` |
| mb2 build 1 | 2026-10-31 | walka kopia Warbanda (4 kierunki, 3 klasy broni, blok, zwód, AI), fale wrogów, pora dnia; potem: tempo 0,78, strefy trafień, odcinanie głów i kończyn, gore, chód kierunkowy | claude.ai/artifact/V7179gZF2Y1wn4t4NoCsfN |
| mb2 build 2 | 2026-10-31 | pochylenie (głowa/tułów/nogi myszą), prędkości wg kierunku, blokada po sparowaniu i kontra, dokładniejsze modele | claude.ai/artifact/SCQxX3q9JBUQGxsSaELroP |
| mb2 build 3 | 2026-11-01 | grimdark: korekcja barw, światło, mgła, popiół, kruki, zwłoki, pale, szubienice, sztandary, spalone chaty, brud na teksturach | claude.ai/artifact/HndnoWCFYJc4UKG7yA8MuD |
| mb2 build 4 | 2026-11-01 | ciężar ciosów: hit-stop, odrzut, skręt ofiary, krok w cios, antycypacja i dokończenie wg masy broni, wstrząs kamery | claude.ai/artifact/AKNRyiLpugyoD7vb2kmw83 |
| mb2 build 5 | 2026-11-01 | kampania na mapie świata: region (3 miasta, zamek, 10 wsi, rzeka, brody, drogi, biomy, POI), czas, jedzenie/woda/zima/żołd/morale, osady (werbunek, targ, karczma, plotki, awanse, nocleg), bandy AI, spotkania, bitwa z kompanią na terenie z mapy, pobojowiska i wstający umarli, autozapis | claude.ai/artifact/B3DbifjUxgjnKQVsZshqwh |
| mb2 build 6 | 2026-11-01 | 1 min = 1 doba, szybszy ruch na mapie; 9 grup, rozkazy F1–F3 z podmenu, 6 formacji, rozstawienie przed bitwą, rezerwa, morale żołnierza z sąsiadami, ucieczki i powroty, rzeź, okrzyk (X), sztandary, grupy w panelu Kompania, broń pod kółkiem; dokumentacja w repo | (patrz ostatnia wiadomość) |
| mb2 build 7 | 2026-11-01 | wygląd i interfejs jak w Warbandzie (grimdark zostaje): menu główne, okno Opcji, menu w grze (Esc), dolny pasek mapy (Obóz, Kronika, Postać, Ekwipunek, Kompania, Menu), menu osad i spotkań z obrazem miejsca z mapy; mechaniki Warbanda: tworzenie postaci (imię, 5 pochodzeń), atrybuty, 14 umiejętności, biegłości rosnące w walce, poziomy, sława, limit kompanii, ekwipunek bohatera (zbroja, 4 bronie, tarcza), kowal i sprzedaż łupów, łupy przedmiotów, jeńcy (pośrednik okupów, namawianie do służby, ucieczki), chirurgia, szkolenie, tropienie, zwiad, taktyka; 14 wydarzeń w podróży; Tab = wycofanie; pochodnie nocą | (patrz ostatnia wiadomość) |
| mb2 build 8 | 2026-11-01 | nekromancja: modele nieumarłych (szkielety z rdzą i żelazem wg rangi, ghule z pazurami, żywe trupy w łachmanach), drzewka nieumarłych, księga w Spalonej Kaplicy / starzec / zeszyt nekromanty, umiejętność Nekromancja, menu obozu (rytuały, cmentarz, ruiny), zwłoki i kości, zepsucie z progami, łowcy czarownic, wędrowni nekromanci (śmierć rozsypuje ich armię), wskrzeszanie w bitwie (N), strach przed nieumarłymi, spowiedź w Sankt Morwen, bramy zamknięte przy wysokim zepsuciu, 3 nowe wydarzenia | (patrz ostatnia wiadomość) |

Inne strony: rada projektowa (pytania tur 1–2) claude.ai/artifact/J3myU6uMT57Zg2su1kEkFC; dokument projektu (Claude Doc) claude.ai/artifact/LSVQm1s9kszcteorQCNAqK.

## Znane braki (do zrobienia przy okazji)
- Rytuał Licza bez zadania i filakterium (na razie sam rytuał). Brak zszywańców, upiorów, kościanych koni.
- Brak frontów pogody, śladów na mapie, nocnych napadów na obóz.
- Rany trwałe gracza tylko jako wpis w kronice.
- Brak relacji z wsiami, zadań od sołtysów i lordów, turniejów, handlu towarami (Warband: zboże, żelazo, sukno itd.).
- Wrogowie nie używają formacji (zawsze szarża); brak strzelców i jazdy.
- Morale kompanii na mapie jedno (tura 2 chce osobnych grup: żywi, nieumarli, najemnicy, fanatycy).
- Lordowie, frakcje, wojny, zamki: jeszcze nie ma (build 9).
- Kontrakty i lochy: jeszcze nie ma (wydarzenia w podróży: 14 od build 7).

## Plan
1. ~~Build 8: nekromancja~~ (zrobione).
2. **Build 9: frakcje i lordowie** (pierwsze 2–3 frakcje regionu, lordowie z osobowościami, wojny, przejęcia osad przez menu).
3. **Build 10: potwory i kontrakty** (3–4 gatunki, legowiska, śledztwo tekstowe).
4. **Build 11: broń dystansowa** (łuki, kusze, arkebuzy z dymem), strzelcy w grupach, salwy.
5. Dalej: wydarzenia tekstowe (ok. 60), wiara i obrzędy, konie, oblężenia, kolejne regiony i frakcje do 16, pogoda, zmęczenie w walce, rozbijanie tarcz, egzekucje.
