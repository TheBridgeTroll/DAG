# Wymagania

## Wymagania funkcjonalne

### Definiowanie workflowów w Pythonie

- workflow musi dać się definiować za pomocą zwykłych funkcji Pythona;
- funkcje mogą być oznaczane dekoratorami, np. `@task`;
- taski przyjmują argumenty i zwracają wartości;
- połączenia pomiędzy taskami wynikają z przepływu danych;
- wejścia i wyjścia tasków powinny być widoczne w diagramie.

### Definiowanie workflowów w GUI

- użytkownik musi móc utworzyć nowy workflow bez pisania kodu;
- GUI ma udostępniać bibliotekę gotowych klocków/tasków;
- klocki mają być przeciągane na diagram;
- użytkownik łączy porty wejściowe i wyjściowe;
- diagram powinien pokazywać kierunek przepływu danych;
- utworzony workflow musi być możliwy do zapisania, uruchomienia i późniejszej edycji.

### Wspólny model workflow

Python SDK i GUI muszą korzystać z jednego modelu DAG-a.

Nie chcemy sytuacji, w której workflow napisany w Pythonie i workflow zbudowany w GUI są dwoma różnymi bytami z osobnymi zasadami działania.

Model workflow powinien obejmować przynajmniej:

- taski/nody;
- wejścia;
- wyjścia;
- typy danych;
- parametry;
- zależności;
- konfigurację wykonania;
- metadane potrzebne do wizualizacji.

## Wymagania platformowe

System musi działać na:

- Windows 11;
- Windows Server;
- Linux.

Nie wolno projektować podstawowej funkcjonalności w oparciu o założenie obecności:

- WSL;
- bash;
- unixowego `fork()`;
- ścieżek typu `/tmp`;
- mechanizmów dostępnych wyłącznie na systemach POSIX.

Kod aplikacji powinien być cross-platformowy.

## Deployment

Docelowo projekt ma zawierać:

- `Dockerfile`;
- `docker-compose.yml`;
- możliwość uruchomienia usług w kontenerach;
- możliwość uruchomienia aplikacji bez Dockera.

Docker jest warstwą wdrożeniową, a nie wymaganiem koniecznym do działania core aplikacji.

Szczególnej uwagi wymaga Windows Server, ponieważ nie można zakładać obecności Docker Desktop. Architektura nie może być od niego zależna.
