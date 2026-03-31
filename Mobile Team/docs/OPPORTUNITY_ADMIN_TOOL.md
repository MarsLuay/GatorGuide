# Opportunity Admin Tool

The app now includes a staff-facing Opportunity Admin editor at `/(tabs)/opportunity-admin`.

What it does:

- creates manual opportunity records without editing source files
- updates existing opportunity records in Firestore
- archives or restores records in the shared catalog
- deletes true manual-only records

How access is controlled:

- access is enforced in Firebase Functions, not Firestore client rules
- authenticated accounts must match one of these Functions environment variables:
  - `OPPORTUNITY_ADMIN_EMAILS`
  - `OPPORTUNITY_ADMIN_UIDS`

Examples:

```bash
firebase functions:config:set opportunity_admin.emails="staff@example.com,another@example.com"
```

Or with plain environment variables in your Functions deployment workflow:

```bash
OPPORTUNITY_ADMIN_EMAILS=staff@example.com,another@example.com
OPPORTUNITY_ADMIN_UIDS=someFirebaseUid
```

Notes:

- starter catalog entries are merged locally, so archive is the safest way to hide those from the live app
- delete is intended for manual-only records; starter-backed entries should be archived instead
- the editor is surfaced from the Resources tool list for signed-in users
