# Welcome to Gator Guide!

Gator Guide is a student-focused project designed to help transfer applicants find their best-fit college. It brings together mobile product design, college data, and AI-powered guidance so students can explore schools, ask questions, and get support in a way that feels personal and practical.

## What Gator Guide Does

Gator Guide helps students:

- Discover colleges that fit their academic profile and goals.
- Explore school information in a more personalized way.
- Get AI-powered guidance for transfer planning, applications, and next steps.
- Keep important profile details, transcripts, and interests in one place.

We make that possible by combining three connected parts of the project:

- **Mobile Team** builds the app experience students actually use.
- **Data Team** collects and organizes the school data behind the experience.
- **AI Team** shapes the intelligence, prompts, and recommendation logic that make the app feel helpful.

## Repo Layout

- [Mobile Team](Mobile%20Team/README.md): Expo/React Native app, UI, app services, and platform setup.
- [Data Team](Data%20Team/README.md): datasets, research notes, and transfer-data work.
- [AI Team](AI%20Team/README.md): AI planning, prompts, and integration direction.

## Setup: Download and Run (Windows)

### 1) Install required tools

- Download VS Code: https://code.visualstudio.com/download
- Download Node.js: https://nodejs.org/en/download
- Install Git: https://git-scm.com/downloads

Verify installs:

Open a terminal and run:

```bash
node -v
npm -v
npx -v
git --version
```

### 2) Clone and install the project

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

# optional: clear Metro cache if you need a fresh start
# npx expo start -c
```

Notes:

- If you use Git Bash, WSL, or a POSIX shell, use forward slashes and drop the `$env:` prefix.
- After Expo starts, open the Metro/Expo devtools in your browser and scan the QR code with Expo Go.
- If you are working on Data Team or AI Team tasks, you can open the repo without starting the mobile app.

### 3) Open in VS Code (edit files)

Open VS Code -> File -> Open Folder ->

```text
C:\Users\<you>\GatorGuide
```

## Before You Start Working

```powershell
cd $env:USERPROFILE\GatorGuide
git checkout main
git pull --rebase origin main
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
