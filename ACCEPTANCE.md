# First release

- The owner signs in, adds staff or imports inactive staff from Staff CSV v1, previews and applies the import, reads its journal, undoes untouched rows, and explicitly enables and invites staff.
- Staff record availability and request leave; a manager decides leave and publishes a conflict-free weekly roster, which staff see and confirm.
- Staff clock in and out on a phone, including retrying a queued capture without duplication. A manager reviews hours, prepares missed time or a correction, and approves the exact revision with history retained.
- A manager reviews approved hours, exports each revision once as a payroll CSV, downloads the same file again, and records the provider acknowledgement. Later corrections export only the difference in hours.
- An agent reads preparation context and prepares rosters, timesheets and payroll drafts; a person alone publishes, approves and exports, with decisions recorded.
- The owner backs up and restores installation data with `rer export` / `rer import`, revokes staff and agent access, and erases an unused, uninvited, never-imported staff identity with an archive restore fence.

Not needed: award interpretation, pay calculation, STP, tips, GPS, biometrics, shift swaps, automatic provider submission, multi-venue scheduling, a custom domain or the next design stage. Employment-history erasure is outside this release; deactivate worked or invited staff and retain their records. The importer is a documented format, not a verified vendor export adapter.

The public run site presents Lanyard, opens `/run` for installation, and builds
its owner guides at `/docs` from repository Markdown. An installed `/` remains
the Lobby, reflecting the durable owner claim before first-run confirmation.
