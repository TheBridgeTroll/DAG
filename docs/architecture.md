# Architektura

Na razie to kierunek, nie wykuty w kamieniu stack.

Workflow musi mieć jedną reprezentację. GUI i Python nie mogą trzymać swoich wersji, bo za pół roku rozjadą się jak cholera.

```text
Python SDK ─┐
            ├──> Workflow Model ──> Execution Engine
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

## Execution engine

Ma ogarniać kolejność wykonania, przekazywanie wyników, błędy, retry, statusy, logi i później scheduling. Core musi działać tak samo na Windowsie i Linuxie.

## Backend / API

GUI i workery muszą przez coś gadać. Backend będzie ogarniał workflowy, uruchomienia, statusy, logi, historię i bibliotekę dostępnych tasków.

## GUI

Node editor. Task to klocek z nazwą, wejściami, wyjściami, parametrami, typami danych i statusem. Połączenie portów tworzy krawędź DAG-a.

## Deployment

Docelowo Docker Compose. Możliwy podział:

```text
frontend
backend
scheduler
worker
metadata database
```

Nie wiemy jeszcze, które z tych rzeczy faktycznie muszą być osobnymi usługami w MVP. Nie ma sensu robić mikroserwisów dla samej przyjemności posiadania większej liczby kontenerów.
