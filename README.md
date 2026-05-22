# Welcome to Gator Guide!

Gator Guide is a student-focused project designed to help transfer applicants find their best-fit college. It consolidates scholarship/internship links, provides useful tools, and gives direct schedule guidance so students can explore schools and get support in a way that feels personal and practical.

## License

This repository is source-available under the [PolyForm Strict License 1.0.0](LICENSE). It is not open source.

That means others can review and use the code only for noncommercial purposes, but they may not redistribute it or publish modified versions under this license.

## What Gator Guide Does

Gator Guide helps students:

- Discover colleges that fit their academic profile and goals.
- Explore personalized schedule information.
- Get reminders for applications and due dates.

## Setup: Download and Run

### Quick start

- On Windows, double-click `Start-to-run.bat`
- On macOS, double-click `Start-to-run.app`
- On Linux, double-click `Start-to-run.desktop`
- After the server comes online, it opens `<http://127.0.0.1:8081>` in your default browser automatically.
- If you download only one launcher, put it in an empty folder and run it. It will clone the rest of Gator Guide into a `GatorGuide` folder beside the launcher.

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

# the mobile app lives in the "source" folder
cd source

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

### How to add new resources

To add new scholarships, internships, or helpful resource links, use the resources launcher for your system:

- Windows: `add-or-remove-resources.bat`
- macOS: `add-or-remove-resources.app`
- Linux: `add-or-remove-resources.desktop`

Just double-click it, answer the prompts, and it will walk you through adding the item. It asks for the important information, including things like title, link, deadline style, yearly recurrence, essays, recommendations, and any other details it can collect.

After it saves your changes, commit and push them so the new scholarship, internship, or resource is added to the repo.

### Viewing Resources

You can also view all of these resources and easily edit them by using the export/import to excel sheet option. Export and then run it through Google Sheets and you'll have an easy time editing things. The exported file will be found as `resource-catalog-export.xlsx` in the root (not in any folders).

## Updating Planner

### How to update the planner

To update all course information in course planner, double-click the course planner updater for your system:

- Windows: `Course-Planner-Updater.bat`
- macOS: `Course-Planner-Updater.app`
- Linux: `Course-Planner-Updater.desktop`

There will be a few options that will walk you through on what to update and how it should do it. After waiting around 20 minutes (hopefully), you are free to commit and push the updates so the new information is added to the repo.
