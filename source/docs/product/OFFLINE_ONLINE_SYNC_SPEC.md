# Offline/Online Sync Behavior Spec

Status: current implementation as reflected by the source client code on 2026-03-28.

This document describes what the app does today. It is not a future-state design.

## Scope

This spec covers:

- Durable local storage in `AsyncStorage` and local document copies under the Expo file system.
- Remote persistence in Firebase Auth, Firestore, Firebase Storage, and external API caches.
- Current conflict-resolution behavior when the same logical data exists locally and remotely.
- What happens when the app is offline, reconnects, signs in, signs out, or deletes an account.

## Local Persistence Inventory

### Sync-related business state

| Local key or pattern | What is stored | Synced remotely? |
| --- | --- | --- |
| `gatorguide:appdata:v1` | Core app snapshot: `user`, `questionnaireAnswers`, `notificationsEnabled`, `savedColleges` | Partially. Some fields later sync through feature-specific code; the snapshot itself is never uploaded as a single blob. |
| `gatorguide:saved-colleges:pending:${uid}` | Pending saved-college mutations for signed-in users | Yes. Replayed by saved-college reconciliation. |
| `gatorguide:notifications:managed:v1` | Scheduled local notification IDs and fingerprints | No. Device-local only. |
| `resume:${uid}` | Last uploaded resume metadata and resulting URL | Sometimes. URL may point to Firebase Storage or to a local file path. |
| `transcript:${uid}` | Last uploaded transcript metadata and resulting URL | Sometimes. URL may point to Firebase Storage or to a local file path. |
| `avatar:${uid}` | Last uploaded avatar metadata and local file URL | Not via a separate sync layer. The profile field may later be written to Firestore. |
| `roadmap:${uid}:${docType}` | Local metadata for roadmap document uploads | No dedicated file sync exists. Roadmap persistence may later write the local file URL into Firestore. |

### Derived caches

| Local key or pattern | What is stored | Freshness rule |
| --- | --- | --- |
| `college:v3:matches:*` | Cached college match results | 24 hour TTL |
| `college:v3:search:*` | Cached college search results | 24 hour TTL |
| `college:v3:details:*` | Cached college detail results | 24 hour TTL |
| `zip:geocode:${zip}` | ZIP to lat/lon lookup results | 3 day TTL |
| `ai:lastResponse` | Most recent chat response | No TTL; only used as fallback |
| `ai:lastResponseMap` | Signature-keyed chat responses | Max 50 entries |
| `ai:lastAssistantResponse` | Most recent assistant response | No TTL; only used as fallback |
| `ai:lastAssistantResponseMap` | Signature-keyed assistant responses | Max 50 entries |
| `ai:lastRoadmap` | Most recent AI-generated roadmap task list | No TTL; only used as fallback |
| `ai:recommend:factorCache:v1` | AI factor memoization for recommendation scoring | No TTL; bounded by max entry count |
| `ai:gateway:clientId:v1` | Stable local AI gateway client instance ID | No TTL |

### Local-only settings and helper state

These keys are local-only and are not part of cross-device sync:

- `settings:cache:autoClear30d`
- `settings:cache:lastClearedAt`
- `gatorguide:hasSeenStartup`
- `gatorguide:pending-account-data`
- `gatorguide:guestProfile:show`
- `gatorguide:guestRoadmap:show`
- `gatorguide:onboarding-debug-log:v1`

### Local file copies

The storage service also copies uploaded files into the Expo document directory under:

- `FileSystem.documentDirectory/gatorguide_docs/resume_${userId}/...`
- `FileSystem.documentDirectory/gatorguide_docs/transcript_${userId}/...`
- `FileSystem.documentDirectory/gatorguide_docs/avatar_${userId}/...`
- `FileSystem.documentDirectory/gatorguide_docs/roadmap_${userId}/...`

These copies are device-local. There is no general cleanup pass for them on sign-out or account deletion.

## Source of Truth by Data Surface

