# Django Backend

This backend lives in `Data Team/Server` and was imported from the fork branch you linked. It is a Django project with an `API` app, an additive `Authenticator` app, and local environment configuration through `.env`.

## Setup

From the repo root:

```powershell
cd "Data Team"
uv sync
cd Server
```

Copy `.env.example` to `.env`, then fill in:

- `SECRET_KEY`
- `ENCRYPTION_KEY` if you want to use the imported token endpoints
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
- Token auth endpoints live under `Authenticator/`.
- The ETL loader in `../DataScrape/db_loader.py` is configured to target this backend layout.
- If MySQL env vars are not set, the backend now falls back to local SQLite for development and tests.
- `API/permissions.py` and `API/views_handler_functions.py` were imported as additive helpers and are not yet wired into every existing endpoint.

## API Surface

Read endpoints:

- `GET /api/read/users/`
- `GET /api/read/users/<user_id>/`
- `GET /api/read/schools/`
- `GET /api/read/schools/<school_id>/`

Write endpoints:

- `POST /api/write/users/`
- `PUT|PATCH|DELETE /api/write/users/<user_id>/`
- `POST /api/write/schools/`
- `PUT|PATCH|DELETE /api/write/schools/<school_id>/`

Auth endpoints:

- `POST /auth/generate/`

`GET /api/read/schools/` also supports simple query filters like `q`, `state`, `school_type`, and `climate`.
