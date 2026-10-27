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

Each employee's configured workweek (Monday to Sunday for people without a pay group) Lanyard checks every person with approved time in a tipped job at such a cafe: their tipped minutes at the cafe's minimum wage against the same minutes at their own job rate plus the cash tips they declared at clock-out. A shortfall is a make-up pay input for that person and week. Download a week's inputs and add them in your payroll provider; Lanyard does not pay them. Owner-selected mapped templates include eligible single-site make-up inputs under their own earning code; the ordinary hours-only file keeps the separate download workflow. Time in the cafe's other jobs, such as side work recorded with **Change job** on the phone clock, is listed as non-tipped duty time so you can apply your own reviewed dual-jobs treatment. The owner reads every check; a manager reads the people of their own cafe.

## ACA hours for the filer

The owner defines a variable-hour measurement group in **Payroll → ACA hours measurement**. Choose 3–12 complete calendar months, the administrative end (0–90 days later), and the stability end. The report separates the monthly 130-hour test from the standard look-back average of 30 hours per elapsed seven-day week. It counts current approved payable hours at every cafe and lists waiting time and corrections separately.

Record paid non-work service from the employer’s records with a unique reference and reason. These credits are separate from punches, payroll earnings and leave balances. Correct the exact credit instead of duplicating it; zero minutes removes its contribution while keeping the prior versions. No provider has verified these manually entered facts.

The report shows its source revisions, service and planned hours, stability dates and status. Future published shifts can raise a schedule warning; draft review replaces that week’s published shifts in its projection. A pending measurement remains pending. Managers read only their home cafe’s employees. Download the ACA CSV for the payroll provider or Willow preparing 1094-C/1095-C filings; Lanyard neither sends nor files it.

## Pay groups and workweeks

In **Payroll → Pay groups and workweeks**, the owner defines a weekly, biweekly, semimonthly or monthly group, its employees, first period date, workweek starting weekday and pay date as calendar days after period end. Weekly and biweekly dates run from the first date; semimonthly dates are 1–15 and 16–month end; monthly dates span the calendar month. Saved group membership and schedule are retained. Choose a date and **Open scheduled period**, then collect employee/manager signoffs and lock it under **Pay periods**. Finish existing ungrouped periods and choose a start after already exported time before assigning a group.

The FLSA workweek is separate from the pay period. Once a whole week ends and its recorded time is approved, minutes over 40 hours create a **weekly overtime premium** input at **0.5× the regular rate**, additional to the once-exported straight-time hours. Map this input as a half-rate premium in your payroll process, not another full-rate worked-hour line. A week spanning a period boundary labels it **Cross-period overtime adjustment**, with source period starts, source timesheet revisions and the receiving locked period. If the period where the week ends already closed, the next available locked period receives the adjustment. Open punches and pending time keep the premium waiting. Later corrections export only the signed premium difference; previous downloads never change. **Prepare batch** also handles a premium when no new straight-time hours are waiting.

Employees see their scheduled pay period and pay date in **Time → My hours and pay**. Whole-workweek overtime still applies across both halves of a semimonthly month; the pay-period boundary never resets the 40-hour threshold. The estimate remains before taxes and deductions. Lanyard exports reviewed inputs; the payroll provider remains authoritative and executes payroll.

## Reporting, split and spread premium inputs

In **Payroll → Reporting, split and spread premiums**, the owner saves an effective-dated rule for each cafe. California reporting-time and split-shift presets and the New York hospitality call-in/spread preset retain their cited sources and revision. Enter the applicable state, local or industry minimum wage in cents per hour. Employer-configured rules use explicit minute guarantees and thresholds and are labeled unmaintained.

Choose approved time and prepare an input. For reporting pay, also select the scheduled shift. For an employer-directed split, confirm that the unpaid interval is not a meal/rest break or voluntary pickup; a workplace resident receives no California split premium. For a cancellation after arrival with no work, use **Record after-arrival cancellation** with the actual arrival/cancellation times and a source reference. This records payroll facts and leaves the published schedule as it stands. An owner or that cafe's manager reviews the exact input, disputes it with a reason or approves it. Nobody reviews their own input.

California reporting pay adds the difference up to half the scheduled minutes (at least 120, at most 240), only when less than half was worked, using retained job rates no lower than the entered minimum. California split pay is a one-hour minimum-wage top-up after crediting that day's retained earnings above minimum wage. New York hospitality call-in adds the difference up to 180 minutes, capped at the fixed repeating shift's minutes when that fact is confirmed. Spread pay is one minimum-wage hour when the day's elapsed span, including unpaid intervals, exceeds 600 minutes. These are employer-reviewed inputs; counsel and the payroll provider confirm applicability, exceptions and final wages. Sources: [California reporting pay](https://www.dir.ca.gov/dlse/faq_reportingtimepay.htm), [California split shifts](https://www.dir.ca.gov/dlse/split_shift.htm), [New York Hospitality Wage Order](https://forms.labor.ny.gov/WP/CR146.pdf).

