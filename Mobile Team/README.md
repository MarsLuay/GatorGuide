# Welcome to Gator Guide!

Gator Guide is a mobile app designed to help students find their perfect transfer college. It learns about your academic profile (major, transcripts, activities, interests) and uses AI-powered insights to recommend the best-fit schools. You can also ask questions, get advice, and explore schools in a personalized way.

## What the App Does

Gator Guide helps you:

- Discover your ideal college match based on your profile and preferences.
- Interact with AI to get advice, application guidance, and school info.
- Track your academic records, activities, and interests in one place.

We achieve this by combining data collection, AI analysis, and mobile-first design to make the process simple, intuitive, and helpful.

## Teams

- **AI Team:** Builds and integrates AI features that deliver personalized insights and recommendations.
- **Mobile Development Team:** Builds the app UI/UX and integrates AI/data into a usable mobile experience.
- **Data Scraping Team:** Collects and organizes college data to power recommendations and search.

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
mkdir -Force GatorGuide
cd GatorGuide
git clone https://github.com/MarsLuay/GatorGuide.git

# the mobile app lives in the "Mobile Team" folder
cd "GatorGuide\Mobile Team"

# install dependencies and start Expo (clear cache)
npm install
npx expo start -c

# optional: start with tunnel if you need a LAN URL for a physical device
# npx expo start --tunnel
```

Notes:
- If you use Git Bash, WSL, or a POSIX shell, use the same commands without the `$env:` prefix and `\` path separators.
- After `npx expo start` open the Metro/Expo devtools in your browser and scan the QR code with the Expo Go app.

### 3) Open in VS Code (edit files)

Open VS Code → File → Open Folder →

```
C:\Users\<you>\GatorGuide\Mobile Team
```

## Before You Start Coding (Always)

```bash
cd $env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end
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
git pull --rebase origin main # you may need to reedit and recommit after this
git push origin main
```
