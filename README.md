# DAG Studio: devgui

Wydmuszka z brancha `wydmuszka`, przepisana na komponenty Vue 3 i Vite.
To środowisko developerskie, nie wdrożenie produkcyjne. Bez GitHub Actions i GitHub Pages.

## Start

Docker z Compose **2.22+**. Na Windows użyj Docker Desktop w trybie kontenerów Linux.
Na Fedorze wystarczy Docker Engine z pluginem Compose. Node na hoście nie jest potrzebny.

```sh
git switch devgui
docker compose up --build --watch
```

Otwórz **http://localhost:5173**. Zmiany w `src/` są kopiowane do kontenera;
Vite odświeża komponenty i CSS. Zmiana `package.json`, Dockerfile lub konfiguracji Vite
przebudowuje obraz. Nie montujemy katalogu hosta ani jego `node_modules`:
nie trzeba ustawiać etykiet SELinux ani mieszać zależności Windows i Linux.

Bez śledzenia zmian, np. na agencie TeamCity:

```sh
docker compose up -d --build --wait
docker compose logs -f gui
docker compose down
```

`DEVGUI_PORT` zmienia port hosta. `DEVGUI_BIND` domyślnie wynosi `127.0.0.1`.
Nie wystawiaj serwera Vite do Internetu. Do testów przez sieć LAN ustaw świadomie
`DEVGUI_BIND=0.0.0.0`; to nadal aplikacja bez uwierzytelniania.
Przy problemach z wykrywaniem zmian ustaw `VITE_USE_POLLING=true` w lokalnym `.env`.
Sekretów nie umieszczaj w `.env` frontendu ani w zmiennych zaczynających się od `VITE_`.

## Co działa w RAM

Pulpit, wyszukiwanie i kopiowanie workflowów, dodawanie i przeciąganie tasków,
łączenie konkretnych portów, sprawdzanie typów i cykli, kasowanie połączeń,
cofanie i ponawianie zmian DAG-a, przesuwanie i skalowanie widoku.
Mikroedytor kodu w tasku, oddzielny edytor plików, wykrywanie konfliktów edycji,
zasób → procesy i proces → zasoby, ustawienia projektu, role i wybór venvów.
Kopia workflow dostaje osobną kopię własnego venva.

Dane początkowe są przykładami zachowanymi z `wydmuszka`, nie prawdziwymi rekordami.
Historia zaczyna się pusta. Symulacja wykonuje taski według połączeń, pokazuje
ponowienia i mierzy rzeczywisty czas symulacji, ale **nie uruchamia Python/SQL**.
Harmonogram, limit czasu i venv są ustawieniami GUI, nie działającym schedulerem,
limitem wykonania ani środowiskiem Python. Role zmieniają dostępność przycisków,
nie stanowią zabezpieczenia. Pliki są obiektami w pamięci, nie plikami hosta.

Skan zależności rozpoznaje stałe nazwy w `db.read`, `db.write`, `db.update`,
`read_csv` i `write_file`. To skan tekstu, nie pełny parser Python/SQL.
Edytor rozpoznaje proste bloki `@task` + `def`; nieznany format nie nadpisuje DAG-a.
Odświeżenie strony usuwa zmiany. Nie używamy localStorage, bazy ani backendu.

## Testy i build

Dockerfile instaluje zależności, uruchamia testy modelu i `vite build`, następnie
sprawdza, czy `dist/index.html` wskazuje istniejące pliki JS/CSS. Błąd zatrzymuje build.
Uruchomiony kontener serwuje jednak **Vite dev**, nie produkcyjny serwer z `dist`.

```sh
docker compose exec gui npm test
docker compose exec gui npm run build
```

Bez Dockera: Node `^22.18.0 || >=24.12.0`, `npm install`, `npm run check`, `npm run dev`.
Bezpośrednie wersje Vue, Vite i pluginu Vue są przypięte w `package.json`.
W tej zmianie nie ma lockfile: zależności pośrednie rozwiązuje npm podczas builda.
Dockerfile użyje `npm ci`, gdy do repo zostanie dodany wygenerowany `package-lock.json`.

Sprawdzono w sesji przygotowania: testy modelu, składnię JS oraz skryptu powłoki.
Nie potwierdzono builda Vite ani działania kontenera: środowisko nie miało Dockera,
a próba pobrania zależności npm zakończyła się błędem DNS `EAI_AGAIN`.
Healthcheck sprawdza HTTP i moduł wejściowy, nie zastępuje testu w przeglądarce.

## TeamCity (opcjonalnie)

`.teamcity/devgui.recipe.yaml` to **prywatny YAML recipe**, nie uniwersalny plik
konfigurujący cały serwer TeamCity. W wersji obsługującej YAML recipes wgraj go
przez **Project Settings → Recipes → Upload private recipe**, potem dodaj jako krok.
W konfiguracji buildu ustaw checkout brancha `devgui`, katalog roboczy w głównym
katalogu repo, agenta Linux z Dockerem i Compose oraz maksymalnie **1 build naraz**.
Starszy TeamCity: krok Command Line z `sh scripts/teamcity.sh` robi to samo.

Skrypt buduje obraz, uruchamia `compose up -d --wait` i zostawia aplikację działającą
na hoście agenta. Kolejny build zastępuje ten sam kontener.
Na końcu, także po błędzie, wykonuje `docker image prune` wyłącznie dla nieotagowanych
obrazów z etykietą `pl.dag.component=devgui`. Nie usuwa cudzych obrazów ani wolumenów.
Cache BuildKit zostaje celowo; nie ma globalnego `system prune` ani `image prune -a`.
Logi kontenera są ograniczone do trzech plików po 10 MB.

Dokumentacja: [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/),
[TeamCity YAML recipes](https://www.jetbrains.com/help/teamcity/recipe-yaml-syntax.html).
