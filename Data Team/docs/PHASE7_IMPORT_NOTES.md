# Phase 7 Import Notes

Phase 7 imported the donor AI and backend additions into safe, additive locations.

## Imported

- `AI Team/model/`
- `Data Team/CrawlScoreBoard/`
- `Data Team/Server/Authenticator/`
- `Data Team/Server/API/permissions.py`
- `Data Team/Server/API/views_handler_functions.py`

## Current Backend Wiring

- `Data Team/Server/Server/settings.py` now exposes `ENCRYPTION_KEY` and registers `Authenticator`.
- `Data Team/Server/Server/urls.py` now exposes `POST /auth/generate/`.
- Existing `api/read` and `api/write` routes were left unchanged.

## Intentional Non-Import

The donor migration `API/migrations/0007_rename_school_id_school_sid_rename_user_id_user_uid.py` was not added to the live Django app.

Reason:

- the current `Data Team/Server/API/models.py` still uses `user_id` and `school_id`
- importing the rename migration without also migrating the active models and handlers would create schema drift

If we want the donor UID/SID schema later, that should be done as a dedicated backend migration pass instead of piggybacking on this import step.
