# Clock and timesheets

Staff capture worked time on their phone. A manager reviews each timesheet revision before its hours can go to payroll.

## Clock in and out

1. Sign in with your own staff identity and open **Time**.
2. Select **Clock in** when work starts.
3. When work finishes, enter your unpaid **Meal minutes**, then select **Clock out**.

Clocking out creates a submitted timesheet. It appears under the week in **Time**. The app displays dates in the venue time zone, including when your phone is in another time zone.

## Change job during a shift

While clocked in, choose another **Job** (and **Cafe**, when your profile lists more than one) beside **Clock out**, then select **Change job**. You stay clocked in; the clock shows what you are working now and each change. A punch starts on its shift's job and cafe. Lanyard refuses a job you are not qualified for (job, skills and certifications on your profile), a cafe not listed on your profile and, where a cafe limits its web clock to approved networks, a change from another network (or flags it for approval). Changes wait for an ended break and keep their original time if the connection drops.

At clock-out the punch becomes one timesheet split into job segments, which replace any work areas planned on the shift. Payable minutes are shared across segments by elapsed time (whole minutes, the earlier segment taking a tied remainder). Managers see each segment's job, cafe, hours, pay code (regular) and job rate; staff see their own segments without rates. Payroll files carry one row per job and cafe; a later correction exports only each segment's signed difference. Weekly overtime counts the whole punch, and an automatic approval rule always leaves a changed punch for a person.

## If the connection drops

The opened phone clock encrypts pending captures on this device, preserving their original times and command IDs across page closure or restart. You can clock in, time meal/rest breaks and clock out while disconnected. Reopen the app when connected and choose **Retry queued clock events**. Captures reconcile in order exactly once; **Clock history → Capture receipts** shows original and received times.

Read the pending and unresolved counts. Rejected captures stay encrypted on this device and are submitted for manager review when authority is available. If access was revoked, the next authorized manager signing in on this device sees a count-only notice and can submit those originals for review. The manager records missing or corrected time separately, then resolves the capture with a reason. Signing out warns before deleting your saved local originals and key; cancel to retain and sync them.

## Record missed time

A manager or the owner opens **Time**, then **Record worked time**. Choose the person, work start and end, meal minutes and a reason. Select **Prepare timesheet**.

The entry becomes submitted and still needs approval. Worked time cannot end in the future or overlap another current submitted or approved entry for the same person.

## Clock-in rules

The owner sets **Clock-in rules** in **People**, per cafe and optionally per position (a position's rule replaces its cafe's). **Early clock-in** allows any time, refuses a clock-in before the window (the phone shows when clock-in opens) or accepts it and flags it for approval. **Clock-in without a shift** is allowed, accepted pending approval (flagged) or refused. A clock-in belongs to the shift in progress, else the next published shift starting within 12 hours; with none it is unscheduled. Flagged time keeps the captured clock times, shows **Flagged** in **To approve**, and is paid only after a manager approves it on its own.

## Meal deductions

The owner can turn on **Meal deductions** in **People** for a cafe, such as 30 minutes on shifts over 6 hours. When someone clocks out of a longer shift without entering meal minutes, the clock asks **Did you take your meal?** A yes deducts the meal and keeps the answer. **No, I missed it** or **It was interrupted** pays the full time and flags the entry for a manager. No answer deducts the meal and flags it as unconfirmed. Entering meal minutes yourself replaces the deduction.

## Review and approve

Submitted time from every cafe waits in **To approve** at the top of **Time**. Check the person's day, clocked times, meal and source, then select **Approve**. Approval applies to that exact revision; a changed record needs a fresh review.

You cannot approve your own hours, including when you are a manager. Another manager or the owner must approve them.

