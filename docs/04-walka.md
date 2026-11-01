# Walka wręcz: specyfikacja

Zasada nadrzędna: **kopia Mount & Blade: Warband**, z ciężarem i gore ponad oryginał. Wzorce: nagrania właściciela z Warbanda (broń drzewcowa) i filmy YouTube; porównania w `dist/mb2-warband-wzorzec.png`.

## Sterowanie
- Kierunek ciosu z ostatniego ruchu myszy: **góra (z góry), lewo, prawo, dół = pchnięcie**. LPM trzymany = zamach trzymany (hold), puszczenie = cios.
- PPM: blok w kierunku myszy; PPM w trakcie zamachu = **zwód** (przejście w blok). B: automatyczny kierunek bloku (dla początkujących). H: podpowiedź kierunku nadchodzącego ciosu.
- **Pochylenie (build 2):** patrzenie w górę/dół pochyla tułów i ugina kolana; decyduje, czy cios boczny trafi w głowę, tułów czy nogi. Kropka na celowniku pokazuje wysokość.
- Ruch: przód 3,2 m/s (bieg 5,4), bok 2,4 (2,6), tył 1,85 (2,0); bieg pomaga głównie do przodu.
- Kółko myszy: zmiana broni. Kamera 1./3. osoby (V).

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
