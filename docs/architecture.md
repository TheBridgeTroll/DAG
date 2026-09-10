# Architektura

Na razie to kierunek, nie wykuty w kamieniu stack.

Workflow musi mieć jedną reprezentację. GUI i Python nie mogą trzymać swoich wersji, bo za pół roku rozjadą się jak cholera.

```text
Python SDK ─┐
            ├──> Workflow Model ──> Orchestrator ──> Executor
Visual GUI ─┘
```

Model DAG-a powinien być niezależny od GUI, sposobu wykonania i systemu operacyjnego. Do serializacji najpewniej JSON albo YAML.

```text
Workflow
 ├─ Nodes
 │   ├─ Task A
 │   │   ├─ inputs
 │   │   └─ outputs
 │   └─ Task B
 └─ Edges
     └─ Task A.output -> Task B.input
```

## Python SDK

Dekorator typu `@task` zbiera metadane potrzebne do zbudowania DAG-a, ale sama funkcja dalej ma wyglądać normalnie:

```python
@task
def transform(df: DataFrame) -> DataFrame:
    ...
```

## Backend / API

GUI i workery gadają przez backend. Backend zapisuje workflowy i konfigurację, pokazuje uruchomienia, statusy, logi, historię i bibliotekę tasków.

Backend nie odpala kodu użytkownika bezpośrednio. Ręczne uruchomienie trafia do Orchestratora.

## Orchestrator

To główny proces sterujący uruchomieniami. Każde uruchomienie, ręczne albo z harmonogramu, przechodzi przez niego.

Przed startem sprawdza:
- kto zlecił uruchomienie i czy ma do tego prawo;
- czy workflow wymaga dodatkowej zgody;
- gdzie workflow ma się uruchomić;
- którego środowiska Python użyć;
- czy nie został przekroczony limit równoległych uruchomień.

Dopiero potem zleca wykonanie Executorowi.

## Scheduler

Scheduler pilnuje czasu. Obsługuje cron, interwały i jednorazowe terminy.

Scheduler nie uruchamia workflow. Gdy nadchodzi termin, wysyła żądanie uruchomienia do Orchestratora. Dzięki temu zaplanowany workflow przechodzi przez te same sprawdzenia co uruchomienie ręczne.

Silnik schedulera ma być schowany za własnym adapterem, żeby dało się go później wymienić bez przebudowy reszty systemu.

## Środowiska Python

Każdy projekt ma wybrane środowisko Python. Workflow może użyć środowiska projektu albo własnego.

Za środowiska odpowiada Environment Manager. Ma:
- tworzyć venv;
- synchronizować zależności;
- pilnować wersji Pythona;
- znać stan środowiska: `ready`, `syncing`, `broken`.

Pierwszym wyborem do zarządzania Pythonem i venvami jest `uv`.

Environment Manager nie decyduje, kto może uruchomić workflow. Dostaje tylko polecenia dotyczące środowiska.

## Executor

Executor uruchamia właściwy proces w środowisku wskazanym przez Orchestratora.

Dostaje tylko dane potrzebne do konkretnego uruchomienia: kod, parametry, środowisko i potrzebne sekrety. Zbiera status, kod wyjścia, logi i artefakty.

Executor nie podejmuje decyzji o uprawnieniach i nie wybiera sam środowiska.

## Uprawnienia i zgody

Uprawnienia użytkownika są sprawdzane przed każdym uruchomieniem. Role projektowe nadal obowiązują także wtedy, gdy workflow odpala scheduler.

Niektóre workflow mogą wymagać dodatkowej zgody przed startem. Reguły zgód i limitów są osobną częścią backendu, ale decyzję o starcie wykonuje Orchestrator.

## Sekrety

Hasła, tokeny i klucze nie mogą leżeć w definicji workflow ani wracać do GUI jako zwykły tekst.

Secrets Manager wydaje potrzebny sekret tylko na czas konkretnego uruchomienia. Użycie sekretu ma być zapisane w historii.

GUI może wiedzieć, że sekret istnieje i jak się nazywa, ale nie powinno dostawać jego wartości.

## GUI

Node editor. Task to klocek z nazwą, wejściami, wyjściami, parametrami, typami danych i statusem. Połączenie portów tworzy krawędź DAG-a.

GUI korzysta z tego samego kodu i tego samego modelu workflow co Python SDK. Pełne IDE, mikroedytory i zewnętrzny edytor nie mogą tworzyć osobnych kopii projektu.

## Analiza kodu i danych

Osobny skaner analizuje kod i wykrywa używane pliki, tabele, widoki oraz operacje odczytu i zapisu. Wynik trafia do modelu zależności pokazywanego w GUI.

Skaner niczego nie uruchamia. Czyta kod i zapisuje wykryte zależności.

## Główny przepływ uruchomienia

```text
GUI / CLI ──> Backend / API ──> Orchestrator ──> Executor
Scheduler ────────────────────> Orchestrator
                              ├──> uprawnienia / zgody
                              ├──> Environment Manager
                              └──> Secrets Manager
Executor ──> logi / artefakty / pliki / bazy / API
```

Nie wolno omijać Orchestratora i odpalać kodu bezpośrednio z GUI albo schedulera.

## Deployment

Docelowo Docker Compose. Możliwy podział:

```text
frontend
backend
orchestrator
scheduler
worker
metadata database
```

Nie wiemy jeszcze, które z tych rzeczy faktycznie muszą być osobnymi usługami w MVP. Nie ma sensu robić mikroserwisów dla samej przyjemności posiadania większej liczby kontenerów.
