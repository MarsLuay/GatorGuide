# API Services Setup Guide

## Overview

The `services/` folder contains the integration logic for Firebase, college data, AI, storage, notifications, and other app-level features.

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
1. **Firebase**: Create project at <https://console.firebase.google.com>
2. **College Scorecard**: Sign up at <https://api.data.gov/signup/>
3. **Gemini**: Get key at <https://aistudio.google.com/app/apikey>

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

## Questions?

- each service file has implementation comments
- check `TODO` markers for planned integration work
- fallback/sample code still exists in some services, but it is no longer the documented default app mode
