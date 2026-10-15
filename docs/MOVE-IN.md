# Move in

Bring staff details into Lanyard using a CSV you have checked. The importer accepts Lanyard Staff CSV v1; it is not a verified export adapter for another scheduling or payroll product.

## Prepare your staff file

Use UTF-8 CSV with exactly these headings:

```csv
staff_id,name,email,payroll_id
```

Give each person a stable staff ID and a unique email. Payroll IDs can be blank during move-in, but must be set before exporting hours. The import accepts 1–100 rows and up to 100,000 UTF-8 bytes.

Read the [Staff CSV reference](STAFF-IMPORT.md) for quoting, limits and validation. If your old system has a different format, map it to these columns first. The import brings staff details across, not past shifts, hours or payroll history.

## Preview before applying

1. Sign in as the owner and open **Import**.
2. Paste your CSV into **Staff CSV**, then select **Preview import**.
3. Review the counts, diagnostics, conflicts and **People in this file**. Preview does not change staff records.
4. Fix the source and preview again if anything is wrong.
5. Review **Exact reviewed CSV**, tick **Apply this exact preview**, then select **Apply reviewed import**.

Apply uses the exact CSV and fingerprint you reviewed. Changing even whitespace needs a new preview. Existing people are never overwritten. Resolve conflicts before applying; do not expect the importer to merge records silently.

## Finish the import

Open **Import jobs** and inspect the job's state and checkpoint. A request processes at most ten rows. Use **Resume import** until the job is completed. Resume continues the retained plan; it does not fetch or reparse another file.

Open **View job journal** to inspect originals, batches and effects. The journal contains personal data and the retained source CSV; keep it private. Operations stay with the owner identity that created the job.

Imported people begin inactive with the staff role. In **People**, review each card, use **Edit details** to activate the person and set any missing payroll ID, then **Invite to Lanyard** → **Send invitation**. Import itself grants no access and sends no invitation.

## Undo or roll back

For a completed job, open **Resume or undo** and select **Undo import**. For a partially applied job, use **Roll back partial import**. Continue with **Resume import** while undo or rollback is still in progress.

Undo removes untouched imported people. It preserves people who have since been activated, edited or used in availability, leave, shifts, clocks, timesheets or payroll. Inspect the journal for conflicts rather than assuming the whole job disappeared.

Undo and rollback keep the journal and original CSV. They are not personal-data erasure. Imported identities cannot use **Erase unused staff**; deactivate them to revoke access while keeping their records.
