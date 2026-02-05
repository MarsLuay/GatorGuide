# API Services Setup Guide

## Overview

The `services/` folder contains all API integration logic for GatorGuide. Each service has **stub implementations** that work now, and **TODO markers** for real API integration later.

## Current State: Stub Mode

By default, all services run in **stub mode** (fake data, no API calls). This lets you:
- Build and test UI without API keys
- Develop features without internet connection
- Avoid API rate limits during development
- Switch to real APIs when ready

## Services

### 1. Authentication Service (`auth.service.ts`)
**What it does:** User login, sign up, password reset  
**Stub behavior:** Returns mock user data immediately  
**Real API:** Firebase Authentication  

**Usage:**
```typescript
import { authService } from '@/services';

// Sign in (works now with stub data)
const user = await authService.signIn({ email, name });

// Password reset (logs to console in stub mode)
await authService.sendPasswordReset(email);
```

### 2. College Service (`college.service.ts`)
**What it does:** Find matching colleges, search, get details  
**Stub behavior:** Returns 3 mock Florida colleges  
**Real API:** College Scorecard API (via Firebase Function)  

**Usage:**
```typescript
import { collegeService } from '@/services';

// Get college matches (returns 3 stub colleges now)
const matches = await collegeService.getMatches({
  major: 'Computer Science',
  gpa: '3.8',
  location: 'Florida',
});

// Search colleges
const results = await collegeService.searchColleges('Florida');
```

### 3. AI Service (`ai.service.ts`)
**What it does:** Chat assistant, generate personalized advice  
**Stub behavior:** Returns pre-written responses based on keywords  
**Real API:** Google Gemini (via Firebase Function)  

**Usage:**
```typescript
import { aiService } from '@/services';

// Chat with AI (returns canned responses now)
const response = await aiService.chat('How do I write a college essay?');

// Generate roadmap tasks
const tasks = await aiService.generateRoadmap(userProfile);
```

### 4. Storage Service (`storage.service.ts`)
**What it does:** Upload/download resumes and transcripts  
**Stub behavior:** Saves filenames to AsyncStorage  
**Real API:** Firebase Storage  

**Usage:**
```typescript
import { storageService } from '@/services';

// Upload resume (saves stub reference now)
const file = await storageService.uploadResume(userId, fileUri);

// Get uploaded resume
const resume = await storageService.getResume(userId);
```

## Configuration

All API keys and settings are in `services/config.ts`. It reads from environment variables:

```bash
# .env file (create from .env.example)
EXPO_PUBLIC_USE_STUB_DATA=true  # Set to false when APIs ready
EXPO_PUBLIC_FIREBASE_API_KEY=your_key_here
EXPO_PUBLIC_COLLEGE_SCORECARD_KEY=your_key_here
```

## Switching to Real APIs

### Step 1: Get API Keys
1. **Firebase**: Create project at https://console.firebase.google.com
2. **College Scorecard**: Sign up at https://api.data.gov/signup/
3. **Gemini**: Get key at https://aistudio.google.com/app/apikey

### Step 2: Update Environment Variables
```bash
# Copy template
cp .env.example .env

# Add your keys to .env
EXPO_PUBLIC_USE_STUB_DATA=false
EXPO_PUBLIC_FIREBASE_API_KEY=your_actual_key
EXPO_PUBLIC_COLLEGE_SCORECARD_KEY=your_actual_key
```

### Step 3: Implement Real API Calls
Each service file has `TODO` comments showing exactly where to add real API code:

```typescript
// Find this in auth.service.ts
if (isStubMode()) {
  // Stub implementation (currently running)
  return mockData;
}

// TODO: Replace this with real Firebase code
// Uncomment and implement:
// const auth = getAuth();
// const userCredential = await createUserWithEmailAndPassword(...);
```

### Step 4: Test Gradually
You can test real APIs one at a time:
- Keep other services in stub mode
- Only implement the service you're testing
- Switch back to stub mode if issues arise

## Benefits of This Approach

✅ **Build UI now, APIs later** - No blocking on API setup  
✅ **No breaking changes** - Same function calls, different data source  
✅ **Easy testing** - Toggle stub mode on/off instantly  
✅ **Secure** - API keys in environment variables, not code  
✅ **Team-friendly** - Others can develop without your API keys  

## Example: Using in a Component

```typescript
// components/pages/HomePage.tsx
import { useState, useEffect } from 'react';
import { collegeService } from '@/services';

export default function HomePage() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadColleges = async () => {
      try {
        // This works NOW with stub data
        // Will automatically use real API when you configure it
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

  // Rest of component...
}
```

## Next Steps

1. **Now**: Use stub services to build all your UI and features
2. **Later**: Get API keys from Firebase, College Scorecard, Gemini
3. **Then**: Follow TODO comments to implement real API calls
4. **Finally**: Set `EXPO_PUBLIC_USE_STUB_DATA=false` and test

## Questions?

- Each service file has detailed comments
- Check `TODO` markers for implementation hints
- All services return the same data types (stub or real)
