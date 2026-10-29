# Personal language in the native staff journey

Open the account menu, choose **Settings**, then save **My language** as English or US Spanish. This changes your own native schedule, shift confirmation, swaps, pickup requests, timesheet review and browser clock. The shared clock uses the same saved preference after personal verification and clears the previous employee's controls on sign-out. Managers cannot use this personal setting to change somebody else's preference.

Authored shift labels, messages, notes and reasons keep their original language. Configured clock questions use the wording supplied for the selected language. If an employer has not supplied Spanish wording, the question explicitly identifies its original wording rather than presenting it as a translation. Captures keep their original identity, timestamps and answer values when connectivity returns.

This is a limited native journey. Native mobile distribution, physical-device acceptance, other staff surfaces, manager-set preferences, delivered notices and calendar localization remain open in `LANG-001` in [the contract](../CONTRACT.md). A pending local capture is not accepted time or delivered notice.

## Maintaining first-party strings

The shared catalog is `./src/lanyard/staff-catalog.json`. Render literal markup with the `html` tag from `./src/lanyard/localization.ts`, and translate standalone labels with its `t` function. Photo and location consent notices, browser capture failures and named capture exceptions share this catalog. Original command identifiers and exception facts stay in the records; time review uses localized labels. Literal text is translated before interpolated records are inserted; authored data is never looked up as a catalog key. Placeholder names must match in both languages. Browser clients use the same catalog and template implementation through `./public/staff-language.js`.

`node scripts/check-staff-strings.mjs` enumerates the native journey's renderer functions and browser clients. It refuses missing Spanish, mismatched placeholders, unmarked markup and untranslated helper labels and imported photo and location consent notices within that inventory. Both build commands run this check before compiling. Extend the explicit inventory when adding another supported surface; this scoped check does not establish the complete staff-string guarantee in LANG-001.
