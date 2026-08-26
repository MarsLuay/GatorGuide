# Architecture

- Gator Guide is a student-focused transfer-planning app for Green River College students targeting undergraduate programs at UW Seattle, UW Bothell, or UW Tacoma. The application source lives under `source/`.
- The app is Expo/React Native with Expo Router. The package entry is `expo-router/entry`; route files live in `source/app/`, page experiences in `source/components/pages/`, shared UI in `source/components/ui/`, app state in `source/hooks/use-app-data.tsx`, services in `source/services/`, and planner tooling in `source/scripts/planner/`.
- Primary navigation is Transfer Planner, Resources, Calendar, and Profile. Route metadata centralizes primary tabs, hidden legacy surfaces, aliases, and return destinations in `source/constants/routes.ts`.
- Planner data is organized around official Green River and UW requirements: source-family adapters normalize documents into a Requirement Model before validation and planner-data generation. Accepted updates require source audits, invariants, pathway fixtures, regression tests, and planner verification; otherwise the last-known-good dataset remains active.
- Localizations are generated before runtime into static locale bundles. The product does not depend on runtime translation or runtime generative AI for interface copy.
