# Staff CSV move-in

Lanyard staff CSV v1 is a **documented format**, validated with synthetic examples only. No real export was supplied. It makes no Deputy, Homebase, When I Work or payroll-provider compatibility claim.

An active native owner can preview and import 1–100 staff rows, up to 100,000 UTF-8 bytes. Imports create inactive staff records with role `staff`. Importing does not invite anyone, create an operator, grant access, activate a person or send a message. The owner explicitly activates a staff record afterwards through staff management.

## File format

Use UTF-8 CSV with these exact headings in this order:

```csv
staff_id,name,email,payroll_id
staff-001,Alex Example,alex@example.test,EMP001
staff-002,"Casey, Example",casey@example.test,
```

- `staff_id`: a stable identifier, 1–100 ASCII letters, digits, hyphens or underscores. Keep it stable across exports.
- `name`: required, up to 200 characters.
- `email`: required, up to 254 characters, normalized to lowercase. It links active staff to their signed-in identity later.
- `payroll_id`: optional provider employee identifier, up to 100 characters. Blank means absent; resolve it before exporting that person's hours.

CSV supports CRLF/LF, quoted commas, doubled quotes and quoted line breaks. A UTF-8 BOM is accepted. Values are trimmed. Duplicate staff IDs, normalized emails or nonblank payroll IDs reject the whole file. Invalid columns, invalid records, empty imports and oversized files fail before creating a journal. No row is silently dropped.

## Preview and apply

`import.preview { csv }` performs SELECT-only dry run planning and returns:

```text
{ fingerprint, counts, diagnostics, staff, conflicts }
```

The preview lists inert target staff values and existing staff/erased-identity conflicts. Existing records are never overwritten. The same retained source identity may be recognized as an earlier import; a changed source identity payload or later native edit produces a conflict.

`import.apply { csv, fingerprint }` requires the exact CSV and the fingerprint shown in the preview. Changed bytes, even whitespace, change the fingerprint. The reviewed plan is bound to the creating owner's operator ID. Source bytes, rows, hashes, row locations, mapping version, effects and provenance are retained in the same D1 store as the native staff records. Job creation is idempotent for the same reviewed fingerprint.

Apply returns `{ job }`. A request applies at most ten staff rows. While `job.state` is `applying`, call `import.resume { jobId: job.id }` in another request until it is `completed`. This resumes the retained plan without parsing or downloading the source again. Each publication atomically checks current active-owner authority, the job checkpoint, exact target snapshots and erased-identity tombstones. It also advances the domain version. There are no automatic background retries.

If an apply fails after earlier batches committed, open its journal. Resolve the conflict before explicitly resuming. `import.rollback { jobId }` reverses partial application; follow `import.resume` while the job is `rolling_back`.

## Journal and undo

`import.journal { jobId }` returns `{ job, originals, batches }`. Originals contain the exact retained CSV bytes in base64 with hashes and custody status. Treat this response as personal data and restrict it to the owner. Job operations are bound to their creating operator; another owner cannot take over that job.

`import.undo { jobId }` reverses a completed import in bounded batches. Follow `import.resume` while its state is `undoing`. Rollback and undo retain the source journal and original bytes as history.

Undo compares every staff field, native version and import revision. Activation, editing, erasure or dependent work causes a conflict and preserves the native record. Staff with availability, leave, shifts, clock events, timesheets or payroll batch lines cannot be removed. The import cannot overwrite existing native staff. Undo does not silently discard later work.

## Erasure and archive custody

Undo does **not** erase personal data from retained source CSVs or journal before-images. The current staff-erasure flow refuses imported identities, including retained historical provenance. It is limited to unused, uninvited, manually created staff. Do not present import undo as privacy erasure.

A future erasure flow for imported staff must use Base's `retireD1ImportCustody` with native erasure and the portability redaction checkpoint in the same atomic publication. Affected original CSV artifacts must be withdrawn whole; they cannot be rewritten and represented as originals. Restores must fence pre-erasure archives and new imports must reject tombstoned identities.

## Integration

`src/lanyard/movein/index.ts` exports `importCommand(db, actor, name, input)`. Root request handling authenticates sessions and enforces origin checks. This module checks `actor.role === 'owner'` and rechecks `oa_operators` for the active native owner in every kit transaction. Errors expose `code`, `status` and a safe message.

The native adapter targets `l_staff`, retaining kit revisions in `l_import_staff_revisions`. It fences all current staff fields and dependency presence in `l_records`; it refuses erased email hashes in `l_erasure_journal`. Migration `0015_import_kit.sql` contains Base's D1 schema exports in initializer order plus the staff revision sidecar. Runtime import-kit source is copied from Base without modification; upstream test and proof directories are excluded from this edition.