The fact trace retains approved source revisions, payable work-area minutes and job rates. Premium minutes are separate from worked minutes. Daily inputs read all approved sources at that cafe/date and export under the selected timesheet's single claim. Premium minutes are allocated proportionally to those payable work areas, rounding down with the remainder in the last area; split-pay cents use the same allocation. Costs in cents are authoritative for a split premium offset by earnings. The CSV includes the pay code, amount, rule revision and source IDs. Approved inputs join the employee's estimate before taxes and deductions.

A changed source requires fresh review. Prepare the corrected time's input and export the signed per-job, per-area, per-code difference; earlier files stay unchanged. For work moved to a different date, review the **Prior premium date** as well as the new day, including a zero input to reverse a former premium. A daily correction's full signed premium difference follows its newly reviewed timesheet claim even when the original review used another source timesheet. Downloading a file does not mean a provider has accepted or paid the premium.

## Shift differentials

The owner sets effective dates, venue-clock windows, weekdays, cafe, position or exact shift label under **Shift differentials**. Additions use cents per hour; multipliers apply after lower stacking orders, with rule ID breaking ties. Split overnight windows at midnight. Approved time retains the rule versions and each reconciled job/area's minutes and rates. Corrections export only signed per-area/code differences under the timesheet's one claim. An employee's enabled gross estimate includes the additional amount. These are straight-time inputs: a payroll provider must confirm regular-rate and overtime treatment before they can be classified that way.

## Paid sick and safe leave

Under **Paid sick and safe leave**, choose a listed paid or unpaid employer tier, effective date and mapped payroll code. New York and NYC offer 40- and 56-hour paid tiers; Seattle offers standalone tiers 1–3. For California and its local presets, enter at least the longest normal workday of employees covered by that site policy. Five such days set the use floor where a use cap applies, and ten set the balance and carry floor, without reducing a higher hour or local entitlement. Review eligibility yourself; selected paid presets do not establish every statutory variant.

Approve worked time first. Current approved hours accrue at the actual work location, including cross-site segments. January 1 resets annual counters and applies carryover. Staff request a permitted category and partial-day minutes in **Time → My sick and safe leave** without medical details. The owner alone reviews private purposes and balances, approves use with a unique paid-service reference, and downloads the balance and source file. California and local categories include preventive care, jury duty and court witness service. This private-leave authority is ct-approved.

Approved paid use is paid non-work service, not worked time or another accrual source. Its reference deduplicates ACA credits. Payroll exports it once under the mapped code; a reasoned exact-revision correction exports only the signed difference and preserves prior files. Turning earnings estimates off removes current and historical leave wage amounts from employee reads.

Unpaid small-employer presets are available for New York State, NYC, Oregon and Philadelphia. Their labels describe the employer-size and income conditions; review the linked source and employee-class exceptions before selecting one. The balance file retains the selected code and an explicit paid flag. An unpaid request consumes protected minutes, creates an ordinary absence labelled **Unpaid leave**, and goes through owner review with a unique leave source reference and without a wage rate. Unpaid use and corrections never enter payroll, earnings estimates or ACA paid service. The balance CSV identifies the bank as unpaid. Later paid policy versions retain the unpaid status of earlier requests.

NYC also has a separate **32 immediately available unpaid hours** preset, additional to its accrued bank. Add it for the same cafe with an effective date of February 22, 2026 or later. It requires an employment start date, grants the full bank without worked accrual or a waiting period, and renews on January 1 without carrying unused hours. Current employment at the cafe or approved work there is required; unrelated cafes do not grant a bank.

Oregon categories include blood donation, parental leave, bereavement and the cited public-health, evacuation, air and heat reasons. Washington includes immigration proceedings involving the employee or family. NYC includes child care, disability care, housing or benefits appointments, declared public disasters and workplace violence. Select only a category; no medical narrative is collected. These implemented categories and tiers do not establish complete statutory coverage. A separate New York prenatal bank supplies 20 paid hours per 52-week period from first use, without accrued work. Employee-class exceptions and complete reason catalogs remain open in LEAVE-003.


## Mapped and classified files

The owner maintains templates through the authenticated `payroll.template.save`
command at `/api/lanyard/command`. This advanced command uses the existing native
owner session and records the actor and revision. Managers, staff and agents do
not read mapped templates, approved manual inputs or their batches. There is no
provider connection, wage payment or tax calculation.

