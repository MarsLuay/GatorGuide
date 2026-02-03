<<<<<<< HEAD
# Welcome to Gator Guide 👋

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

```bash
npm.cmd -v
npx.cmd -v
=======

>>>>>>> 596bfb5 (WIP: updates)
```
Front-end
├─ app
│  ├─ (tabs)
│  │  ├─ index.tsx
│  │  ├─ profile.tsx
│  │  ├─ resources.tsx
│  │  ├─ settings.tsx
│  │  └─ _layout.tsx
│  ├─ +not-found.tsx
│  ├─ about.tsx
│  ├─ forgot-password.tsx
│  ├─ index.tsx
│  ├─ language.tsx
│  ├─ login.tsx
│  ├─ profile-setup.tsx
│  ├─ questionnaire.tsx
│  ├─ roadmap.tsx
│  └─ _layout.tsx
├─ app.json
├─ assets
│  └─ images
│     ├─ android-icon-background.png
│     ├─ android-icon-foreground.png
│     ├─ android-icon-monochrome.png
│     ├─ favicon.png
│     ├─ icon.png
│     ├─ partial-react-logo.png
│     ├─ react-logo.png
│     ├─ react-logo@2x.png
│     ├─ react-logo@3x.png
│     └─ splash-icon.png
├─ babel.config.js
├─ components
│  ├─ haptic-tab.tsx
│  ├─ layouts
│  │  └─ ScreenBackground.tsx
│  ├─ LoadingScreen.tsx
│  ├─ pages
│  │  ├─ AboutPage.tsx
│  │  ├─ AuthPage.tsx
│  │  ├─ ForgotPasswordPage.tsx
│  │  ├─ HomePage.tsx
│  │  ├─ LanguagePage.tsx
│  │  ├─ ProfilePage.tsx
│  │  ├─ ProfileSetupPage.tsx
│  │  ├─ QuestionnairePage.tsx
│  │  ├─ ResourcesPage.tsx
│  │  ├─ RoadmapPage.tsx
│  │  └─ SettingsPage.tsx
│  └─ ui
│     ├─ FormInput.tsx
│     ├─ LanguageModal.tsx
│     └─ ProfileField.tsx
├─ constants
│  ├─ locales
│  │  ├─ ar.json
│  │  ├─ de.json
│  │  ├─ en.json
│  │  ├─ es.json
│  │  ├─ fr.json
│  │  ├─ hi.json
│  │  ├─ it.json
│  │  ├─ ja.json
│  │  ├─ ko.json
│  │  ├─ pt.json
│  │  ├─ ru.json
│  │  ├─ tl.json
│  │  ├─ vi.json
│  │  ├─ zh-Hant.json
│  │  └─ zh.json
│  └─ theme.ts
├─ eslint.config.js
├─ global.css
├─ hooks
│  ├─ use-app-data.tsx
│  ├─ use-app-theme.tsx
│  ├─ use-color-scheme.ts
│  ├─ use-color-scheme.web.ts
│  ├─ use-theme-color.ts
│  └─ use-theme-styles.ts
├─ metro.config.js
├─ mobile-notes.md
├─ nativewind-env.d.ts
├─ package-lock.json
├─ package.json
├─ README.md
├─ scripts
│  └─ reset-project.js
├─ services
│  ├─ ai.service.ts
│  ├─ auth.service.ts
│  ├─ college.service.ts
│  ├─ config.ts
│  ├─ firebase.client.ts
│  ├─ firebase.ts
│  ├─ i18n.ts
│  ├─ index.ts
│  ├─ notifications.service.ts
│  ├─ README.md
│  ├─ roadmap.service.ts
│  └─ storage.service.ts
├─ tailwind.config.js
└─ tsconfig.json

<<<<<<< HEAD
### 2) Clone and install the project

```bash
cd $env:USERPROFILE

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\GatorGuide\GatorGuideV2" | Out-Null

git clone https://github.com/MarsLuay/GatorGuide.git "$env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end"

cd "$env:USERPROFILE\GatorGuide\GatorGuideV2\Front-end"
npm.cmd install
npx.cmd expo start
# add --tunnel manually if you want to host online (to connect with phone)
# then copy the http://localhost:8081/ URL into your browser to view the app
```

