# Wizja projektu

## Cel

Stworzyć cross-platformowy system do zarządzania procesami/workflowami, którego centralnym elementem jest DAG pokazujący zarówno kolejność wykonywania tasków, jak i przepływ danych pomiędzy nimi.

System ma być wygodniejszy do definiowania niż klasyczny Apache Airflow i pozwalać na dwa równorzędne sposoby budowania workflowów:

1. Python API oparte o funkcje i dekoratory.
2. Visual editor w GUI oparty o klocki i połączenia między portami.

Obie formy mają reprezentować ten sam workflow, a nie dwa niezależne systemy.

## Inspiracje

### Apache Airflow

- DAG-i;
- scheduling;
- statusy wykonania;
- retry;
- logi;
- zależności pomiędzy taskami.

### Prefect / Marimo

- naturalne funkcje Pythona;
- dekoratory;
- task przyjmuje normalne argumenty;
- task zwraca normalne wartości;
- zależności wynikają z przepływu danych.

### Kestra

- silny nacisk na GUI;
- obserwowanie przebiegu workflow;
- wygodne uruchamianie i zarządzanie procesami;
- wizualne składanie workflowów.

### Kedro / Kedro-Viz

- jawny przepływ danych;
- wizualizacja wejść i wyjść;
- czytelny graf zależności pomiędzy transformacjami danych.

## Przykład mentalnego modelu

```python
@task
def load_data() -> DataFrame:
    ...

@task
def transform(df: DataFrame) -> DataFrame:
    ...

@task
def train(df: DataFrame) -> Model:
    ...
```

Powinno odpowiadać diagramowi w rodzaju:

```text
[load_data]
     │ DataFrame
     ▼
[transform]
     │ DataFrame
     ▼
  [train]
     │ Model
     ▼
```

Kluczowa zasada: wartość zwracana przez task jest częścią modelu workflow i może bezpośrednio zasilać wejście kolejnego taska.
