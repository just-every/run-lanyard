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
