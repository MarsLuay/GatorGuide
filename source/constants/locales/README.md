# Generated Locale Snapshots

`services/app/translations.ts` is the source of truth for app copy because it has the most complete language coverage.

Run `npm run i18n:generate` from `source/` to regenerate these JSON snapshots. Run `npm run i18n:check` to verify generated files are current, every locale has the English key set, translated strings do not contain common mojibake sequences, app `t("...")` usages point to real keys, and high-confidence user-facing UI strings are routed through translations.
