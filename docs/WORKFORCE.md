# Jobs, qualifications and effective rates

PEOPLE-002 is available through the authenticated public command door,
`POST /api/lanyard/command`, with `{ "name": "…", "input": { … } }`.
Use a current native owner or manager session and the installation's Origin.
An agent cannot edit these records. The owner acts as payroll administrator;
a manager edits a profile only for a person in their home cafe.

1. `job.save`: provide `name`, `skills` (names) and `certifications` (names).
   It returns the job `id` and `revision`. To edit, send both back with the
   complete new definition. Earlier definitions remain in `versions`.
2. `workforce.save`: provide `staffId`, granted `jobs` (job IDs), `skills`,
   `certifications` (`{name, expires: "YYYY-MM-DD"}`), eligible `sites`,
   `preferences` (employer-recorded text), `minHours`, `maxHours`,
   `classification` (employer-recorded text), `employmentType` (`full-time`,
   `part-time`, or empty/not set), `startDate`, and `rates`.
   Each rate is `{job: "<job id or empty for general rate>", from: "YYYY-MM-DD",
   cents: 2400}`. USD cents per hour are integers, not dollar floats.
   Updating a profile requires its returned `id` and exact `revision` and all
   fields again. Duplicate effective dates for the same job are refused.
3. Supply `job` with assigned shifts in `roster.prepare`, `openshift.post`,
   `recurrence.save` and, for manager-entered time, `time.prepare`. A label is
   still descriptive text; it does not establish a qualification. Templates and
   copies preserve explicit job IDs. A phone punch's approved time inherits
   the job of its matched shift.
4. Read `/api/lanyard/state` to inspect profiles, job definitions, qualification
   conflicts, draft review warnings and exact `rateBasis` inputs on work and
   payroll preparations. Managers read profiles and rate bases for their home cafe; the owner reads all. Staff get their own profile only. Coworker shift
   views and delegated agent views carry no rate snapshots. Turning employee
   estimates off also hides their profile's current and historical rates.

For example, a native manager can save this cross-trained profile after making
Barista and Counter jobs (replace the IDs with those returned by `job.save`):

```json
{
  "name": "workforce.save",
  "input": {
    "staffId": "employee-id",
    "jobs": ["barista-job-id", "counter-job-id"],
    "skills": ["espresso", "service"],
    "certifications": [{"name": "food safety", "expires": "2027-06-30"}],
    "sites": ["Ocean Beach"],
    "preferences": ["Barista mornings"],
    "minHours": 16,
    "maxHours": 32,
    "classification": "hourly employee",
    "employmentType": "part-time",
    "startDate": "2026-01-01",
    "rates": [
      {"job": "barista-job-id", "from": "2026-01-01", "cents": 2400},
      {"job": "barista-job-id", "from": "2027-01-01", "cents": 2600},
      {"job": "counter-job-id", "from": "2026-01-01", "cents": 2200}
    ]
  }
}
```

Certificates remain valid through their expiry date in the venue time zone.
Every venue date touched by a shift must qualify; an overnight shift reaching
the next date is refused if the certificate expired the preceding date. Site
eligibility applies even to shifts without a job. An employee with job grants must have an explicit job on each new assignment. A job assignment requires an
explicit grant, all required skills and all unexpired required certificates.
Employers record these facts; Lanyard does not certify or verify a credential.
Publication, template/copy/recurrence application, swap proposal/consent/approval,
call-out cover approval and pickup request/approval all recheck current facts.
Minimum weekly hours raise a draft warning; maximum hours block assignment.
AVAIL-001 continues to supply employee-selected preferred blocks and hours;
workforce text preferences are recorded context, not an automatic ranking rule.

Rates take effect on inclusive venue dates. A job-specific schedule wins over
the general schedule, and the latest effective date at or before the date wins.
The existing People base rate is the fallback. Net payable minutes crossing
midnight are allocated by elapsed time (including DST), with remaining minutes
going by largest fractional remainder, then earlier date. Each date's cost is
rounded half up to the cent. A new draft snapshots this basis; approved time
snapshots its basis at approval, and a payroll preparation copies it. Subsequent
rate edits retain those prior snapshots and full job/profile versions. Legacy
rows get a separate retained basis before their first rate edit, without
changing locked time. Reprepare a draft to review changed rates. These cost
estimates do not calculate provider wages or replace PAY-001's classification,
POLICY-001's overtime engine, or EARN-001's existing base-rate weekly estimate.
The hours CSV remains PAYROLL-001's documented format.

Employment type/start date use the same employment record as COVER-004; there
is no second conflicting classification source. Future multi-job clock segments
(CLOCK-008), optimizer assignments (OPT-001), provider compensation sync
(PAYSYNC-003), payroll classification (PAY-001), differentials (PAYRULE-001) and
holiday/premium calculations (PAYRULE-002/003) must inherit these qualification,
effective-rate and retained-basis checks before shipping.
