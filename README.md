# DAG

Orkiestrator workflowów w Pythonie z GUI do składania ich z klocków.

Inspiracje: Airflow, Kestra, Prefect, Marimo i Kedro. Bierzemy z nich to, co ma sens, bez kopiowania całego syfu.

Workflow można:
- napisać w Pythonie jako funkcje z dekoratorami;
- złożyć w GUI, przeciągając taski i łącząc ich wejścia z wyjściami.

Oba sposoby mają tworzyć ten sam DAG.

Task bierze normalne argumenty, zwraca normalne wartości, a przepływ danych widać na diagramie. Węzły mają wejścia, wyjścia, typy, parametry i konfigurację wykonania.

System ma ogarniać m.in.:
- wykonywanie DAG-ów;
- zależności między taskami;
- retry;
- statusy;
- logi;
- historię wykonań;
- scheduling.

Musi działać na Windows 11, Windows Server i Linuxie. Bez wymagania WSL, basha i innych unixowych cudów.

Docelowo całość ma dać się odpalić przez `Dockerfile` + `docker-compose.yml`, ale Docker nie może być potrzebny do zwykłego uruchomienia aplikacji.

Więcej:
- [wizja](docs/vision.md)
- [wymagania](docs/requirements.md)
- [architektura](docs/architecture.md)
