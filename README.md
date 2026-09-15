# DAG Studio: devgui

Developerska wydmuszka Vue 3 + Vite, przepisana z brancha `wydmuszka`.
Wszystkie komponenty i wspólny stan używają **Options API**: `data`, `computed`,
`methods`, `watch`, `mounted` i `beforeUnmount`. Bez `setup` i Composition API.
`App.vue` przejmuje opcje z `src/store.js` przez `extends` i udostępnia swoją
instancję przez `provide`. Widoki używają `inject`, więc współdzielą jeden stan.
`src/model.js` pozostaje zestawem zwykłych funkcji operujących na danych.

To nie produkcja. Bez backendu, bazy, GitHub Actions i GitHub Pages.

## Start

Docker z Compose **2.22+** i obsługą Dockerfile heredoc przez BuildKit.
Na Windows: Docker Desktop w trybie kontenerów Linux. Na Fedorze: Docker Engine
z pluginem Compose. Node i npm na hoście nie są potrzebne.

```sh
git switch devgui
docker compose up --build --watch
```

Adres: **http://localhost:5173**. Compose synchronizuje `src/` i `index.html`.
Zmiany pozostałych plików z kontekstu buildu przebudowują obraz, również zmiany
`package-lock.json`, gdy zostanie dodany. Pliki z `.dockerignore` są pomijane.
Nie montujemy katalogu hosta ani jego `node_modules`: zależności Windows
nie trafiają do Linuxa i nie potrzeba etykiet SELinux dla bind mountów.

`DEVGUI_PORT` zmienia port hosta. `DEVGUI_BIND` domyślnie wynosi `127.0.0.1`.
`VITE_USE_POLLING=true` w lokalnym `.env` włącza odpytywanie zmian plików.
Po zmianie portu, adresu lub zmiennych w `.env` uruchom Compose ponownie.
Nie wystawiaj Vite do Internetu. `DEVGUI_BIND=0.0.0.0` udostępnia GUI w sieci,
ale nadal bez uwierzytelniania. Żadnych sekretów w zmiennych `VITE_*`.

Bez śledzenia zmian:

```sh
docker compose up -d --build --wait
docker compose logs -f gui
docker compose down
```

## Dockerfile i Compose

**Dockerfile** zawiera instalację zależności, testy, build, skrypt sprawdzający
`dist/index.html` i wskazane pliki JS/CSS, skrypt sprawdzający HTTP oraz komendę
startową Vite. Kod skryptów jest wpisany bezpośrednio w Dockerfile przez heredoc;
nie ma katalogu `scripts/`. Nieudane testy lub build przerywają budowanie obrazu.
Kontener działa jako użytkownik `node` i serwuje **Vite dev**, nie zawartość `dist`.

**compose.yaml** zawiera tylko konfigurację usługi: obraz, build, port,
zmienną środowiskową, synchronizowanie plików i limit logów: 3 × 10 MB.
Nie ma w nim skryptów, `command`, `entrypoint` ani powtórzonego healthchecka.

```sh
docker compose exec gui npm test
docker compose build
```

Bez Dockera: Node `^22.18.0 || >=24.12.0`, `npm install`, `npm run check`,
`npm run dev`. Samo `npm run build` kompiluje Vue przez Vite; dodatkową kontrolę
plików wynikowych uruchamia Dockerfile. Wersje bezpośrednich zależności są przypięte.
Lockfile nadal nie ma: zależności pośrednie rozwiązuje npm. Dockerfile wybierze
`npm ci`, gdy do repo trafi wygenerowany `package-lock.json`.

## Zakres wydmuszki

Stan zostaje w RAM. Odświeżenie strony usuwa zmiany. Zachowane są: pulpit,
workflowy, przeciąganie tasków, porty, odrzucanie cykli i niezgodnych typów,
usuwanie, cofanie i ponawianie zmian, przesuwanie i skalowanie DAG-a,
mikroedytor, oddzielny edytor plików z konfliktami, zależności zasób → procesy
oraz proces → zasoby, role, projekty i wybór venvów. Kopia workflow dostaje
osobną kopię własnego venva.

Dane początkowe pochodzą z przykładów `wydmuszka`. Historia startuje pusta.
Uruchomienia wykonują taski według połączeń, pokazują ponowienia i mierzą czas
symulacji. Python i SQL nie są wykonywane; harmonogramy, limit czasu i venvy
pozostają ustawieniami GUI. Role nie chronią danych. Pliki są obiektami w pamięci,
bez połączenia z dyskiem i zewnętrznym IDE. Nie używamy localStorage.
Skan rozpoznaje stałe nazwy w `db.read/write/update`, `read_csv`, `write_file`.
Edytor rozpoznaje proste bloki `@task` + `def`, nie dowolny kod Python.
Nieznany format nie nadpisuje DAG-a.

## TeamCity

`.teamcity/devgui.recipe.yaml` jest prywatnym YAML recipe. Wgraj go przez
**Project Settings → Recipes → Upload private recipe** i dodaj jako krok.
Ustaw checkout `devgui`, katalog roboczy w katalogu repo, agenta Linux z Dockerem
i Compose oraz najwyżej **1 build naraz**. Starszy TeamCity: skopiuj zawartość
bloku `script` do kroku Command Line. Nie dodajemy GitHub Actions.

Recipe zawiera wyłącznie polecenia agenta: budowanie obrazu, uruchomienie
Compose z oczekiwaniem na healthcheck i sprzątanie. Aplikacja zostaje uruchomiona;
kolejny build zastępuje ten sam kontener. `docker image prune` działa także po
błędzie, tylko dla nieotagowanych obrazów z etykietą `pl.dag.component=devgui`.
Nie usuwa cudzych obrazów, wolumenów ani cache BuildKit. Błąd sprzątania nie
zasłania wyniku budowania lub uruchamiania.

Te polecenia działają na agencie, nie podczas budowania lub startu GUI.
Nie przekazujemy kontenerowi GUI gniazda Dockera ani uprawnień do sprzątania hosta.

## Weryfikacja tej zmiany

Przeszło **51 testów**: modelu danych, metod Options API, skryptów z Dockerfile
oraz poleceń TeamCity z atrapą Dockera. Sprawdzono składnię JavaScript wszystkich
siedmiu komponentów, YAML i skryptu powłoki. Testy metod nie zastępują uruchomienia
Vue w przeglądarce. Testy kontroli buildu używają jawnych plików testowych,
nie wyniku faktycznego buildu aplikacji.

Build Vite i start kontenera nie zostały potwierdzone: w tej sesji brak Dockera,
a instalację npm blokuje DNS (`EAI_AGAIN`). Dockerfile uruchamia testy, build
Vue oraz kontrolę wynikowych plików przy `docker compose build`.

Dokumentacja: [Vue Options API](https://vuejs.org/guide/introduction.html#api-styles),
[Dockerfile](https://docs.docker.com/reference/dockerfile/),
[Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/),
[TeamCity YAML recipes](https://www.jetbrains.com/help/teamcity/recipe-yaml-syntax.html).
