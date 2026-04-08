# CrawlScoreBoard

This folder is the imported alternate scoreboard crawler from the donor repo.

## Files

- `main.py`: entrypoint for the crawl/load flow
- `api_client.py`: API fetch helpers
- `transform.py`: transform logic
- `db_loader.py`: database load helpers
- `schema.sql`: schema reference for the scoreboard tables

## Notes

- This pipeline is separate from `Data Team/DataScrape`.
- It was imported additively for reference and future integration work.
- Check `Data Team/docs/PHASE7_IMPORT_NOTES.md` before wiring it into the main backend flow.
