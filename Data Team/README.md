# Welcome to the Data Team!

The Data Team helps power Gator Guide by collecting and organizing the information students need to compare schools and plan a transfer path. This folder is where we keep working data, research notes, and the raw material that supports recommendations across the project.

## What the Data Team Does

The Data Team helps by:

- Collecting transfer-related college data and deadlines.
- Cleaning and organizing datasets so they can be used by the app and AI features.
- Keeping notes about sources, structure, and research decisions.
- Turning messy public information into something the rest of the project can actually use.

## What's in This Folder

- [`docs/Data.md`](docs/Data.md): notes, planning, and team documentation.
- `WA_Transfer_Deadline.csv`: a current example dataset for transfer deadline work.
- [`docs/PIPELINE_OVERVIEW.md`](docs/PIPELINE_OVERVIEW.md): high-level notes for the imported data/backend workflow.
- `DataScrape/`: Python ETL pipeline for pulling and transforming College Scorecard data.
- `Server/`: Django backend and API files imported from the fork branch.
- `pyproject.toml` and `uv.lock`: shared Python dependency setup for the Data Team workspace.
- [`docs/COLLEGE_RANKING.md`](docs/COLLEGE_RANKING.md): shared ranking philosophy so data decisions stay aligned with the app's recommendation model.

## Setup: Open the Data Workspace (Windows)

### 1) Install required tools

- Download VS Code: https://code.visualstudio.com/download
- Install Git: https://git-scm.com/downloads

Optional but strongly recommended if you want to run the new data/backend tooling:

- Install Python: https://www.python.org/downloads/
- Install UV: https://docs.astral.sh/uv/getting-started/installation/
- Install MySQL if you plan to run the ETL pipeline or Django backend locally.

Verify installs:

```bash
git --version
python --version
```

### 2) Clone the project

Open PowerShell (or your preferred shell) and run:

```powershell
cd $env:USERPROFILE
git clone https://github.com/MarsLuay/GatorGuide.git
cd GatorGuide
```

This folder now includes two runnable Python workspaces:

- `Data Team/DataScrape` for ETL and College Scorecard ingestion
- `Data Team/Server` for the Django backend/API

The student-facing app still lives in `Mobile Team`.

## Before You Start Working

```powershell
cd $env:USERPROFILE\GatorGuide
git checkout main
git pull --rebase origin main
cd "Data Team"
```

## Working Style

- Add new datasets with clear, descriptive file names.
- Document where the data came from and what each file represents.
- Keep credentials, personal data, and one-off exports out of the repo.
- If you add scripts later, keep them close to the data they support and document how to run them.

## Quick Start for the Imported Work

```powershell
cd $env:USERPROFILE\GatorGuide\Data Team
uv sync
cd DataScrape
```

- Copy `.env.example` to `.env` before running the ETL scripts.
- For the Django backend, use `Data Team\Server\.env.example` as your local template.

## Commit and Push Changes

First time only (set your info):

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

After editing changes:

```bash
git add .
git commit -m "enter descriptive message"
git pull --rebase origin main
git push origin main
```
