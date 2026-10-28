# Contract verification

Target edition: 17 October 2026. This replaces the former first-release exclusions with the full [product contract](CONTRACT.md). Each bullet is a buyer journey through an app, public API, CLI or authorized real provider connection. Status describes this source tree and the clause changes below; POLICY-002 incorporates ct’s 27 October 2026 approval with riders and remains partial; done/partial citations describe existing code/tests, and a target journey remains open wherever its gap says so. Real buyer-authorized vendor exports/accounts are required for migration and connector acceptance; synthetic fixtures and manually recorded references do not establish production interoperability.

Run touched product journeys with `pnpm run test:lanyard` and archive journeys with `pnpm run test:archive`. The existing CI remains the complete verification wall. Screens for implementation rounds use realistic US multi-site data at 1440px and 390px plus supported native devices; no UI behavior is changed by this documentation round.


Build/deploy never run tests; verification runs them explicitly.
