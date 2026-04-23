# Welcome to Gator Guide!

Gator Guide is a student-focused project designed to help transfer applicants find their best-fit college. It brings together mobile product design, college data, and guidance so students can explore schools, ask questions, and get support in a way that feels personal and practical.

## License

This repository is source-available under the [PolyForm Strict License 1.0.0](LICENSE). It is not open source.

That means others can review and use the code only for noncommercial purposes, but they may not redistribute it or publish modified versions under this license.

## What Gator Guide Does

Gator Guide helps students:

- Discover colleges that fit their academic profile and goals.
- Explore school information in a more personalized way.
- Get AI-powered guidance for transfer planning, applications, and next steps.
- Keep important profile details, transcripts, and interests in one place.

## Repo Layout

- [Mobile Team](Mobile%20Team/README.md): Contains the bulk of the code: Expo/React Native app, UI, app services, planner tooling, and platform setup.

## Setup: Download and Run

### Quick start

- On Windows, double-click `Start-to-run.bat`
- On macOS or Linux, run `Start-to-run.sh`
- After the server comes online, it opens `<http://127.0.0.1:8081>` in your default browser automatically.

### Manual Start

#### 1) Install required tools

- Download VS Code: <https://code.visualstudio.com/download>
- Download Node.js: <https://nodejs.org/en/download>
- Install Git: <https://git-scm.com/downloads>

#### 2) Clone and install the project

Open PowerShell (or your preferred shell) and run the following commands:

```powershell
# clone the repo
cd $env:USERPROFILE
git clone https://github.com/MarsLuay/GatorGuide.git
cd GatorGuide

# the mobile app lives in the "Mobile Team" folder
cd "Mobile Team"

# install dependencies and start Expo
npm install
npm run start

```

#### 3) Open in VS Code (to edit files)

Open VS Code -> File -> Open Folder ->

```text
C:\Users\<you>\GatorGuide
```

## Before You Start Working

```powershell
cd $env:USERPROFILE\GatorGuide
git checkout main
git pull --rebase origin main (gets the latest update)
```

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

## Adding new resources

### Bat File

To add new scholarships, internships, or helpful resource links, there's a neat little script called `add-or-remove-resources.bat`.

Just double-click it, answer the prompts, and it will walk you through adding the item. It asks for the important information, including things like title, link, deadline style, yearly recurrence, essays, recommendations, and any other details it can collect.

After it saves your changes, commit and push them so the new scholarship, internship, or resource is added to the repo.
