# Locale JSON

These per-locale JSON files are the source of truth for app copy. `services/app/translations.ts` loads them and exposes the flattened typed translation dictionaries used by the app.

Run `npm run i18n:generate` from `source/` to normalize these JSON files. Run `npm run i18n:check` to verify every locale has the English key set, translated strings do not contain common mojibake sequences, app `t("...")` usages point to real keys, and high-confidence user-facing UI strings are routed through translations.
