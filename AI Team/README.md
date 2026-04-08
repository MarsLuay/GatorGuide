# Welcome to the AI Team!

The AI Team helps make Gator Guide feel smart, personal, and useful. This is the part of the project focused on recommendation logic, prompt design, AI-powered guidance, and the thinking behind how students get meaningful support inside the app.

## What the AI Team Does

The AI Team helps by:

- Shaping the AI experience students interact with in Gator Guide.
- Planning prompts, behaviors, and recommendation logic for personalized guidance.
- Defining how AI features connect to the rest of the product.
- Translating product goals into responses that feel helpful, clear, and trustworthy.

## What's in This Folder

- `AI.md`: notes, planning, and AI-related project direction.
- `model/`: imported standalone AI workspace for essay RAG, retrieval experiments, and course-matching prototypes.

## Current Integration Points

The AI Team now has a standalone experiments workspace under `model/`, but most of the app-side AI integration still lives in the Mobile Team workspace, especially:

- [`../Mobile Team/services/ai.service.ts`](../Mobile%20Team/services/ai.service.ts)
- [`../Mobile Team/services/README.md`](../Mobile%20Team/services/README.md)

That means this folder is a good home for planning, prompts, experiments, and documentation, while the mobile app currently handles the runtime integration.

## Imported Model Workspace

The donor repo's AI code now lives in:

- `AI Team/model/src/rag_vector/`
- `AI Team/model/src/essay_chain/`
- `AI Team/model/CourseMatching/`

Use `AI Team/model/README.md` and `AI Team/model/AI.md` for the experiment-specific commands and environment variables.

## Setup: Open the AI Workspace (Windows)

### 1) Install required tools

- Download VS Code: https://code.visualstudio.com/download
- Install Git: https://git-scm.com/downloads

Optional:

- Install Node.js if you want to test app-side integrations from the mobile workspace: https://nodejs.org/en/download

Verify installs:

```bash
git --version
node -v
```

### 2) Clone the project

Open PowerShell (or your preferred shell) and run:

```powershell
cd $env:USERPROFILE
git clone https://github.com/MarsLuay/GatorGuide.git
cd GatorGuide
```

This folder does not currently run as a standalone service. For end-to-end testing of AI behavior inside the app, use the Mobile Team workspace.

### 3) Open in VS Code (edit files)

Open VS Code -> File -> Open Folder ->

```text
C:\Users\<you>\GatorGuide\AI Team
```

## Before You Start Working

```powershell
cd $env:USERPROFILE\GatorGuide
git checkout main
git pull --rebase origin main
cd "AI Team"
```

## Working Style

- Keep prompt ideas, experiments, and decision notes easy to read.
- Document assumptions behind recommendations and generated guidance.
- Coordinate schema or behavior changes with the Mobile Team when they affect app flows.
- Avoid committing secrets, keys, or provider credentials to the repo.

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
