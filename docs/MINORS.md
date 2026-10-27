# Private minor work reviews

The owner records birth dates, the work state, dated school days and permit
references in People. Only the owner reads these records and their prior
versions. Coworkers, managers and agents receive named rule messages without
private records. The owner-only access rule was approved by ct on 23 October
and reaffirmed on 24 October 2026.

The `minor.save` command also accepts an `authorizations` array. These are
employer reviews of external documents, with the reviewing owner and time
retained. They do not verify an issuing authority, legal eligibility or actual
adult presence. Never substitute a Lanyard reference for the original document.
An omitted array retains reviews only when the birth date, state, permit
reference, permit expiry and school timetable are unchanged. Send an empty array to revoke all
reviews. Replacing the array retains the prior record in its version history.

Each entry contains `kind`, `reference`, `from`, `through` and `site`. Dates use
YYYY-MM-DD, both ends are included, and a window cannot exceed one year. The
workplace must match the shift's site, or the employee's home site for an
unscheduled clock. A review at one workplace never grants another workplace
permission. The public command is `POST /api/lanyard/command` with a native
owner session; see the app's command directory for the envelope and revisions.

Supported entries:

- `permit`: add `permitKind`, `dailyMinutes`, `weeklyMinutes`, `startMinute`
  and `endMinute`. Minutes are whole venue-time minutes. The review reference
  must equal the employee's permit reference, and its end date cannot exceed
  the recorded permit expiry. Its limits can tighten statutory limits.
  California uses `individual-work-permit`; New York and Illinois use
  `employment-certificate`; Washington uses `employer-endorsement`; Oregon
  uses `employer-certificate`. Illinois requires this check below age 16.
  Colorado and the federal preset have no routine permit review in this
  implementation. A required missing, expired or wrong-workplace review
  prevents a new assignment or clock-in.
- `parent-consent` and `school-consent`: retain the signed external consent
  reference and its validity dates. Washington requires parent consent and,
  during school weeks, school consent. Those Washington records must renew
  by September 30. New York school-week work after 22:00 requires parent
  consent and, before a school date, school consent; a missing next-date
  calendar refuses permission. Non-school weeks retain the ordinary limits.
- `school-release`: add `classEndMinute`, the end of the pupil's actual
  classes. Washington checks that a released older pupil starts work after
  those classes. This does not waive daily, weekly or clock-hour limits and
  never allows a younger pupil to bypass federal school-hour restrictions.
- `supervision`: add `supervisorId`, `adultConfirmed: true`, and ISO UTC `start`
  and `end`. The owner attests that this active employee is a responsible
  adult on the premises. Washington work after 20:00 requires coverage of the
  entire late interval. Several adjacent intervals may cover it; a gap or
  deactivated supervisor refuses it. This is an employer attestation, not
  live presence verification.
- `wa-special-variance`: add `schoolYearThrough`. Retain the jointly signed
  parent and school variance and both current consent records. The review
  must end by the stated school-year end. For older Washington pupils it
  permits six hours on Monday through Thursday and 28 hours in a school
  week, preserving eight-hour Friday through Sunday limits. Evening and
  supervision checks still apply. Other variance types are unsupported and
  never waive a limit.

For example, an owner can attach this employer certificate review to an Oregon
record, together with that record's other required fields and exact revision:

```json
{
  "kind": "permit",
  "reference": "synthetic-lanyard-20",
  "from": "2026-10-01",
  "through": "2027-06-30",
  "site": "Ocean Beach",
  "permitKind": "employer-certificate",
  "dailyMinutes": 480,
  "weeklyMinutes": 2640,
  "startMinute": 420,
  "endMinute": 1260
}
```

Maintained sources: [California summary](https://www.dir.ca.gov/dlse/MinorsSummaryCharts.pdf),
[New York hours](https://dol.ny.gov/hours-work-minors),
[Illinois child labor](https://labor.illinois.gov/laws-rules/fls/child-labor-law-compliance.html),
[Washington hours](https://www.lni.wa.gov/workers-rights/youth-employment/hours-of-work),
[Washington hiring](https://www.lni.wa.gov/workers-rights/youth-employment/how-to-hire-minors),
[Washington variances](https://www.lni.wa.gov/workers-rights/youth-employment/variances)
and [Oregon minor workers](https://www.oregon.gov/boli/employers/pages/minor-workers.aspx).

MINOR-001 remains partial. Complete maintained school-plus-work coverage,
additional state release and variance variants, authority-specific permit
conditions remain unproved. These commands
supply recorded checks and named refusals; they do not certify compliance.
