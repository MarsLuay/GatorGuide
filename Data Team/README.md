# Welcome to the Data Team!

The Data Team helps power Gator Guide by collecting and organizing the information students need to compare schools and plan a transfer path. This folder is where we keep working data, research notes, and the raw material that supports recommendations across the project.

## What the Data Team Does

The Data Team helps by:

- Collecting transfer-related college data and deadlines.
- Cleaning and organizing datasets so they can be used by the app and AI features.
- Keeping notes about sources, structure, and research decisions.
- Turning messy public information into something the rest of the project can actually use.

## What's in This Folder

- `Data.md`: notes, planning, and team documentation.
- `WA_Transfer_Deadline.csv`: a current example dataset for transfer deadline work.

## Setup: Open the Data Workspace (Windows)

### 1) Install required tools

- Download VS Code: https://code.visualstudio.com/download
- Install Git: https://git-scm.com/downloads

Optional:

- Install Python if you plan to add data-cleaning or scraping scripts later: https://www.python.org/downloads/

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

This folder does not currently have a standalone app to run. Most work here is dataset editing, documentation, and future pipeline preparation.

### 3) Open in VS Code (edit files)

Open VS Code -> File -> Open Folder ->

```text
C:\Users\<you>\GatorGuide\Data Team
```

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
