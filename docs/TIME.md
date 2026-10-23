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
