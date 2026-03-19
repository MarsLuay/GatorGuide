# Pipeline Overview

This workspace is responsible for fetching, transforming, and loading U.S. college data into the Django/MySQL backend under `Data Team/Server`. The pipeline currently lives in `Data Team/DataScrape` and pulls from the College Scorecard API.

## What It Covers

- API fetching from College Scorecard
- data normalization and cleanup
- loading transformed output into the Django/MySQL backend

## Running the Pipeline

The current orchestrator script does not use CLI flags. To run the full pipeline:

```bash
cd "Data Team/DataScrape"
python main.py
```

This runs:

1. `api_client.py`
2. `transform.py`
3. `db_loader.py`

## Running Individual Stages

Fetch only:

```bash
python api_client.py
```

Transform only:

```bash
python transform.py
```

Load only:

```bash
python db_loader.py
```

## Notes

- Use `.env.example` in `Data Team/DataScrape` as the starting point for local pipeline credentials.
- Use `.env.example` in `Data Team/Server` as the starting point for Django backend credentials.
- The imported backend code came from the fork branch you linked, but it has been placed under the current `Data Team` layout so it does not conflict with the repo reorganization.
