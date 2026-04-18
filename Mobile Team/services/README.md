# API Services Setup Guide

## Overview

The `services/` folder contains the integration logic for Firebase, college data, AI, storage, notifications, and other app-level features.

Some services still contain sample or fallback code paths for resilience and local development, but the app does **not** default to a global stub mode anymore.

## Current State

The app now runs in **real/cached mode by default**:

- `API_CONFIG.useStubData` is hardcoded to `false` in [`config.ts`](./app/config.ts)
- `EXPO_PUBLIC_USE_STUB_DATA` is a legacy env flag and is **not** used by the current config
- live Firebase / API integrations are the expected default path
- some services may still return cached or sample data in narrow fallback situations, but that is not a supported top-level mode switch

If you are trying to debug why the app is calling live services, that is the expected behavior.

## Services

### 1. Authentication Service (`auth/auth.service.ts`)
**What it does:** User login, sign up, password reset  
**Default behavior:** Uses Firebase Authentication  
**Fallback behavior:** Some local/dev fallback paths still exist in code for resilience and testing

**Usage:**
```typescript
import { authService } from '@/services';

const user = await authService.signIn({ email, name });
await authService.sendPasswordReset(email);
```

### 2. College Service (`colleges/college.service.ts`)
**What it does:** Find matching colleges, search, get details  
**Default behavior:** Uses live/cached college data and the College Scorecard-backed pipeline  
**Fallback behavior:** Some sample data can still appear if the live path is unavailable

**Usage:**
```typescript
import { collegeService } from '@/services';

const matches = await collegeService.getMatches({
  major: 'Computer Science',
  gpa: '3.8',
  location: 'Florida',
});

const results = await collegeService.searchColleges('Florida');
```

### 3. AI Service (`ai/ai.service.ts`)
**What it does:** Chat assistant, generate personalized advice  
**Default behavior:** Uses Google Gemini through the `geminiGateway` Firebase Function with server-side quota enforcement and usage logging  
**Fallback behavior:** Some canned/sample responses still exist for limited fallback paths

**Ranking reference:** [`../docs/product/COLLEGE_RANKING.md`](../docs/product/COLLEGE_RANKING.md) documents the deterministic `Base Score`, the final `Personalized Score`, and the current ranking and tie-break rules used by recommendations.

**Usage:**
```typescript
import { aiService } from '@/services';

const response = await aiService.chat('How do I write a college essay?');

const assistant = await aiService.chatAssistant({
  query: 'Which saved college looks strongest for transfer?',
  context: aiContext,
  topRankedColleges: rankedResults,
  outputFormat: 'text',
});

const tasks = await aiService.generateRoadmap(userProfile);
```

Structured chat context now lives in [`ai-context.service.ts`](./ai/ai-context.service.ts). Use `buildAiConversationContext(...)` to pass a versioned, sanitized JSON context into AI chat calls instead of hand-built prompt strings. The context intentionally excludes user email, uid, avatar, resume/transcript URLs, and document filenames while still including profile, questionnaire answers, saved colleges, and roadmap state.

The Firestore persistence contract for future chat history now lives in [`../constants/chat-history.ts`](../constants/chat-history.ts) and [`../docs/product/FIREBASE_CHAT_HISTORY_SCHEMA.md`](../docs/product/FIREBASE_CHAT_HISTORY_SCHEMA.md). Read/write helpers are intentionally deferred until the shared chat assistant architecture is finalized.

### 4. Storage Service (`storage/storage.service.ts`)
**What it does:** Upload/download resumes and transcripts  
**Default behavior:** Uses the current local/Firebase-backed storage flow  
**Fallback behavior:** Some local-only handling still exists for unsupported environments

**Usage:**
```typescript
import { storageService } from '@/services';

const file = await storageService.uploadResume(userId, fileUri);
const resume = await storageService.getResume(userId);
```

## Configuration

All API keys and settings are in [`config.ts`](./app/config.ts). The current config reads these environment variables:

```bash
# .env file (create from env.example)
EXPO_PUBLIC_FIREBASE_API_KEY=your_key_here
EXPO_PUBLIC_COLLEGE_SCORECARD_KEY=your_key_here
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=us-central1
EXPO_PUBLIC_AI_GATEWAY_FUNCTION_NAME=geminiGateway
```

Important:

- `EXPO_PUBLIC_USE_STUB_DATA` is legacy and is **not** used by the current app config
- if you see that variable in an old local `.env`, it does not currently switch the app into stub mode

Gemini itself is now configured server-side in [`../functions/.env.example`](../functions/.env.example), not in the client app env file. Versioned AI prompt templates now live in [`../functions/promptTemplates.js`](../functions/promptTemplates.js) so prompts stay reusable instead of being hardcoded across features.

## Configuring Real APIs

### Step 1: Get API Keys
1. **Firebase**: Create project at https://console.firebase.google.com
2. **College Scorecard**: Sign up at https://api.data.gov/signup/
3. **Gemini**: Get key at https://aistudio.google.com/app/apikey

### Step 2: Update Environment Variables
```bash
# Copy template
cp .env.example .env

# Add your keys to .env
EXPO_PUBLIC_FIREBASE_API_KEY=your_actual_key
EXPO_PUBLIC_COLLEGE_SCORECARD_KEY=your_actual_key
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=us-central1
EXPO_PUBLIC_AI_GATEWAY_FUNCTION_NAME=geminiGateway
```

### Step 3: Configure Functions Secrets and Limits

Copy `functions/.env.example` to `functions/.env.local` for emulator work, or set the same values in the deployed Functions environment:

```bash
GEMINI_API_KEY=your_actual_key
GEMINI_GLOBAL_DAILY_UNITS_LIMIT=250
GEMINI_AUTH_DAILY_UNITS_LIMIT=60
GEMINI_GUEST_DAILY_UNITS_LIMIT=12
```

### Step 4: Test Gradually

- verify Firebase auth and Firestore first
- then verify College Scorecard-backed requests
- then verify Gemini and Functions
- use cached/fallback behavior only as a safety net, not as the primary setup plan

## Benefits of the Current Setup

- **One real default path**: teammates are not guessing whether the app is in stub mode
- **Fewer env surprises**: old toggle variables no longer silently change behavior
- **Safer onboarding**: docs now match the actual config
- **Still resilient**: some services keep fallback handling for degraded environments

## Example: Using in a Component

```typescript
import { useState, useEffect } from 'react';
import { collegeService } from '@/services';

export default function HomePage() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadColleges = async () => {
      try {
        const matches = await collegeService.getMatches({
          major: user.major,
          gpa: user.gpa,
        });
        setColleges(matches);
      } catch (error) {
        console.error('Error loading colleges:', error);
      } finally {
        setLoading(false);
      }
    };

    loadColleges();
  }, []);
}
```

## Questions?

- each service file has implementation comments
- check `TODO` markers for planned integration work
- fallback/sample code still exists in some services, but it is no longer the documented default app mode
