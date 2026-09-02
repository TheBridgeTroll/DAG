# Airflow podróbka

Projekt systemu do definiowania, wizualizacji i wykonywania workflowów/DAG-ów.

Główna idea: połączyć orkiestrację procesów znaną z Apache Airflow z wygodnym, wizualnym budowaniem workflowów w stylu Kestra oraz jawnym przepływem danych i wizualizacją zależności inspirowaną Kedro/Kedro-Viz. Pythonowe API ma pozostać możliwie naturalne: zwykłe funkcje, dekoratory, argumenty i wartości zwracane.

## Główne założenia

- workflow jest grafem DAG;
- task może być zwykłą funkcją Pythona opakowaną dekoratorem;
- wejścia i wyjścia tasków są jawne i widoczne na diagramie;
- workflow można tworzyć zarówno w kodzie Python, jak i z poziomu GUI;
- GUI pozwala przeciągać gotowe klocki i łączyć ich porty;
- Python i GUI muszą operować na tym samym modelu workflow;
- system musi działać na Windows 11, Windows Server i Linux;
- Docker jest docelowym sposobem wdrożenia, ale nie warunkiem działania aplikacji;
- docelowo repozytorium ma zawierać Dockerfile oraz docker-compose.yml.

## Dokumentacja

- [Wizja projektu](docs/vision.md)
- [Wymagania](docs/requirements.md)
- [Wstępna architektura](docs/architecture.md)
