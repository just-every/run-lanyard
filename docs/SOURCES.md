# Foundation and reuse

Generated and composed from [Base fc0e1041](https://github.com/runeditrun/base/tree/fc0e1041efa55771142bbb57c4ab4743147e264d) as workforce/lanyard. The locked package supplies CLI operations; copied Base modules supply native auth, themes and import-kit. `composition.lock.json` records generated source. Import-kit retains original bytes, fingerprints and journals through a native staff adapter.

MIT patterns copied and adapted:

- [Willow leave](https://github.com/just-every/run-willow/blob/e1da1b9933905f6b1d4732f6e8bdd1f0d104e937/src/willow/leave.ts): explicit decisions and correction history.
- [Willow payroll](https://github.com/just-every/run-willow/blob/e1da1b9933905f6b1d4732f6e8bdd1f0d104e937/src/willow/payroll.ts): reviewed batches, unique claims, immutable files and acknowledgement.
- [Gauge time](https://github.com/just-every/run-gauge/blob/89dad1e9e7bcb6baaa621931fccfdfa20d3c595a/src/gauge/time.ts): revision-bound approval and corrections.
- [Glove field capture](https://github.com/just-every/run-glove/blob/778474d80bf5f440b42fb8f3364a191908d0e4b9/src/glove/commands/field.ts): device time, stable retries and atomic event/command commits.
- [Dial calendar conflicts](https://github.com/just-every/run-dial/blob/0f17a8522556bcae29cc45e7f1ef15e2647c67f2/src/core/features/bookings/calendar-conflicts.ts): fenced state transitions. Lanyard's availability/overlap rules are new; that source handles calendar restoration conflicts.

Package-mode examples: [Coaster](https://github.com/just-every/run-coaster), [Beam](https://github.com/just-every/run-beam), [Pier](https://github.com/just-every/run-pier). Sibling repositories were not edited. Market research is outside public source.

Demo adoption pins the package and every copied module to Base `rer-v0.2.22`
(`1ce15dd8cbb7c8cf2d83ebfde2b4a8a130ff9d74`). `base-copies.json`, produced by
Base’s `record-base` flow, records those copies; historical foundation files and
applied migrations retain their original `composition.lock.json` provenance.

## Hosted demo runtime refresh

All vendored runtime modules in `src/modules` (ai, d1-transport, demo, dependencies, import-kit, mail, operator-auth and owner-claim) were refreshed together from `runeditrun/base` tag `rer-v0.2.30`, commit `d434ea67989fe10b6ddff01daba8bb350975e54a`, with `refresh-base`. Authoring tests and proof scripts are not shipped. `src/modules/dependencies/logout.mjs` keeps Lanyard's claim-key fence check and is held outside `base-copies.json` until Base carries that fix. The original composition lock records the seed assembly; this refresh uses package-mode `@runeditrun/rer` 0.2.30.

## Shared agent-door source

`src/modules/agent-door`, `src/modules/business-settings` and their theme/icon
dependencies are copied from immutable Base commit
`d555e789cffb744a9f83d76ebe42a2e3bdd7a055`. `base-copies.json` records the
source paths, modes and byte digests. Migrations `0027_agent_door.sql`,
`0028_business_settings.sql` and `0029_business_people.sql` add the shared
stores without changing applied migration history.

These source copies do not enable company-agent access. The production Worker
still uses Lanyard's existing native sessions and preparation API. Native
adapters, the declared workforce registry and integrated conformance are
required before the shared door can be advertised as supported.
