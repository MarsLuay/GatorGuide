# College Scorecard Data Pipeline

This ETL workspace lives in `Data Team/DataScrape` and feeds the Django/MySQL backend in `../Server`.

## Overview

The pipeline downloads College Scorecard data, normalizes it, and prepares it for loading into the backend database. The current scripts are organized as a simple three-step flow:

1. `api_client.py` fetches and caches raw API responses
2. `transform.py` converts the raw data into cleaned output files
3. `db_loader.py` loads the cleaned output into the Django/MySQL backend

`main.py` runs those three scripts in sequence.

## Prerequisites

- Python 3.11+
- UV
- MySQL
- a College Scorecard API key

## Setup

From the repo root:

```powershell
cd "Data Team"
uv sync
cd DataScrape
```

Create a local `.env` in `Data Team/DataScrape` based on `.env.example`, then fill in your API key and database values.

If you also want to use the Django backend locally, create a local `.env` in `Data Team/Server` from `Data Team/Server/.env.example`.

## Running the Pipeline

Run all stages:

```bash
python main.py
```

Run individual stages:

```bash
python api_client.py
python transform.py
python db_loader.py
```

## Output

- cached API data is written under `data_cache/`
- transformed output is written under `data_output/`
- backend loading targets the Django project in `../Server`

## Notes

- The imported pipeline code came from the fork branch you linked and has been remapped into the current `Data Team` structure.
- The docs here were adjusted to match the current repo layout and the actual script behavior.
- Additional reference docs are available in `ARCHITECTURE.md` and `QUICKSTART.md`.
