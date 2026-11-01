# Wizja i styl

## Czym jest gra
Montablate 2.0 (nazwa robocza) to przebudowa projektu **Sztandary Popiołu** (repo `budownik1203/sp`, inne konto) jako pełna gra 3D w stylu **Mount & Blade: Warband**: mapa świata z oddziałami, walka wręcz kierunkowa sterowana myszą, armia, handel, frakcje, osady. Docelowo PC na Steam (Tauri/Electron), stale grywalne demo w przeglądarce, polski i angielski.

Sandbox: rolę wybierasz grając (najemnik, łowca, lord, kapłan, kultysta, nekromanta, wampir). Ciemna strona to pełna ścieżka kariery z własnymi frakcjami i zakończeniami. Gracz nie jest wybrańcem.

## Klimat
- **Low / dark / grimdark fantasy** wzorowana na modzie **World of Vasnar** do Warbanda (gotyk, nekromancja, wampiry, demony, inkwizycja), z mocnym naciskiem na **nekromancję, potwory i pogańskie kulty**. Nie klasyczne high fantasy: bez elfów, krasnoludów i orków w zwykłej formie (są „stare ludy” i odmieńcy po naszemu), bez latających potworów, jeden legendarny smok (może martwy).
- Epoka: **gotyk z późnym średniowieczem**, bez sztywnej daty; każda frakcja w swoim momencie (miasta i najemnicy ok. 1520 z arkebuzami i landsknechtami, prowincja i zakony ok. 1450, poganie bliżej 1300).
- Kultura: niemieckie miasta, słowiańska prowincja, pogańska północ (panteon wzorowany na słowiańskim i bałtyckim). Każda frakcja ma własny język nazw.
- Ton: brutalnie i ponuro, ale ludzkie odruchy istnieją i coś znaczą. Czarny, cyniczny humor żołnierzy i chłopów. Teksty krótkie, dosadne, współczesny polski z naleciałościami. Kalendarz: **Rok Popiołu 37**.
- Inspiracje (wszystkie, najsilniej pierwsza grupa): Warhammer Fantasy (Imperium, Sylvania) + Berserk; Vasnar + Bloodborne + Innistrad; Wiedźmin (książki) + słowiańskie podania; Darkest Dungeon + Pathologic + Blasphemous + Battle Brothers.

## Granice treści
Dużo przemocy: wnętrzności, egzekucje, tortury w scenach, odcinanie kończyn i głów, gore. **Nie robimy** przemocy seksualnej ani krzywdy dzieci (najwyżej ogólny fakt świata poza kadrem). To ustalenie twórcy (Claude'a), przyjęte w dokumencie projektu.

## Styl graficzny (standard: „hybryda fasetowa”)
- Low-poly stylizowane na **PS1/PS2**: tekstury malowane w kodzie (atlas 256 px, downsample ×2), ostre piksele, dithering, rozdzielczość wewnętrzna 360 linii, **światło liczone na każdy trójkąt** (fasety). W kodzie: `LEVELS.hfa`, shader 8 w `src/char/psx.ts`.
- Metal: kolczuga z kafelkową teksturą ogniw i refleksami, płyty z pasem odbicia horyzontu, malowany detal.
- Postacie z warstw wyposażenia (przeszywanica → kolczuga → wappenrock → płyty), bez przenikania; rigid-part rig.
- **Grimdark** (build 3): korekcja barw post 3 (wyprane kolory, krew i ogień zachowują czerwień, zimne cienie, ziemiste światło, ziarno, winieta), pochmurne światło dnia, krwawy zmierzch, ciemna noc, mgła od 12 m, opadający popiół, kruki, zwłoki i pale z głowami, szubienice, spalone chaty, brud i zaschnięta krew na teksturach.
- Mapa świata w tym samym stylu fasetowym, jaśniejsza do czytania. Interfejs: **pergamin i żelazo**, fonty IM Fell English SC + Alegreya Sans.
- Więcej postaci w bitwie ważniejsze niż więcej detalu na postaci; ma działać też na słabych laptopach (suwak liczebności).
- Magia: efektowna, ale w palecie świata (zielonkawy ogień, czarny dym, popiół, wstające ciała), bez kolorowych kul energii.
- Dźwięk: mięsiste, ciężkie odgłosy walki; muzyka średniowieczna i dark folk; okrzyki zamiast dubbingu.

## Interfejs (build 17)
- Okna i menu: ciemne „żelazo i pergamin” (tło #16130f → #1d1913, ramka #5b4a33 z drugą obwódką #3a3127, złote narożniki #c8a25e), tytuł okna fontem IM Fell English SC z linią do prawej, treść Alegreya Sans.
- Układ jak w Warbandzie: menu główne z ramką przycisków po prawej; na mapie górny pasek z polami (mała etykieta + liczba), dolny pasek przycisków z klawiszem pod nazwą; okno osady: obraz miejsca u góry, opis po lewej, akcje po prawej (każda akcja: nazwa + drobny opis kosztu/czasu/przyczyny blokady).
- Bitwa: zdrowie (i koń) w lewym dolnym rogu na tle, broń w prawym dolnym, rozkazy w lewym górnym, dziennik w prawym górnym, zegar u góry na środku.
