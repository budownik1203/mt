# Walka wręcz: specyfikacja

Zasada nadrzędna: **kopia Mount & Blade: Warband**, z ciężarem i gore ponad oryginał. Wzorce: nagrania właściciela z Warbanda (broń drzewcowa) i filmy YouTube; porównania w `dist/mb2-warband-wzorzec.png`.

## Sterowanie
- Kierunek ciosu z ostatniego ruchu myszy: **góra (z góry), lewo, prawo, dół = pchnięcie**. LPM trzymany = zamach trzymany (hold), puszczenie = cios.
- PPM: blok w kierunku myszy; PPM w trakcie zamachu = **zwód** (przejście w blok). B: automatyczny kierunek bloku (dla początkujących). H: podpowiedź kierunku nadchodzącego ciosu.
- **Pochylenie (build 2):** patrzenie w górę/dół pochyla tułów i ugina kolana; decyduje, czy cios boczny trafi w głowę, tułów czy nogi. Kropka na celowniku pokazuje wysokość.
- Ruch: przód 3,2 m/s (bieg 5,4), bok 2,4 (2,6), tył 1,85 (2,0); bieg pomaga głównie do przodu.
- Kółko myszy: zmiana broni (w kampanii: sloty 1–4 bohatera). Kamera 1./3. osoby (V). **Tab: wycofanie się z bitwy** (tylko gdy wróg nie stoi bliżej niż 14 m; liczone jak przegrana). Nocą bez ogniska walczy się przy świetle pochodni wokół gracza.
- Bohater w kampanii: obrażenia × (1 + 8% za Siłę ciosu) × (0,85 + biegłość/600); biegłość klasy broni rośnie z każdym trafieniem; zdrowie = 90 + 3×Ciało + 4×Twarde ciało; Atletyka przyspiesza bieg. Obrażenia otrzymywane wg opcji (60% / 100% / 130%). Opcja „Przemoc: mniej” wyłącza odcinanie.

## Animacje
- Jedna paczka animacji na klasę broni: **jednoręczna (OH), dwuręczna (TH), drzewcowa (PA, osobno włócznia)**; bronie w klasie różnią się tylko modelem i statystykami.
- Klucze broni WK {g: pięść, d: kierunek broni, e: krawędź, ty/tp: skręt/pochylenie tułowia, oh: chwyt drugiej ręki}, interpolacja Hermite'a, IK dwukościstowe z omijaniem tułowia, przesuwany chwyt drugiej ręki, prowadzenie tułowiem (biodra i barki ruszają przed ręką).
- Zamach używa całej ręki (wyprost), broń nie przechodzi przez ciało (avoidKey).
- Tempo: TIMING {ready .35, hold .3, release .2, cont .28, recover .32, parried .32, blockIn .12} × TEMPO 0.78 (spowolnienie z build 1).
- **Ciężar (build 4):** antycypacja (tułów skręca się mocniej niż poza zamachu i wraca), cios rusza wolno i przyspiesza na celu, dokończenie z rozpędem i dłuższy powrót; wszystko skalowane masą broni (kord 0,9 … topór dwuręczny 1,6). Krok w cios (pchnięcie dłuższy). Chód kierunkowy, atak w trakcie chodu nakłada się na kroki.

## Trafienie
- Strefa trafienia z faktycznej pozycji ostrza: punkt ostrza najbliższy osi celu → kapsuły ciała (głowa, tułów, ręka, nogi). Ręce liczą się, gdy faktycznie są na drodze.
- Pancerz per strefa (ARMOURS: rags, gambeson, mail, plate), typy: cięte, kłute, obuchowe.
- **Hit-stop**: obie postacie zamierają ok. 0,09–0,16 s (dłużej przy ciężkiej broni); przy bloku krótsze szarpnięcie i odrzut ręki atakującego. Ofiara: odrzut w kierunku ciosu, skręt tułowia na sprężynie. Wstrząs kamery.
- Blok kierunkowy (mirror kierunku), tarcza zasłania przód. **Sparowany** atakujący: odbicie + blokada ataku 0,32 s (tarcza 0,2 s), może blokować; **obrońca** dostaje 0,9 s okna kontry z zamachem o 30% szybszym (kropka świeci). Po przyjęciu ciosu blokada 0,25 s.

## Gore
- Odcinanie: **głowa** przy śmiertelnym cięciu w głowę; **ręka** (cała/przedramię) przy śmiertelnym albo ≥30 obrażeń; **noga** (udo/goleń) przy śmiertelnym albo ≥34. Odcięta część leci jako bryła sztywna (Gib), odbija się i zostaje; kikut z pulsującą krwią przez kilka sekund.
- Krew: strugi, kałuże rosnące w czasie, plamy na ziemi, czerwony brzeg ekranu przy trafieniu gracza. Zwłoki z kikutami zostają na polu.
- W bitwach kampanii: **obuch rani, ostrze zabija, odcięcie zawsze zabija** (przeliczane na straty oddziału).

