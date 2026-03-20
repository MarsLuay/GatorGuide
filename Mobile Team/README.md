# Welcome to the Mobile Team!

The Mobile Team builds the student-facing Gator Guide app. This is where the product comes together: onboarding, profile setup, college browsing, AI interactions, settings, translations, and the overall mobile experience students actually use.

## What the Mobile Team Does

The Mobile Team helps by:

- Building screens, navigation, and app flows in Expo/React Native.
- Connecting AI and data features to a smooth, usable mobile experience.
- Maintaining app services, localization, theming, and mobile configuration.
- Turning product ideas into interactions that feel clear, helpful, and easy to use.

## What's in This Folder

- `app/`: Expo Router screens and navigation.
- `components/`: reusable UI and page-level components.
- `services/`: app services for AI, auth, storage, college data, and config.
- `constants/`, `hooks/`, and `utils/`: shared logic and support files.
- `functions/`: Firebase Functions code related to the mobile app.
- [`../Data Team/docs/COLLEGE_RANKING.md`](../Data Team/docs/COLLEGE_RANKING.md): shared college ranking philosophy and score model used by recommendations.

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

# go to the mobile app
cd "Mobile Team"

# install dependencies and start Expo
npm install
npm run start

# optional: clear Metro cache if you need a fresh start
# npx expo start -c
```

Notes:

- If you use Git Bash, WSL, or a POSIX shell, use forward slashes and drop the `$env:` prefix.
- After Expo starts, open the Metro/Expo devtools in your browser and scan the QR code with the Expo Go app.
- If you are wiring up services, the guide in [`services/README.md`](services/README.md) explains the current stub-based setup.

### 3) Open in VS Code (edit files)

Open VS Code -> File -> Open Folder ->

```text
C:\Users\<you>\GatorGuide\Mobile Team
```

## Before You Start Coding

```powershell
cd $env:USERPROFILE\GatorGuide
git checkout main
git pull --rebase origin main
cd "Mobile Team"
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
