# Wymagania

## Workflow w Pythonie

- workflow da się definiować zwykłymi funkcjami Pythona;
- funkcje mogą mieć dekoratory, np. `@task`;
- taski biorą argumenty i zwracają wartości;
- zależności wynikają z przepływu danych;
- wejścia i wyjścia są widoczne na diagramie.

## Workflow w GUI

- nowy workflow da się zrobić bez pisania kodu;
- GUI ma bibliotekę gotowych tasków;
- taski przeciąga się na diagram;
- użytkownik łączy porty wejściowe z wyjściowymi;
- diagram pokazuje kierunek przepływu danych;
- workflow da się zapisać, uruchomić i później edytować.

## Jeden model DAG-a

Python i GUI nie mogą mieć osobnych formatów workflow. To ma być ten sam model, bo inaczej za chwilę wszystko się rozjedzie.

Model musi ogarniać przynajmniej:
- taski/nody;
- wejścia i wyjścia;
- typy danych;
- parametry;
- zależności;
- konfigurację wykonania;
- metadane potrzebne do wizualizacji.

## Platformy

System musi działać na:
- Windows 11;
- Windows Server;
- Linuxie.

Nie zakładamy obecności:
- WSL;
- basha;
- unixowego `fork()`;
- `/tmp`;
- innych mechanizmów tylko dla POSIX.

Core ma być cross-platformowy.

## Deployment

Docelowo projekt ma mieć:
- `Dockerfile`;
- `docker-compose.yml`;
- możliwość odpalenia usług w kontenerach;
- możliwość odpalenia aplikacji bez Dockera.

Docker ma pomagać we wdrożeniu, a nie być kulą u nogi przy developmentcie czy zwykłym uruchomieniu.

Windows Server nie może zależeć od Docker Desktop.