| Data surface | Local state | Remote state | Effective source of truth today |
| --- | --- | --- | --- |
| Signed-in identity | `gatorguide:appdata:v1.user` mirror | Firebase Auth | Firebase Auth |
| Guest identity | `gatorguide:appdata:v1.user` only | None | Local app state |
| Profile fields (`name`, `major`, `gpa`, `state`, `resume`, `transcript`, `avatar`, residency fields) | Local mirror in `gatorguide:appdata:v1.user` | Firestore `users/{uid}` | Firestore for signed-in users; local only for guests |
| Questionnaire answers | Local snapshot in `gatorguide:appdata:v1.questionnaireAnswers` | Firestore `questionnaires/{uid}` is written best-effort only | Local app snapshot |
| Notifications enabled flag | Local snapshot in `gatorguide:appdata:v1.notificationsEnabled` | None | Local app snapshot |
| Saved colleges | Local merged list plus pending queue | Firestore `users/{uid}/savedColleges/*` | Firestore for signed-in users, with explicit queued local mutations overriding until replayed |
| Roadmap | In-memory page state; no dedicated AsyncStorage roadmap cache | Firestore `roadmaps/{uid}` | Firestore for signed-in users; local derived state for guests |
| Resume/transcript file object | AsyncStorage metadata plus local file copy | Firebase Storage URL when upload succeeds | Firebase Storage URL if upload succeeded; otherwise only the local file path exists |
| Roadmap document attachments | AsyncStorage metadata plus local file copy | No dedicated remote file storage path today | Local file copy |
| College search/match/detail results | AsyncStorage cache | College Scorecard / functions | Remote API when reachable; cache is read-through fallback |
| ZIP geocode | AsyncStorage cache | `api.zippopotam.us` | Remote API when reachable; cache is read-through fallback |
| AI chat/assistant responses | AsyncStorage caches | Firebase Functions / Gemini | Remote AI output when reachable; cache is fallback only |
| AI recommendation factors | AsyncStorage memoization cache | Firebase Functions / Gemini | Remote AI output when reachable; cache is memoization only |

## Staleness Rules

- `gatorguide:appdata:v1` has no TTL. It is reused until overwritten, cleared, or partially refreshed by sign-in/session reconciliation.
- Signed-in profile data is refreshed from Firestore during sign-in.
- Signed-in saved colleges are refreshed and reconciled during sign-in and once on restored signed-in session startup.
- Questionnaire answers are not read back from Firestore on app start or sign-in. A stale or empty local questionnaire remains stale or empty until the user edits it locally.
- Signed-in roadmaps are loaded from Firestore when the roadmap page opens. There is no background roadmap sync outside that flow.
- College caches older than their TTL are treated as cache misses. The code does not serve expired college or ZIP cache entries as stale data.
- AI chat and assistant caches can serve a request-signature match as `cached`. If that fails, the app may fall back to the latest cached response as `cached-stale` and explicitly label it as stale.
- AI recommendation factor cache has no time-based expiry. Entries are reused as long as the context signature and college fingerprint still match.
- Cache auto-clear removes only derived search and AI cache keys. It does not clear core app state, saved-college queues, file metadata, or notifications state.

## Offline Write Behavior

### Profile edits

- Signed-in profile edits are effectively online-required.
- `updateUser(...)` writes Firestore first and only mutates local app state after the Firestore write succeeds.
- If the Firestore write fails offline, the edit is not committed locally and there is no retry queue.

### Questionnaire edits

- Questionnaire edits are local-first.
- `setQuestionnaireAnswers(...)` updates the local app snapshot immediately.
- The separate Firestore save to `questionnaires/{uid}` is best-effort.
- If the Firestore save fails, local answers stay updated, the error is logged, and there is no automatic retry.

### Saved colleges

- Saved-college add/remove is optimistic locally.
- For signed-in users, a failed save/remove is queued in `gatorguide:saved-colleges:pending:${uid}`.
- The UI keeps the local result immediately even if the remote write fails.

### Roadmap edits

- Guest roadmap edits are local-only for the current guest session state.
- Signed-in roadmap edits are effectively online-required.
- The roadmap page applies a signed-in change only after `roadmapService.saveUserRoadmap(...)` succeeds.
- If that save fails offline, the page keeps the previous roadmap state and there is no retry queue.

### File uploads

- Resume and transcript uploads first try Firebase Storage, then fall back to a local file copy plus AsyncStorage metadata.
- Avatar uploads always produce a local file copy plus AsyncStorage metadata.
- Roadmap document uploads always produce a local file copy plus AsyncStorage metadata.
- None of these flows maintain a later "upload when online" queue.

### Notifications

