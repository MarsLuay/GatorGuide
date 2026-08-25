# Known failures

- The bounded docs preflight is currently blocked because the project has no `docs/source-of-truth/README.md` and no `.docs-nav.json`. This pass did not create those navigation artifacts because its scope is limited to the canonical project-memory files.
- Static analysis has an accepted generated planner metadata import cycle at the code-generation boundary. The source maintainer guide treats it as a known artifact, with planner contract checks as the verification boundary.
- Security scanning still reports React Native, Jest, and Istanbul toolchain advisories, including `js-yaml`; the source maintainer guide attributes the remaining findings to the Expo SDK 54 and React Native 0.81.x toolchain and says clearing them requires a coordinated major upgrade.
- No app, planner, or runtime checks were run in this memory-only pass; current test status beyond the documented findings is therefore unverified.
