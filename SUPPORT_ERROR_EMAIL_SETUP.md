# Support Error Email Setup

This sends client error logs and support chat messages automatically to:
- `gatorguide@outlook.com`

## 1) Install Firebase CLI and login

```bash
npm i -g firebase-tools
firebase login
```

## 2) Install function dependencies

```bash
cd functions
npm install
cd ..
```

## 3) Configure email provider secrets (Resend)

Required:
- `RESEND_API_KEY`

Optional:
- `SUPPORT_FROM_EMAIL` (must be a verified sender/domain in Resend)

PowerShell:

```powershell
$env:RESEND_API_KEY="YOUR_RESEND_API_KEY"
$env:SUPPORT_FROM_EMAIL="errors@yourdomain.com"
```

## 4) Deploy Cloud Functions

```bash
firebase deploy --only functions:sendSupportErrorLog,functions:sendSupportMessage
```

Default function URL expected by app (already set as fallback):

`https://us-central1-gatorguide.cloudfunctions.net/sendSupportErrorLog`

If your project/region differs, set:

```env
EXPO_PUBLIC_SUPPORT_ERROR_LOG_WEBHOOK=https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendSupportErrorLog
EXPO_PUBLIC_SUPPORT_MESSAGE_WEBHOOK=https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendSupportMessage
```

## 5) Verify

1. Trigger an app error and tap `Send error log to support`.
2. Open Home support widget and send a message.
3. Confirm both emails arrive in `gatorguide@outlook.com`.

## Notes

- Endpoint currently has no auth (as requested).
- You can add auth/rate-limit later if abuse appears.