- The toggle is stored locally.
- Managed notifications are scheduled locally on the device from the local deadline field.
- If the app hydrates while notifications are enabled but OS permission is no longer granted, the app clears scheduled notifications and flips the local toggle back off.

## Reconnect and Conflict Resolution

### Saved colleges

Saved colleges are the only feature with an explicit reconciliation model.

- Remote Firebase data is the default source of truth for signed-in users.
- Local saved colleges are only promoted into Firebase when the sign-in flow explicitly asks for guest/local promotion.
- During guest-to-account promotion, if the same college exists both locally and remotely, the remote snapshot is authoritative and local data only fills missing fields.
- Pending local mutations are reduced to the latest mutation per college ID before reconciliation.
- Explicit queued local mutations override fetched remote state until they are replayed successfully.
- Removals are never inferred from a college being absent in local cache. This prevents stale local data from resurrecting remote deletions.
- Successful save/remove replay clears the pending mutation for that college.
- Sign-out keeps the per-user pending queue intact; account deletion clears it for the deleted user.

### Profile fields

- There is no offline profile queue and no field-level merge algorithm.
- The last successful Firestore write wins remotely.
- If two devices edit the same profile field, whichever write reaches Firestore last wins.
- The app does not detect or surface profile conflicts.

### Questionnaire answers

- There is no reconciliation path from Firestore back into local state.
- The local app snapshot is the version the UI actually uses.
- Firestore questionnaire documents can lag behind local state indefinitely.
- Cross-device questionnaire conflicts are therefore unresolved in practice: another device's questionnaire write does not automatically flow back into this client.

### Roadmap

- There is no roadmap merge algorithm.
- `saveUserRoadmap(...)` writes the full normalized roadmap document.
- The last successful roadmap write wins remotely.
- Offline signed-in roadmap edits do not enter any queue, so they are simply lost unless the user retries while online.

### File metadata and local-path fallbacks

- If a file upload falls back to local storage, later profile or roadmap saves can still persist that local file path into Firestore.
- Those local paths are device-specific and are not portable across devices.
- There is no later promotion step that replaces a local fallback path with a Firebase Storage URL once connectivity returns.

### Manual import/restore

- `restoreData(...)` replaces the local app snapshot immediately.
- Import does not automatically push the imported snapshot back to Firestore or Firebase Storage.
- Any later sync depends on the normal feature-specific flows.

## Sign-in, Sign-out, and Account Deletion

### Sign-in

- Sign-in loads the Firestore profile and reconciles saved colleges.
- Questionnaire answers are not pulled from Firestore during sign-in.
- On sign-up after guest use, `gatorguide:pending-account-data` can migrate guest profile fields and questionnaire answers into local signed-in state.
- Saved-college guest data is promoted during sign-in reconciliation, with remote-over-local precedence on overlap.

### Sign-out

- Sign-out clears `gatorguide:appdata:v1` and managed notifications.
- Sign-out does not clear:
  - saved-college pending queues
  - document metadata keys like `resume:${uid}` and `roadmap:${uid}:${docType}`
  - local file copies under `gatorguide_docs`
  - derived college and AI caches

### Account deletion

- Account deletion attempts to remove Firestore user data, roadmap data, questionnaire data, saved colleges, and Firebase Storage files under `users/{uid}/`.
- Local app state is cleared and the saved-college pending queue for that user is removed.
- Current code does not comprehensively purge all local AsyncStorage helper keys, derived caches, or local file copies.

## Current Limitations

- Questionnaire sync is one-way from device to Firestore. The app does not hydrate questionnaire answers from Firestore.
- Signed-in profile edits and roadmap edits are not offline-capable; failures are not queued.
- Saved colleges have the only real reconnect reconciliation path today.
- Roadmap document attachments are stored locally, not in Firebase Storage.
- Local file fallback URLs can be written into Firestore and may be unusable on other devices.
- Sign-out and account deletion do not fully clean every local cache and file copy.

## Recommended Reader Guidance

When changing sync behavior, keep these rules in mind:

- If a feature should work offline, it needs both a durable local write path and an explicit replay/reconciliation step.
- If a feature should work across devices, it needs a real remote source of truth and a corresponding hydration path on app start or sign-in.
- If a local fallback path is not portable, do not treat it as a cross-device source of truth.