## Bitwa z oddziałem (build 6)
- 9 grup; domyślnie 1 piechota (chłopi, zbrojni), 2 drzewcowi (pachołkowie, halabardnicy), 3 ciężcy (płytowi, rycerze); zmiana w panelu Kompania.
- Klawisze: 1–9 wybór grupy (Shift dodaje), 0 wszystkie; **F1 ruch** → F1 stać tutaj, F2 za mną, F3 naprzód, F4 cofnąć się; **F2 formacja** → F1 linia, F2 kolumna, F3 klin, F4 mur tarcz, F5 jeż, F6 rozproszona; **F3 rezerwa rusza**; X okrzyk bojowy (co 25 s).
- **Rozstawienie** przed bitwą: widok z góry, klik ustawia wybrane grupy, F2 formacja, R rezerwa, spacja zaczyna.
- Morale żołnierza 0–100: przewaga wroga obok obniża, dowódca (gracz, herszt) i sztandar w pobliżu podnoszą, śmierć sąsiada −7, rzeź (odcięcia) −16, upadek sztandaru −14 dla wszystkich. Poniżej 15 ucieka, powyżej 38 wraca do szyku (przy dowódcy szybciej). Nieumarli nie mają morale. Uciekający na skraj pola znikają (przeżywają, nie giną).
- Do 18 walczących na stronę naraz, reszta jako posiłki.

## Broń dystansowa (build 11)
- Łuk (46 m/s, 30 obr., 24 strzały, naciąg 0,75 s, ładowanie 0,55 s), kusza (60 m/s, 44 obr., pancerz × 0,75, 16 bełtów, ładowanie 3,2 s), arkebuz (140 m/s, 62 obr., pancerz × 0,45, 12 kul, ładowanie 5,5 s, dym i huk). Czasy skracane umiejętnością.
- Gracz: LPM trzymany = naciąg/celowanie, puszczenie = strzał (tylko z pełnego naciągu); celownik to promień kamery (do pierwszego ciała lub ziemi) z poprawką na opad; ruch i za długo trzymany łuk (> 2,5 s) zwiększają rozrzut. Podczas celowania ruch × 0,45, przy ładowaniu kuszy/arkebuzu × 0,3.
- Trafienie wg wysokości: głowa > 1,52 m, nogi < 0,88 m, reszta tułów. Obrażenia kłute przez pancerz strefy × współczynnik broni, × prędkość pocisku. Tarcza zwrócona do pocisku łapie go (zawsze przy bloku, 70% gdy tylko niesiona przodem).
- Strzelcy AI trzymają dystans (cofają się poniżej 8 m), przy wrogu bliżej 4,5 m lub bez amunicji biorą broń boczną; wracają do strzelania, gdy wróg odejdzie dalej niż 13 m. Rozkaz F4: F1 ognia wedle uznania, F2 wstrzymać ogień, F3 salwami (salwa, gdy 80% grupy gotowe albo po 4 s).

## Konie i jazda (build 13)
- Konie: szkapa (80 zdrowia, 31 km/h, pancerz 4, 120 gr), koń wierzchowy (115, 37 km/h, 8, 320 gr), rumak bojowy w kropierzu (170, 35 km/h, 22, 760 gr, wymaga Jazdy 2). Jazda konna: +4% prędkości i zwrotności na poziom.
- Sterowanie: W/A/S/D wskazują kierunek względem kamery, koń skręca w tę stronę z ograniczoną zwrotnością (wolniej w galopie), Shift = galop. Przyspieszenie 3,2 m/s², hamowanie 6,5 m/s². Jeździec może patrzeć i ciąć do ±63° od osi konia.
- Ciosy z siodła dostają premię z prędkości (jak w Warbandzie, do +50%). Kopia: przy prędkości > 6,2 m/s i spokojnych rękach kładzie się sama; trafia wroga do 3,3 m przed koniem za 26 + 6,5 × prędkość obrażeń kłutych, potem 1,8 s przerwy. Koń w biegu > 4,5 m/s taranuje pieszych (3 + 1,3 × prędkość, przewrócenie), sam zwalnia.
- Ciosy pieszego w konnego: niskie (nogi) i 22% pozostałych trafiają konia (pancerz konia). Pociski poniżej 1,5 m trafiają konia. Koń pada → jeździec spada (6–16 obrażeń, zachwianie), kopijnik bierze broń boczną.
- AI jazdy: szarża przez cel z przesunięciem na stronę miecza, cios w przejeździe, 1,6–2,4 s jazdy dalej, nawrót.

## Oblężenia (build 14)
- Mur w poprzek pola na z = −10: chodnik 3,4 m nad ziemią (od −1,5 do +1,2 m wokół linii muru), lico z kolizjami (nikt nie przechodzi przez mur), brama 4,6 m (420 punktów, cios obuchem ×1,2, ostrzem ×0,7), drabiny na x = ±13 (rampa 4,4 m), schody od środka na x = ±24. Wysokość chodzenia: `siegeLift(x, z)` dodawane do terenu.
- Atakujący przed murem idą do najbliższego wejścia (brama ma karę 6 m, póki stoi), na drabinie zawsze wspinają się dalej, pod bramą rąbią. Obrońcy na murze nie schodzą, póki wróg jest pod murem (pilnują chodnika wzdłuż x). Wyłom w bramie: −14 morale obrońców w promieniu 30 m.
