# Wstępna architektura

Ten dokument opisuje kierunek, a nie zamkniętą decyzję technologiczną.

## Główne warstwy

### 1. Workflow model

Centralna, neutralna reprezentacja DAG-a.

Powinna być niezależna od:

- GUI;
- sposobu definiowania workflowu;
- sposobu wykonania;
- konkretnego systemu operacyjnego.

Naturalnym kandydatem na format serializacji jest JSON lub YAML.

Przykładowa reprezentacja logiczna:

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

### 2. Python SDK

Warstwa pozwalająca definiować taski i workflowy w Pythonie.

Przykładowy kierunek API:

```python
@task
def transform(df: DataFrame) -> DataFrame:
    ...
```

Dekorator powinien rejestrować metadane potrzebne do zbudowania wspólnego modelu workflow.

### 3. Execution engine

Silnik odpowiedzialny za:

- ustalenie kolejności wykonania;
- wykonywanie tasków;
- przekazywanie wyników;
- obsługę błędów;
- retry;
- statusy;
- rejestrowanie logów;
- przyszły scheduling.

Core silnika musi być cross-platformowy.

### 4. Backend / API

Warstwa komunikacyjna dla GUI i workerów.

Będzie odpowiadać m.in. za:

- CRUD workflowów;
- uruchamianie workflowów;
- pobieranie statusów;
- logi;
- historię wykonań;
- bibliotekę dostępnych typów tasków.

### 5. Visual editor

GUI typu node editor.

Każdy task jest klockiem posiadającym:

- nazwę;
- wejścia;
- wyjścia;
- parametry;
- typy danych;
- status podczas wykonania.

Połączenie portów tworzy krawędź wspólnego modelu DAG.

### 6. Deployment

Docelowo usługi zostaną rozdzielone tak, żeby można je było uruchamiać przez Docker Compose, np.:

```text
frontend
backend
scheduler
worker
metadata database
```

Nie jest jeszcze przesądzone, które z tych elementów będą osobnymi procesami/usługami w pierwszym MVP.

## Najważniejsza decyzja architektoniczna na obecnym etapie

GUI i Python nie przechowują własnych niezależnych definicji workflowu.

Oba generują lub modyfikują wspólny model DAG-a:

```text
Python SDK ─┐
            ├──> Workflow Model ──> Execution Engine
Visual GUI ─┘
```

Dzięki temu workflow może być wizualizowany niezależnie od sposobu, w jaki został utworzony.
