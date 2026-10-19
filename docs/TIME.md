# Clock and timesheets

Staff capture worked time on their phone. A manager reviews each timesheet revision before its hours can go to payroll.

## Clock in and out

1. Sign in with your own staff identity and open **Time**.
2. Select **Clock in** when work starts.
3. When work finishes, enter your unpaid **Meal minutes**, then select **Clock out**.

Clocking out creates a submitted timesheet. It appears under the week in **Time**. The app displays dates in the venue time zone, including when your phone is in another time zone.

## If the connection drops

Keep this browser page open. The clock retains the event's original capture time and command ID when a request fails. After reconnecting, use **Retry queued clock event** when it appears. The same capture keeps its identity, so retrying it cannot record duplicate time.

Read the clock status before starting another event. This is a retry queue for clock captures, not a fully offline app. If the browser was closed or a clock capture cannot be accepted, ask a manager to record the missed time.

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
