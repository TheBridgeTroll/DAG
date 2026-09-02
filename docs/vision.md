# Wizja

Chcemy orkiestrator workflowów, który da się ogarnąć bez walki z Airflowem i bez wciskania wszystkiego w YAML.

Workflow ma być jednym DAG-iem, niezależnie od tego, czy powstał w Pythonie, czy został wyklikany w GUI.

W Pythonie task to zwykła funkcja z dekoratorem. Bierze argumenty, zwraca wynik i tyle. Ten przepływ ma być widoczny na diagramie.

W GUI użytkownik bierze gotowe klocki, wrzuca je na diagram i łączy wejścia z wyjściami. Bez pisania kodu, jeśli nie chce.

Z Airflowa bierzemy scheduling, retry, statusy, logi i zależności. Z Prefecta i Marimo prostszy model funkcji. Z Kestry GUI. Z Kedro i Kedro-Viz jawny przepływ danych i sensowny graf.

Przykład:

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

Na diagramie ma być po prostu:

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

Najważniejsze: wynik jednego taska jest normalnym wejściem następnego, a nie jakimś bocznym mechanizmem doklejonym później.
