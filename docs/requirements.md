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

## Analiza zależności danych

Aplikacja analizuje kod i wykrywa zasoby danych używane przez procesy, przede wszystkim:
- pliki wejściowe i wyjściowe;
- tabele i widoki baz danych;
- operacje odczytu, zapisu i modyfikacji.

Na tej podstawie buduje data lineage, czyli zależności `zasób -> proces -> zasób`.

GUI ma mieć widok zasobów danych. Po kliknięciu tabeli, pliku albo innego zasobu pokazuje wszystkie procesy, które z niego korzystają, wraz z informacją czy dany proces czyta, zapisuje czy modyfikuje zasób.

Widok działa też w drugą stronę: dla procesu pokazuje jego wejścia i wyjścia.

Zależności są odświeżane po ponownym skanie lub wykryciu zmian w kodzie, żeby mapa wynikała z aktualnego kodu, a nie była ręcznie utrzymywaną dokumentacją.

## Użytkownicy i projekty

Aplikacja obsługuje logowanie użytkowników i jest projektowana pod pracę zespołową.

Użytkownik może należeć do wielu projektów. Każdy projekt ma własnych członków oraz osobne uprawnienia, np. właściciel, administrator, edytor albo tylko odczyt.

Projekty mogą być:
- publiczne;
- prywatne.

Widoczność projektu nie oznacza automatycznie prawa do jego edycji. Uprawnienia są nadawane osobno dla każdego projektu.

Projekt jest główną granicą dostępu do znajdujących się w nim danych, kodu i diagramów.

## Edycja kodu

Aplikacja udostępnia dwa niezależne mechanizmy edycji kodu:

1. Pełne IDE do normalnej pracy z plikami projektu.
2. Mikroedytory osadzone bezpośrednio w elementach diagramu.

Mikroedytor służy do szybkiej edycji kodu powiązanego z konkretnym elementem diagramu. Pełne IDE służy do większych zmian i normalnej pracy nad projektem.

Oba mechanizmy pracują na tym samym kodzie i tym samym stanie projektu.

## Zewnętrzne IDE

Kod projektu musi pozostać normalnym kodem, który można edytować również poza aplikacją, np. w VS Code, JetBrains albo dowolnym innym edytorze.

Zewnętrzna edycja plików nie może uszkodzić projektu ani wymagać korzystania wyłącznie z naszego IDE.

Pliki projektu są źródłem prawdy. Diagram jest ich reprezentacją, a nie osobnym źródłem kodu.

## Synchronizacja zmian

Zmiany wykonane poza aplikacją powinny być wykrywane i ładowane na żywo.

Po zmianie pliku aplikacja powinna odpowiednio odświeżyć:
- wbudowane IDE;
- mikroedytory;
- powiązane elementy diagramu.

Synchronizacja musi być bezpieczna. Aplikacja nie może bezmyślnie nadpisywać niezapisanych zmian. W przypadku konfliktu albo chwilowo niepoprawnego kodu powinna pokazać problem i pozwolić użytkownikowi go rozwiązać, zamiast rozwalić stan projektu.

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