To approve many at once, filter **To approve** by cafe, position, dates and state, then choose **Approve N shown**. States are **Clean** (the person's own clock, nothing flagged), **Edited** (a correction of approved hours), **Unconfirmed** (entered by a manager or agent) and **Exception** (flagged at capture). Lanyard approves exactly the revisions you saw: anything changed since, flagged, outside the filter or your own is skipped, and the result names each skip and why. Every approved entry records its own approval, as if you had approved it alone.

## Correct approved hours

On the latest approved entry, open **Correct**. Enter the corrected full work period and break, explain the change, then select **Prepare correction**. Keep the same person.

The correction needs its own approval. After approval, the earlier entry remains in history as superseded. Only one correction can be prepared against a revision; review an existing correction before preparing further changes.

If the old hours have already been exported, the next payroll export carries only the signed difference. For example, a correction from 480 to 450 approved minutes produces a difference of −30 minutes. Read [Payroll exports](PAYROLL.md) before sending a correction to your provider.

## Forgotten clock-outs

On **People**, the owner sets each cafe's clock-out rule: how many minutes after the scheduled end to remind, and the longest a punch may stay open. A punch still open at that point stops counting at the scheduled end (or at the longest punch when there was no shift), shows a reminder on the employee's **Time** screen and appears under **Provisionally closed** for managers. The reminder is shown in Lanyard only; no push or text message is sent.

The employee or a manager confirms the end or enters the real one. That submits the time flagged as a provisional close, so bulk approval skips it and a manager approves it on its own. Until then the punch is held out of payroll.

## Web time clock on approved networks

On **People**, under **Web time clock**, the owner can limit a cafe's clock-in and clock-out to its approved public IP ranges (one per line, such as `203.0.113.0/24`) and to browsers enrolled as that cafe's clock. Choose whether a punch from another network is refused or accepted and flagged; a flagged punch waits for a manager's single approval. To enrol the store computer, open **People** on that computer and select **Enrol this browser**; revoke it from the same card. Each punch records only the network address it came from and which approval matched.

## Punch photo notice and custody

When the work site's photo policy requires a still, read its notice and consent at each punch. The camera opens at the punch and stops immediately afterwards. A declined or unavailable camera keeps the punch with a named exception for review; bulk approval skips it. This does not compare faces. Current photo readers are the employee and owner; wider manager readers await policy confirmation.

Owners configure phone, browser and shared-kiosk requirements in **People → Punch photo custody**, with optional break photos, retention days and explicit approval. **Web time clock → Enrol this browser as a time clock** classifies a phone or browser clock using its revocable credential. The label is an employer classification, not hardware attestation. Unenrolled or revoked credentials use the stricter enabled setting; changing a user-agent does not bypass it. The native form uses the upcoming shift's work cafe, then the current cafe after a job/site transfer. A kiosk still needs employer photo consent at enrollment before a site requirement can collect images.

Photo-required native and kiosk captures use the encrypted offline queue. Reconciliation preserves their stills; a rejected or revoked capture sent for manager review omits image bytes and consent details. The owner can place a hold or explicitly erase only expired eligible images while keeping punch facts; nothing deletes automatically.


### Native punch location API

The native command API supports an initial geofence workflow. The owner explicitly saves a site circle with `geofence.save` and enrolls the clock device. With a site policy enabled, `clock.in` and `clock.out` accept a `location` object containing `latitude`, `longitude`, `accuracyMeters`, `observedAt`, `noticeSeen: true` and `consent: true`. An observation must be within one minute of the punch. A named `failure` may instead be `permission denied`, `unavailable` or `consent declined`, with no coordinates. Missing evidence keeps time with an exception. Standard phone controls do not yet request browser location; an enabled site therefore needs a native API client for coordinate capture.

The employee and owner can read the captured evidence. The owner sees each event, accuracy and outside flag beside time; bulk approval skips any location exception. `location.review` adds a reason without rewriting the event. `location.hold` requires a reason to place or release a hold; `location.erase` requires explicit consent, expired retained-policy days and no hold. Erasure removes coordinates while preserving captured time, flags and review history, and advances the archive fence. Nothing tracks between punches or deletes automatically. These conservative defaults await contract policy approval; broader supervisor access and dedicated controls remain open.


## Audit records

From **Payroll**, open **Audit records**, select a cafe and date range, and choose a recorded jurisdiction. The report combines retained schedule records, break exceptions and premium inputs, rounding, whole-workweek tip-credit checks, punch edits, minor exceptions and private leave sources. Each row names its source revision and links to the source screen. Download the same selection as CSV; the download is recorded in activity and leaves source records unchanged.

The owner reads all supported sources. Native managers read their own cafe, excluding private leave and fair-workweek previews; generic custom levels do not grant audit access. Personal contact details, birth dates, permits, private leave purposes and unrelated wage fields are excluded. Named audit grants are a separate explicit owner action.

An unassigned jurisdiction remains visible under a jurisdiction filter because the source has no jurisdiction tag. Empty categories remain explicit. Notice delivery, employee consent, incomplete policy outcomes, unrecorded minor checks, legacy in-place edits without retained history and preset-required retention remain incomplete. This report does not certify legal compliance or provider payment.

New manager edits retain the prior and resulting times and meal minutes, the reason, actor, timestamp and exact revisions. Approval and restart preserve this history. Older edits made before history capture remain explicitly incomplete.

Tip-credit rows show the complete workweek even when the date filter cuts through it. Owners also see the contributing cafes, setup revisions and approved time sources for mixed-cafe weeks. These are shared whole-week totals, so do not add them across cafe reports. Native managers exclude mixed-cafe weeks. Dates outside the selection are context for that workweek, not additional period earnings.


## Retain a reviewed audit copy

The Audit records page and `GET /api/lanyard/audit` show current retained sources. An owner can preserve an exact reviewed report by sending `audit.retain` to `POST /api/lanyard/command`, with the same `site`, `from`, `through` and `jurisdiction`, the report's `sourceVersion`, a `reason` and `consent: true`. A changed source version refuses the request; review the report again before retrying. Oversized copies refuse before writing; choose a shorter report period. The resulting record includes the complete report, its original CSV, source revisions, authorization and integrity digests.

The owner reads that immutable copy at `GET /api/lanyard/audit-packets/ID` and downloads its original bytes at the same path with `.csv` appended. Later source corrections do not rewrite it. Installation archives carry retained copies; restore still requires fresh native sign-in. Staff, managers, custom levels and preparation keys cannot read these copies, including through state snapshots. Downloading does not grant an auditor access.

The ct ruling of 27 October 2026 approves this owner-only preservation floor. Authorization is bound into a packet digest along with original report and CSV digests; inconsistent content refuses both read and download. Storage remains indefinite with no automatic expiry or erasure. This is technical custody, not blanket lawful retention. Maintained minimum review dates and independent holds are available under PRIVACY-001; complete eligible disposition remains open. Disconnected downloads and old archives require separate external handling.


## Named read-only audit API

The owner invites a dedicated named audit identity through the existing People invitation. Send `access.audit.grant` to the native command API with `staffId`, `businessId`, `site`, explicit `employeeIds`, `jurisdictions`, `classes`, inclusive `from` and `through`, `purpose`, `endsAt`, `wages` and `consent: true`. The site must belong to that business. Supported classes are schedule, breaks, rounding, tip-credit, punch-edit and minor-exception. Private leave and policy previews remain owner-only. Tip-credit access additionally needs `wages: true` and a separate `sensitivePurpose` reviewed by the owner. An unknown jurisdiction is named `unassigned`; it is never inferred.

Give the authenticated reader the grant identifier. They request `GET /api/lanyard/audit` or its `.csv` variant with `grantId`, `site`, `from`, `through` and one permitted `jurisdiction`. Optional `staffId` and `reportClass` narrow the grant. Every read and download rechecks the current grant and records the reader and scope. Foreign business or site, employee, jurisdiction, class and date requests refuse. A wage workweek is excluded if any contributing site, source or date falls outside the grant. Retained owner packets keep their separate owner boundary.

Audit identities cannot use operational screens, state, credential administration or mutation commands, including after grant expiry or revocation. Use a dedicated identity rather than converting a working operator account. `access.audit.revoke` takes `id`, exact `revision` and `reason`; the active reader's next request fails. The reader opens `/app/audit` with the same query. The existing report screen preserves the grant when filtering or downloading and exposes only the permitted projection. Grant administration is currently through the API.
