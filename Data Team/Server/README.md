# Django Backend

This backend lives in `Data Team/Server` and was imported from the fork branch you linked. It is a Django project with an `API` app and local environment configuration through `.env`.

## Setup

From the repo root:

```powershell
cd "Data Team"
uv sync
cd Server
```

Copy `.env.example` to `.env`, then fill in:

- `SECRET_KEY`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_HOST`
- `DATABASE_PORT`

## Common Commands

```bash
python manage.py migrate
python manage.py runserver
python manage.py check
```

## Notes

- Django settings live in `Server/settings.py`.
- API models and endpoints live under `API/`.
- The ETL loader in `../DataScrape/db_loader.py` is configured to target this backend layout.
