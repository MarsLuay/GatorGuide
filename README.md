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
- Download Node.js (prebuilt version): https://nodejs.org/en/download
- Download Git (use VS Code instead of Vim): https://git-scm.com/install/windows

Verify installs:

Go into terminal, and enter

```bash
npm.cmd -v
npx.cmd -v
```

### 2) Clone and install the project

```bash
cd $env:USERPROFILE

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\GatorGuide\GatorGuideV2" | Out-Null

git clone https://github.com/MarsLuay/GatorGuide.git "$env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end"

cd "$env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end"
npm.cmd install
npx.cmd expo start
# add --tunnel manually if you want to host online (to connect with phone)
# then copy the http://localhost:8081/ URL or other URL without the exp:// into your browser to view the app
```

### 3) Open in VS Code (edit files)

Open VS Code → File → Open Folder →

```
C:\Users\<you>\GatorGuide\GatorGuideV2\Front-end
```

## Before You Start Coding (Always)

```bash
cd $env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end
git checkout main
git pull origin main
```

## Commit and Push Changes

First time only (set your info):

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

Then:

```bash
cd $env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end
git status
git branch
git add .
git commit -m "WIP: updates"
git pull --rebase origin main
git push origin main
```