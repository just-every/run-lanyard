# Employee data requests

The owner uses the authenticated human command door, `POST /api/lanyard/command`,
with a matching application Origin. Bearer agents, managers and employees cannot
administer these requests. Record the request authorization in `reason`; use
`consent: true` only after reviewing it. Nothing runs automatically.

Each JSON body has `name` and `input`. The supported commands are:

- `privacy.export`: `staffId`, `reason`, `consent`. Returns versioned employee JSON,
  including that person's employment identity, shifts, punches, timesheets,
  payroll lines and current employee-visible journal notes. Private notes and all
  earlier note versions are excluded. An inactive former employee is supported.
  Shared conversations, logbook records and import originals need separate review;
  omissions are listed in the result. Existing authorized download doors serve
  attachment and photo bytes. The command journal retains an export receipt,
  rather than a second copy of the employee export.
- `privacy.retention`: `type`, `days`, `reason`, `consent`, and the current `revision`
  when editing. Supported types are `history`, `notes`, `attachments`, `location`
  and `photos`. Days are elapsed periods of 24 hours. Notes use the end of their
  declared record date in UTC. Photo and location review periods supplement the
  existing site or capture policy: the longer period applies. These are owner
  review settings, not a statement of statutory minimums.
- `privacy.hold`: `staffId`, `type`, `hold` as a boolean, `reason`, `consent`, and
  the current `revision` when editing. Holds and releases keep their history.
  Photo and location holds also fence their existing erasure commands.
- `privacy.review`: `staffId`. Returns current retention settings, that person's
  holds and retained disposition receipts. Every request is audited.
- `privacy.erase`: `staffId`, `type`, `reason`, `consent`. Requires deactivation
  and an explicit retention setting. For `history` it returns a retained
  disposition; employment, punch and payroll facts remain restricted. For
  `notes` and `attachments` it removes expired journal content or files,
  including earlier versions and saved command copies. A hold prevents erasure.
  Note deletion also respects attachment retention. Erased notes cannot be
  edited back into existence. The result lists erased and retained records.
  For photos and coordinates use `photo.erase` and `location.erase` under their
  existing policy and consent checks.

Erasure advances the installation archive fence. Supply a later archive as the
journal when restoring an older one; a fenced older archive is refused. Restore
from the later archive to keep held history without the erased content. See
[backup and restore](BACKUP-RESTORE.md). Erasure cannot recall downloaded exports,
offline archives, external messages or provider copies. Protect and retire old
local copies and send a separately authorized request to each external custodian.

This is a partial implementation of PRIVACY-001. Chat and logbook retention,
import originals and connector dispositions, complete employee export coverage
and statutory retention minimums remain open. The conservative owner-only policy
and explicit retention review defaults await contract policy approval.


## Record minimum review and independent holds

The native owner can use `privacy.recordDuty` for a supported source record or retained audit copy. Supply `sourceKind`, `sourceId`, current `sourceRevision`, `preset`, explicit `applicability` (`applies`, `does-not-apply` or `unknown`), the reviewed date `anchor`, `reason` and `consent: true`. Updating an existing duty also needs its `id` and exact `revision`. The anchor cannot precede the covered record. California hours and wages additionally need a later reviewed `employmentThrough`; unresolved employment-duration duties remain unknown. No command infers legal applicability.

The maintained minimum review presets are `federal-payroll` (three years), `federal-wage-computation` (two), `chicago-fair-workweek` (three), `chicago-paid-leave` (five), `california-hours-wages` (three) and `california-sick-leave` (three). Each retained duty records its source, effective date, applicability, anchor and authorizing owner. Longer applicable obligations control. These are minimum review inputs, not a complete national retention schedule or permission to delete.

`privacy.records.review` takes `sourceKind` and `sourceId`. It returns the longest applicable date, unresolved sources, independent holds and whether a later review is due. A retained copy inherits its referenced sources' duties and holds, so a shorter copy duty cannot shorten a source duty. Unknown applicability blocks review eligibility. Disposition remains explicitly unsupported even after all minimum dates have elapsed.

`privacy.hold` accepts an optional `caseId` to keep separate matters independent. Release a particular case at its exact revision; another active case still blocks the covered employee's source and copy review. Release never initiates deletion. Existing erasure doors also check all applicable holds. Supported installation archives preserve duties, holds, exact evidence and authorization; fresh sign-in is required after restore. Employee requests, local derivatives, disconnected copies and provider handling still need the separate reviewed fulfillment described above.
