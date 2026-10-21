# Payroll exports

Lanyard exports approved hours as CSV for your existing payroll process. Review the file and map its columns to your provider before using real staff data. Lanyard does not calculate wages or submit payroll for you.

## Prepare approved hours

1. In **People**, check every included person's payroll ID. Each person needs one before their hours can be exported.
2. In **Time**, approve the timesheet revisions you intend to include.
3. Open **Payroll**. **Prepare payroll** lists approved, unexported hours as a pay-week ledger: one row per person and week with hours by day. Keep the rows you intend to include ticked and select **Prepare batch**. The newest batch is listed first.
4. Review the batch's ledger of included time and open its **CSV** to read the exact file.

Preparing a batch does not export or submit it. If the source timesheet, payroll ID or correction changes before export, prepare a new batch and review it again.

## Review the exact file

The CSV contains these columns, in this order:

```csv
payroll_id,time_id,revision,start_utc,end_utc,minutes,hours,corrects
```

`start_utc` and `end_utc` use UTC, while the app displays venue time. `minutes` is the amount exported by this line; `hours` expresses the same amount to four decimal places. `corrects` identifies the earlier timesheet for a correction.

Confirm the people, identifiers, dates and amounts. Review negative correction lines with your provider's import process before uploading them.

## Export and download

Tick **I reviewed this CSV and approve exporting this revision**, then select **Export reviewed CSV**. A manager or the owner makes this decision for the exact batch revision.

Select **Download exported CSV**, then import that file into payroll once. Re-downloading returns the same bytes and does not create another batch. The displayed SHA-256 identifies the exported file; downloads check its integrity.

Lanyard prevents the same approved timesheet revision being exported twice inside the app. It cannot prevent someone uploading the downloaded file twice to an external provider. Keep your own record of the file you submitted.

## Record provider acknowledgement

After your provider accepts the file, open **Record provider acknowledgement**, enter its reference and select **Record acknowledgement**. Downloading or exporting alone does not mark a batch acknowledged. This step records the reference you supply; it does not contact the provider.

## Export a correction

Prepare and approve the correction in **Time**, then prepare a new payroll batch. The line carries only the positive or negative difference from hours already exported for that timesheet's history. It does not resend the whole corrected duration.

An unresolved correction blocks export of its earlier source. Finish reviewing the correction, then prepare payroll from the resulting approved time. Earlier exports stay available with their original bytes and history.

Payroll sibling: [Envelope](https://github.com/just-every/run-envelope).

## Tip credit and make-up pay

Where a cafe pays tipped employees a cash wage below the minimum wage and takes a tip credit, the owner sets it up in **Payroll → Tip credit**: the cafe, its state, the minimum wage that applies there and the jobs whose work produces tips, effective from a date. You enter the minimum wage; Lanyard keeps no state or local minimum wage rates. A later minimum wage is saved from its own date and earlier weeks keep theirs. California, Washington, Oregon, Nevada, Minnesota, Alaska and Montana bar a tip credit, so a setup there is refused.

Each employee's configured workweek (Monday to Sunday for people without a pay group) Lanyard checks every person with approved time in a tipped job at such a cafe: their tipped minutes at the cafe's minimum wage against the same minutes at their own job rate plus the cash tips they declared at clock-out. A shortfall is a make-up pay input for that person and week. Download a week's inputs and add them in your payroll provider; Lanyard does not pay them or add them to a payroll batch. Time in the cafe's other jobs, such as side work recorded with **Change job** on the phone clock, is listed as non-tipped duty time so you can apply your own reviewed dual-jobs treatment. The owner reads every check; a manager reads the people of their own cafe.

## ACA hours for the filer

The owner defines a variable-hour measurement group in **Payroll → ACA hours measurement**. Choose 3–12 complete calendar months, the administrative end (0–90 days later), and the stability end. The report separates the monthly 130-hour test from the standard look-back average of 30 hours per elapsed seven-day week. It counts current approved payable hours at every cafe and lists waiting time and corrections separately.

Record paid non-work service from the employer’s records with a unique reference and reason. These credits are separate from punches, payroll earnings and leave balances. Correct the exact credit instead of duplicating it; zero minutes removes its contribution while keeping the prior versions. No provider has verified these manually entered facts.

The report shows its source revisions, service and planned hours, stability dates and status. Future published shifts can raise a schedule warning; draft review replaces that week’s published shifts in its projection. A pending measurement remains pending. Managers read only their home cafe’s employees. Download the ACA CSV for the payroll provider or Willow preparing 1094-C/1095-C filings; Lanyard neither sends nor files it.

## Pay groups and workweeks

In **Payroll → Pay groups and workweeks**, the owner defines a weekly, biweekly, semimonthly or monthly group, its employees, first period date, workweek starting weekday and pay date as calendar days after period end. Weekly and biweekly dates run from the first date; semimonthly dates are 1–15 and 16–month end; monthly dates span the calendar month. Saved group membership and schedule are retained. Choose a date and **Open scheduled period**, then collect employee/manager signoffs and lock it under **Pay periods**. Finish existing ungrouped periods and choose a start after already exported time before assigning a group.

The FLSA workweek is separate from the pay period. Once a whole week ends and its recorded time is approved, minutes over 40 hours create a **weekly overtime premium** input at **0.5× the regular rate**, additional to the once-exported straight-time hours. Map this input as a half-rate premium in your payroll process, not another full-rate worked-hour line. A week spanning a period boundary labels it **Cross-period overtime adjustment**, with source period starts, source timesheet revisions and the receiving locked period. If the period where the week ends already closed, the next available locked period receives the adjustment. Open punches and pending time keep the premium waiting. Later corrections export only the signed premium difference; previous downloads never change. **Prepare batch** also handles a premium when no new straight-time hours are waiting.

Employees see their scheduled pay period and pay date in **Time → My hours and pay**. Whole-workweek overtime still applies across both halves of a semimonthly month; the pay-period boundary never resets the 40-hour threshold. The estimate remains before taxes and deductions. Lanyard exports reviewed inputs; the payroll provider remains authoritative and executes payroll.