Pass these fields in the command's `input` object:

```json
{
  "name": "Reviewed payroll layout",
  "approved": true,
  "classification": "policy",
  "format": "csv",
  "delimiter": ",",
  "header": true,
  "columns": [
    {"field": "employee", "header": "Employee number"},
    {"field": "workflow", "header": "Employment workflow"},
    {"field": "code", "header": "Earning code"},
    {"field": "hours", "header": "Approved hours"},
    {"field": "amount", "header": "Approved USD"}
  ],
  "groupBy": [],
  "dateFormat": "iso",
  "timeFormat": "iso",
  "decimals": 4,
  "employees": {"STAFF_ID": {"id": "PROVIDER_EMPLOYEE_ID", "workflow": "W-2"}},
  "codes": {"regular": "REG", "overtime": "OT", "double time": "DT", "PTO": "VAC", "tips": "TIP", "tip make-up": "MAKEUP"},
  "jobs": {},
  "locations": {}
}
```

Replace the employee placeholders with the native staff identity and its provider
identifier. Map every encountered job and location too. Include `id` and
`revision` when editing an existing template. Codes are the exact earning labels
on the approved source, including sick leave, holidays, differentials and
premiums. A missing mapping refuses preparation, and any template change requires
a newly prepared batch and fresh review.

`format` accepts `csv`, `tsv`, `delimited` or `xlsx`. TSV uses tabs; delimited text
uses the selected single-character delimiter. `header` controls the first row,
and the `columns` array controls its names and order. Supported column fields are
`employee`, `workflow`, `code`, `date`, `start`, `end`, `minutes`, `hours`, `amount`,
`job`, `location`, `timeId`, `revision`, `periodId`, `week`, `rateCents` and
`multiplier`. Dates accept `iso`, `us` or `eu`; captured UTC times accept `iso`,
`utc-minute` or `utc-time`. Hours accept zero to six decimal places; insufficient
precision is refused. Amounts retain USD cents and display two decimals.

Grouping starts with employee, employment workflow and earning code. Add `date`,
`job` or `location` to `groupBy` for separate rows at those levels. Selected
identifier columns also remain distinct, so an original timestamp or retained
rate is never discarded to merge rows. CSV text cells are formula-safe; XLSX
uses literal text cells and numeric amount cells, never executable formulas.

Use `payroll.prepare` with `templateId` and optional selected timesheet `ids`.
Open **Payroll**, inspect the classified ledger and exact text or worksheet
preview, and approve that batch revision. Download keeps the chosen extension
and checks the SHA-256 of the actual bytes. Repeated downloads return identical
bytes; corrections export signed differences and never alter earlier files.

`classification: "source"` maps existing approved source lines without applying
new overtime classification. `classification: "policy"` uses the retained
overtime-core policy after a complete, approved workweek closes. It preserves
work-area and clock-transfer job rates, source revisions, period identity and
policy references. Single-rate employee time splits into regular, overtime and
double time. Supported `1099` output contains regular worked time only, with no
employee overtime or tax treatment. Mixed-rate overtime and conversion of prior
hours-only exports or legacy overtime premiums are refused; their applied
provider treatment must be reconciled first. Corrections to classified work
must continue through a policy-classified template.

The owner can record an employer-approved non-work source with
`payroll.input.save`: `staffId`, `date`, `kind` (`PTO` or `tips`), `minutes`,
`amountCents`, unique `reference` and approval `reason`. Tips always have zero
worked minutes. Correct the exact `id` and `revision` to retain its history;
subsequent mapped exports carry only the signed difference. These are manually
approved inputs, not provider-verified records or leave-bank changes. Existing
sick, holiday, premium and differential sources keep their own approval doors.
Manual tip inputs do not create a TIPS-001 pool or change TIPS-002's current
CLOCK-006 declaration basis; that reconciliation remains with TIPS-001.
Single-site TIPS-002 make-up inputs retain their workweek and source digest;
multi-site make-up requires an employer-reviewed allocation and is refused.
The new source and workflow defaults remain under PAY-001's partial status.


Every template revision requires the owner's explicit `approved: true`. Omitted
approval creates an unapproved revision; earlier templates must be reviewed and
saved with explicit approval before mapped output. In Payroll, select the
versioned export template before preparing the file. Unapproved templates and
`unclassified` worker mappings show a denial reason. Keep a legacy worker's
workflow as `unclassified` until the owner reviews it; a payroll ID or previous
provider file never determines W-2 or 1099 treatment. Classification does not
authorize conversion of earlier hours-only exports: those still require
reconciliation. Contractor rows containing an employee overtime input are
refused; supported 1099 output is regular worked time only. Later template
changes leave closed periods, retained batches and downloaded bytes unchanged.