### 3) Open in VS Code (edit files)

Open VS Code → File → Open Folder →

```
C:\Users\<you>\GatorGuide\GatorGuideV2\Front-end
```

## Test on Phone (Expo Go)

```bash
Npx.cmd expo start --tunnel
# make sure to type the -- manually (word docs can break formatting)
# scan the QR code with Expo Go
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
# paste any error messages to ChatGPT if they appear
```
=======
```
```
Front-end
├─ app
│  ├─ (tabs)
│  │  ├─ index.tsx
│  │  ├─ profile.tsx
│  │  ├─ resources.tsx
│  │  ├─ settings.tsx
│  │  └─ _layout.tsx
│  ├─ +not-found.tsx
│  ├─ about.tsx
│  ├─ forgot-password.tsx
│  ├─ index.tsx
│  ├─ language.tsx
│  ├─ login.tsx
│  ├─ profile-setup.tsx
│  ├─ questionnaire.tsx
│  ├─ roadmap.tsx
│  └─ _layout.tsx
├─ app.json
├─ assets
│  └─ images
│     ├─ android-icon-background.png
│     ├─ android-icon-foreground.png
│     ├─ android-icon-monochrome.png
│     ├─ favicon.png
│     ├─ icon.png
│     ├─ partial-react-logo.png
│     ├─ react-logo.png
│     ├─ react-logo@2x.png
│     ├─ react-logo@3x.png
│     └─ splash-icon.png
├─ babel.config.js
├─ components
│  ├─ haptic-tab.tsx
│  ├─ layouts
│  │  └─ ScreenBackground.tsx
│  ├─ LoadingScreen.tsx
│  ├─ pages
│  │  ├─ AboutPage.tsx
│  │  ├─ AuthPage.tsx
│  │  ├─ ForgotPasswordPage.tsx
│  │  ├─ HomePage.tsx
│  │  ├─ LanguagePage.tsx
│  │  ├─ ProfilePage.tsx
│  │  ├─ ProfileSetupPage.tsx
│  │  ├─ QuestionnairePage.tsx
│  │  ├─ ResourcesPage.tsx
│  │  ├─ RoadmapPage.tsx
│  │  ├─ SettingsPage.tsx
│  │  └─ StartupAnimation.tsx
│  └─ ui
│     ├─ FormInput.tsx
│     ├─ LanguageModal.tsx
│     └─ ProfileField.tsx
├─ constants
│  ├─ locales
│  │  ├─ ar.json
│  │  ├─ de.json
│  │  ├─ en.json
│  │  ├─ es.json
│  │  ├─ fr.json
│  │  ├─ hi.json
│  │  ├─ it.json
│  │  ├─ ja.json
│  │  ├─ ko.json
│  │  ├─ pt.json
│  │  ├─ ru.json
│  │  ├─ tl.json
│  │  ├─ vi.json
│  │  ├─ zh-Hant.json
│  │  └─ zh.json
│  └─ theme.ts
├─ eslint.config.js
├─ global.css
├─ hooks
│  ├─ use-app-data.tsx
│  ├─ use-app-theme.tsx
│  ├─ use-color-scheme.ts
│  ├─ use-color-scheme.web.ts
│  ├─ use-theme-color.ts
│  └─ use-theme-styles.ts
├─ metro.config.js
├─ mobile-notes.md
├─ nativewind-env.d.ts
├─ package-lock.json
├─ package.json
├─ README.md
├─ scripts
│  └─ reset-project.js
├─ services
│  ├─ ai.service.ts
│  ├─ auth.service.ts
│  ├─ college.service.ts
│  ├─ config.ts
│  ├─ firebase.client.ts
│  ├─ firebase.ts
│  ├─ i18n.ts
│  ├─ index.ts
│  ├─ notifications.service.ts
│  ├─ README.md
│  ├─ roadmap.service.ts
│  └─ storage.service.ts
├─ tailwind.config.js
└─ tsconfig.json

```
>>>>>>> 596bfb5 (WIP: updates)