Contractor classification review and conversion, other 1099 forms and state
treatments remain open under PAY-001. The file path does not claim Gusto,
Rippling or QuickBooks Payroll approval, legal classification or tax filing.

## QuickBooks Desktop IIF time activities

The owner opens **Settings**, then **QuickBooks Desktop → Configure IIF time
export**. Copy the company name, creation time, Timer version and release from
that company's exported Timer header. Enter existing employee names and payroll
items exactly; map each native job to a customer and job name and service item.
Classes are optional. Approve the preset revision explicitly.

In **Payroll**, choose the approved Desktop preset, prepare and review the IIF,
then approve **Export reviewed IIF** and download it. The export-only preset
writes grouped employee, date, payroll-item, customer-job and service-item
activities. Whole payable minutes become hours and minutes. Classified regular,
overtime and PTO hours retain the existing once-only payroll claims and file
hash. A missing employee, payroll item, customer-job or service item refuses
preparation. Each activity must fit the Timer format's 23:59 limit. Negative
corrections and earnings other than classified worked hours or PTO require
separate reconciliation; they cannot silently turn into fresh positive time.

Format source: [Intuit's IIF Import Kit](https://support.quickbooks.intuit.com/support/pages/executable/iif/iif_import_kit.zip),
Timer Activity example dated 18 April 2008 and its TIMEACT and TIMERHDR header
references. The kit specifies the company header, date and duration format and
list-name mappings. Its older header reference marks PITEM unused; this preset
supplies the reviewed payroll-item name and requests transfer to payroll, but
that does not prove the installed Desktop version applies those items.
[Intuit's overview](https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/iif-overview-import-kit-sample-files-headers/L5CZIpJne_US_en_US)
explains the import limitations. The required buyer-authorized Desktop Payroll
Enhanced import, mapped weekly-timesheet readback and total reconciliation
remain a manual acceptance check. No live Desktop connection or successful
company-file import is claimed.


Sick and safe leave policies also offer accrued unpaid base tiers for small
employers in New York State, New York City, Oregon and Philadelphia. Review the
employer size, income and worker coverage against the linked rule before choosing
a tier. NYC domestic workers and Philadelphia chain establishments require the
applicable paid tier. An unpaid request is labeled unpaid, consumes its protected
bank and costs zero. It appears in the owner’s balance download with its selected
code and a paid flag, and contributes no paid payroll hours, earnings or ACA paid
service. A later paid policy version does not turn earlier unpaid use into wages.
For NYC, add a separate NYC_UPFRONT policy for the same cafe. It provides 32
immediately available unpaid hours from 22 February 2026, without requiring
accrued work; unused supplemental hours do not carry into the next January grant.
For New York State and NYC, add a distinct NY_PRENATAL policy at the same cafe
for the separate 20-hour paid prenatal bank. It needs no worked-time accrual. Its
52-week period starts on first approved use and resets after 364 elapsed days;
January does not replenish it. The balance report’s annual-used field represents
the active 52-week period for this bank. Complete eligibility and reason coverage
remains partial as recorded in CONTRACT.md.

### Reviewed employer tiers and Oregon donations

When choosing a New York 40-hour tier, enter the employer's employee count.
At 100 employees choose the 56-hour tier. Unpaid New York tiers also require
an income review; the NYC unpaid tier excludes domestic workers. Unpaid Oregon
requires fewer than ten employees, or fewer than six when the employer has a
Portland location. Unpaid Philadelphia requires fewer than ten employees and
fewer than fifteen chain establishments. Missing reviews and a tier that
withholds required paid time are refused. These employer facts are private to
the owner and retained with effective policy versions; they are not independently
verified by Lanyard.

Oregon donations follow the [BOLI sick-time guidance](https://www.oregon.gov/boli/workers/pages/sick-time.aspx).
Enable **Allow Oregon sick-time donations** on the policy first. Under
**Prepare Oregon donation**, choose the donor, recipient, minutes and today's
venue date. The donor sees the named recipient and explicitly consents under
**My sick and safe leave**. A separate owner then approves the exact request.
Current source balances and policy versions are checked again at approval.
The donor can withdraw before approval; a withdrawn request cannot transfer time.
The transfer changes both balances without creating payroll, paid service or
an absence. The recipient must request an ordinary permitted absence to use
those minutes. Consent and transfer sources survive backup and restore.
This conservative consent and authority default awaits ct approval; broader
employee eligibility and complete reason applicability remain unproved.
