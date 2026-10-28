# Workforce calculation and custody details

These details retain the workforce source fields, allocations and interim implementation boundaries. The contract defines the capabilities and acceptance; dated implementation observations below are history, not a new approval policy. Agent calls use company policy under the contract; a legacy human-only door is an implementation gap.

## ACCESS-001

Owners grant access; managers make staffing and time decisions; staff see their own private work.

Browser mutations require the configured origin.

## ROSTER-002

Managers or delegated agents prepare a weekly roster, then a human manager publishes the exact revision.

Publication rechecks active staff, availability, approved leave and overlapping assignments atomically.

Republishing supersedes the previous week revision without deleting its work history; stale drafts fail.

## AGENT-001

The owner issues expiring revocable preparation keys.

Agents read a reduced context and prepare roster, time and payroll drafts; only a native human manager publishes, approves or exports.

Agents receive no payroll IDs, download files or staff contact details through their context.

## ARCHIVE-001

Owners export and atomically restore supported people, original owner identity, rosters, time revisions, payroll files/source claims, events and import originals/journals into an empty compatible installation.

Corrupt or populated imports fail.

Sessions, sign-in links, agent keys, provider credentials and the development outbox do not travel; configuration is re-entered and the archived owner signs in again.

This retained-owner policy deliberately replaces a generic Base restore that might establish a new owner.

A destination or supplied later erasure journal fences older erased identities; disconnected old copies cannot know about later erasure.

## ERASE-001

An owner erases only an unused, uninvited, never-imported staff identity, replacing personal values and recording an erasure fence that rejects recreation/import by the erased identity.

Employed, invited or imported people are deactivated and their legally relevant history retained; expanded retention and privacy controls are PRIVACY-001.

## AUDIT-001

Publication, time decisions, payroll export/acknowledgment, import actions, erasure and payroll downloads retain actor, role, subject and time.

State mutation, payroll source claims, decision event and replay outcome commit together or fail together.

An import action (apply, resume, undo or rollback) records one event per staff record it creates or removes, named for the action and committed in the same atomic batch as that record; a payroll download records its own event.

Activity is read by role, newest 100 events per reader: owners read all of it; a manager reads the events about people whose home cafe is the manager's own (an unnamed cafe is one cafe) and about that cafe's settings, with a setting naming no cafe read by every manager, until TEAM-001 adds finer site and team scopes; staff read the events on their own records (their staff record and records carrying their staff id, never rosters, batches, postings or templates covering several people); everyone reads the events they performed; events on anonymous FEEDBACK-001 feedback record their actor only as a keyed digest and are read by no one; an employee never reads events on a private JOURNAL-001 note about them; agents read none.

An event's people are its subject record's person and the people on a roster's or posting's shifts, a template's slots and a payroll batch's lines, judged by today's home cafe; installation settings and records no longer present are owner-only.

An event shows only actor, role, action, subject id and time, never employee-private fields.

## PUBLIC-001

The public run site presents the target product, opens /run for installation and builds owner guides at /docs from repository Markdown.

The installed / remains the shared Lobby, reflecting the durable owner claim before separate first-run confirmation.

Public marketing, installation and private operational state stay distinguishable; enabling deployment remains an explicit repository operation.

## BASE-001

The maintained command surface remains SEED-COMMAND-CONTRACT.md: pinned dependencies, setup, dev/preview, build/check/verify, owner-account deploy, export/import, diagnostics and explicit reset.

Product-owned archive and erasure policy replaces only the stated Base data behavior; native auth, deployment identities and shared Lobby are retained.

## TEAM-001

Owners organize businesses, locations, departments and jobs; assign employees to multiple eligible sites; and scope schedulers, site managers, time approvers, payroll administrators and read-only analysts independently.

Wage and tip data are restricted.

Cross-location staff see permitted assignments while managers cannot act beyond their sites; owners can revoke grants immediately.

Owners can also define custom access levels under ACCESS-003.

Bulk timesheet approval (TIME-008) then covers only the approver's sites.

LEAVE-003 delegation rider (27 October 2026): the owner may appoint a private leave administrator for named employees and sites using a separate administration permission; private permitted-purpose access requires its own explicit grant.

Scheduling, generic leave approval and payroll permissions alone confer neither private balances nor purposes.

Public reads, decisions, corrections and downloads enforce current scope, immediate revocation and independent approval of the administrator’s own leave, with attributed audit.

Ordinary managers retain generic absence information.

This delegated duty remains unproved.

Owner-only administration is too narrow for the contracted operations buyer.

TEAM-001 and ACCESS-003 must provide a separately granted, read-only audit permission for a named authenticated person, bounded by business, sites, employees, jurisdictions, report classes and date range, with an explicit purpose and access end date.

Report access and download require current authority on every request and immediate revocation.

Wage and other sensitive fields require their separate permission and necessary-purpose review.

An audit grant confers no staffing, approval, payroll, integration or privacy-administration authority and cannot exceed the grantor’s content authority.

Private leave purposes, private notes and unrelated personal data remain excluded from the ordinary audit projection.

REPORT-002 requires separately granted named read-only auditor access with current business, site, employee, jurisdiction, report-class and date scope, separate sensitive-data permissions, immediate revocation and attributed reads and downloads; the complete delegated duty remains unproved.

Explicit owner-issued API grants now enforce the supported audit classes; dedicated grant administration and complete class coverage remain open.

The existing report screen now serves the scoped reader without operational state.

## PEOPLE-002

Managers maintain job skills, certifications with expiry, site eligibility, employee preferences, minimum/maximum hours, employment classification and effective-dated USD wage/job rates.

Qualification expiry blocks unsuitable assignment and private wage access is restricted.

Changes preserve the rate/policy basis used for past costs and payroll preparation.

Applying a SCHEDULE-002 template, copy or recurring shift rechecks qualifications, and so does every COVER-001 swap proposal, consent and approval and every COVER-002 pickup.

Its employment classification takes over COVER-004's employment type and start date.

The public job/profile commands are employer-recorded facts, not credential verification.

A manager maintains profiles for their home cafe, and the owner acts for payroll administration until TEAM-001/ACCESS-003.

Certification expiry and rate starts are inclusive venue dates; job-specific rates take precedence over general rates, latest effective date first, with the People base rate as fallback.

Payable minutes crossing dates are proportionally allocated by elapsed time, largest remainders first (earlier date breaks ties); cost rounds half up to cents per date.

Minimum weekly hours warn and maximum hours block.

AVAIL-001 supplies employee-selected preferred blocks/hours; profile preferences retain employer-recorded context.

Draft preparation, approved time and payroll preparation retain their rate inputs and job/profile revisions; edits keep earlier versions, and legacy cost bases are retained before a first rate edit without changing locked time.

SCHEDULE-002, COVER-001/002/003 use these checks now; CLOCK-008, OPT-001, PAYSYNC-003, PAY-001 and PAYRULE-001/002/003 inherit them before shipping.

## CONTACT-001

Each employee has emergency contacts (name, relationship, phone) held by the field authority chosen under PAYSYNC-001: Willow or BambooHR (HR-001), the connected payroll provider where it exposes them, or Lanyard.

When Lanyard is the authority staff maintain their own contacts in the employee app.

Owners and site managers whose scope covers the person's shift see the contacts read-only on the shift, live-attendance and employee cards, including from a CLOCK-004 late or no-show alert; other roles and other sites cannot read them.

Every view is audited and the data follows PRIVACY-001 retention and erasure.

Until PAYSYNC-001 and HR-001 bring the authority switch, Lanyard is the authority: each linked person (staff or manager) keeps up to three of their own contacts (name, relationship and a US phone number with its area code, kept as +1 and ten digits), and a save replaces the list at its exact revision.

Until TEAM-001 the owner (acting for admin) and the managers of the person's home cafe read them, only through the audited contact card linked from the shift, live-attendance and People cards and the CLOCK-004 alert, which offers a tel: link to call; no state, list or agent context carries another person's contacts.

Every card view writes an activity event (contact.view) naming the reader and the person; every refused attempt (another cafe's manager, a coworker, anyone else) gets not found and writes contact.refused.

The owner, the person's cafe managers and the person read those events.

PAYSYNC-001 and HR-001 inherit the authority switch and the point that a change at the authority shows on the card while a Lanyard edit is refused; ACCESS-003 inherits refusing a level without the contact permission.

## ACCESS-002

Owners let managers and payroll administrators sign in with Google Workspace, Microsoft Entra ID or Okta through OIDC, mapped to existing Lanyard people by verified email or an explicit subject, and can require a passkey or authenticator second factor for roles that approve time or export payroll.

Removing the person in the identity provider or in Lanyard ends access at the next request; staff keep text-code or email-link sign-in.

## ACCESS-003

Owners define named access levels from a fixed permission catalog (view or edit drafts, publish schedules, approve swaps and leave, approve time, edit punches, view wages and labor cost, manage tips, export or submit payroll, manage people, view reports, manage integrations) and scope each level to businesses, locations and departments.

The catalog also carries viewing CONTACT-001 emergency contacts.

The TEAM-001 roles ship as editable defaults.

A person may hold several levels at different sites; nobody can create or grant a level carrying a permission they do not hold; wage visibility and self-approval rules from ACCESS-001 still apply.

No access level grants a preparation key scope; `view wages and labor cost` never extends to preparation keys.

LEAVE-003 delegation rider (27 October 2026): the owner may appoint a private leave administrator for named employees and sites using a separate administration permission; private permitted-purpose access requires its own explicit grant.

Scheduling, generic leave approval and payroll permissions alone confer neither private balances nor purposes.

Public reads, decisions, corrections and downloads enforce current scope, immediate revocation and independent approval of the administrator’s own leave, with attributed audit.

Ordinary managers retain generic absence information.

This delegated duty remains unproved.

Owner-only administration is too narrow for the contracted operations buyer.

TEAM-001 and ACCESS-003 must provide a separately granted, read-only audit permission for a named authenticated person, bounded by business, sites, employees, jurisdictions, report classes and date range, with an explicit purpose and access end date.

Report access and download require current authority on every request and immediate revocation.

Wage and other sensitive fields require their separate permission and necessary-purpose review.

An audit grant confers no staffing, approval, payroll, integration or privacy-administration authority and cannot exceed the grantor’s content authority.

Private leave purposes, private notes and unrelated personal data remain excluded from the ordinary audit projection.

REPORT-002 requires separately granted named read-only auditor access with current business, site, employee, jurisdiction, report-class and date scope, separate sensitive-data permissions, immediate revocation and attributed reads and downloads; the complete delegated duty remains unproved.

Explicit owner-issued API grants now enforce the supported audit classes; dedicated grant administration and complete class coverage remain open.

The existing report screen now serves the scoped reader without operational state.

## JOURNAL-001

Authorized managers add dated notes to an employee's record (attendance conversations, performance, commendations) with category, author and optional attachment, and choose per note whether the employee can see it.

Notes are scoped by site and role, never appear in team views, agent context or broad reports, keep prior versions when edited and follow PRIVACY-001 retention, legal hold and access requests.

Until TEAM-001 adds finer site and role scopes, the authorized writers and readers are the owner, acting for admin, and the managers whose home cafe is the employee's (an unnamed cafe is one cafe); nobody keeps notes about themselves.

A note has a venue date, one category (attendance conversation, performance, commendation or other), its author's name, text, and at most one attachment of up to 1 MB stored outside the records and served only to a reader of the note; it is private (managers in scope and the owner) or visible to its employee read-only, without author id or history.

An edit needs the note's exact revision and keeps every earlier version with its text, visibility, category, attachment, author and time.

Events on a private note are never read by its employee (AUDIT-001).

Notes never reach staff team views, agent context, payroll files or reports.

PRIVACY-001 applies its retention, legal holds and the employee's access export to notes, the export carrying employee-visible notes only.

## SCHEDULE-002

Managers save schedules and role-based shifts as templates, duplicate selected days/weeks, and generate recurring assignments with explicit end dates and exceptions.

Applying a template rechecks current leave, availability, qualifications, budgets and policies without auto-publishing or copying stale confirmations.

Owners and managers save, copy and repeat.

Each makes a new draft revision of the target week holding its current rows (its open draft, else its published revision) plus the added shifts at the same venue wall times, so a copy across a daylight-saving change keeps 7:00 am; nothing is published and no confirmation is carried.

Templates and copies keep each shift's person, times, meal minutes, label and cafe; a person no longer active is left out and named.

A recurring shift repeats on chosen weekdays between an explicit first and last date and skips listed dates; adding a week's recurring shifts places only that week's occurrences.

Each draft rechecks availability, approved time off and overlaps as any prepared week does; qualifications are PEOPLE-002's, budget warnings COST-001's and policy checks POLICY-001's to add to that recheck, and position-only template rows are COVER-002's open shifts.

## SCHEDULE-004

Managers attach operational notes, checklists and job/area segments within shifts.

Employees see relevant instructions on mobile, confirm completed tasks and report a blocker with attachments; segment hours map to jobs for labor and payroll without double-counting the enclosing shift.

Structured notes never appear on SCHEDULE-005 printed copies or the wall display.

Instructions are visible to the current assignee and authorized managers; retained prior responses are visible to their author and those managers (ct, 20 October 2026).

Until TEAM-001 adds finer grants, the owner manages all cafes and a manager manages only their home cafe.

Native API checklist edits create new task identities; earlier responses retain the confirmed wording and instruction revision, and never count as completion of edited tasks.

Managers and employees use the Schedule handover card at desktop and phone widths.

Each immutable blocker response can carry one attachment up to 1 MB, readable under the same response access.

Up to 20 ordered job/area segments cover all elapsed minutes of the enclosing shift; each job is qualification-checked, including on reassignment.

Submission pins the instruction revision and area plan.

Approval allocates payable minutes proportionally over the actual elapsed areas, extends the first/last area for early/late work, and assigns remaining whole minutes by largest fractional remainder (earlier area breaks ties).

Each area retains its effective-dated job-rate basis; scheduled and actual labor and payroll count those minutes once, and later corrections export the signed difference per job and area under one enclosing-timesheet claim.

A duration change requires a matching plan (clear areas before resizing, then re-enter them).

PAY-001, CLOCK-008 and PAYRULE-001/002/003 inherit the pinned per-area reconciliation, retained job-rate basis and once-only signed per-area corrections before adding classifications, transfers or premiums, each carrying them in its own text and acceptance.

## AVAIL-001

Employees set recurring weekly availability as available, preferred or unavailable blocks per day with effective start and end dates, add one-off exceptions and state preferred and maximum weekly hours.

Managers may require approval of availability changes; a pending change does not alter scheduling until approved, and a change that collides with published shifts lists the affected shifts.

Scheduling, swaps, offers, optimization and FAIR-001 read the effective pattern for each date.

An approved pattern governs each venue date from its first day to its optional last day, the newest first day winning; a date's one-off exceptions replace that weekday's blocks.

A shift touching an unavailable block or exception is flagged as marked unavailable; otherwise it is available when the effective available or preferred blocks, or dated availability windows, cover it end to end.

A prepared week past the person's maximum weekly hours flags their last shift; preferred hours are recorded and shown.

Owners and managers choose whether staff changes wait for approval; a pattern a manager enters for someone is effective at once, and nobody decides their own.

Saving or approving lists the published shifts from its first day that it would flag.

The call-out shortlist (COVERAGE-001) ranks teammates whose effective pattern prefers the whole shift first; COVER-001, COVER-003, OPT-001 and FAIR-001 carry their own reads of the pattern.

## LEAVE-002

Managers set blackout dates and per-site or per-role limits on how many people may be off at once, and see a team leave calendar of approved and pending time off beside the schedule.

Requests inside a blackout or over a limit are refused or routed for explicit override with a reason; employees see the allowed dates before requesting, and pending requests show distinctly from approved leave.

Until TEAM-001 brings site-scoped managers, owners and managers set the rules for every cafe.

A rule names a cafe, a position, both or neither (blank covers everyone).

Blackout dates are inclusive venue dates, and a request touching any of them conflicts.

A limit counts other covered people's approved leave on each venue date a request touches and is full when that count reaches the limit.

Each rule either refuses a conflicting request or accepts it flagged for a manager; approving any conflicting request needs an override reason, recorded with the conflicts, the approver and the time.

Staff see the blackout and full dates that cover them from today on, never who is off; the team leave calendar is for owners and managers and lists approved and pending leave by day of the shown week.

## LEAVE-003

Lanyard ships maintained paid sick and safe leave presets for California, Colorado, Illinois (Paid Leave for All Workers Act), New York State, Oregon, Washington, New York City, Chicago, Seattle, San Francisco, Los Angeles and Philadelphia.

Each preset records accrual on hours worked, caps, carryover, waiting period, usage increment, permitted reasons and balance fields with its effective date and cited source.

Accrual runs on approved worked hours at each employee's work location; balances flow to LEAVE-001 and pay codes to PAY-001.

Any other jurisdiction is labeled employer-configured, unmaintained.

The current paid-tier preset engine uses whole paid minutes, fractional accrual retained in 1/840-minute units and January 1 year boundaries; pending or superseded time never accrues.

Work-area location and current approved payable minutes determine the bank, including cross-site work; approved leave is paid non-work service and does not accrue again.

Corrections rebuild balances from current approved sources, preserve earlier payroll bytes and export only signed paid-use differences.

Paid-service source references deduplicate ACA-001 credits.

Unlisted places are explicitly employer-configured, unmaintained.

Interim conservative privacy default: the employee reads their own bank and permitted-purpose request, and the owner alone reads all balances/purposes, approves/corrects use and downloads balance/source files; managers see only the ordinary absence window labelled Paid leave.

No medical details are requested.

This owner-only administration is approved by ct on 23 October 2026 at 14:25Z; TEAM-001/ACCESS-003 and PRIVACY-001 inherit it before extending readers.

The owner selects New York and NYC 40-hour or 100+ employee 56-hour paid tiers and Seattle standalone tiers 1, 2 and 3 explicitly.

Separate combined PTO presets retain the same tier accrual rates and carry 40, 56 or 108 hours respectively, with no annual use cap; employer-approved PTO use shares the same bank and signed payroll source.

The owner chooses the tier and reviews applicability against the cited Seattle source.

For California and its San Francisco/Los Angeles presets the site policy records at least the longest normal workday of its covered employees: five such days set a use floor where a use cap exists, and ten set the bank and carry floor, without reducing any higher hour-based and local entitlement.

Defaulting legacy policies to eight hours preserves their prior hour floors; employers must review longer days.

The owner can also select accrued unpaid base tiers for small employers in New York State, NYC, Oregon and Philadelphia.

Requests retain the effective rule’s paid status: unpaid use consumes protected time, costs zero, appears in balance files with its code and an explicit paid flag, and is excluded from paid payroll, earnings and ACA paid service even after a later paid policy version.

NYC domestic workers and Philadelphia chain establishments must use the applicable paid tier, not the small-employer unpaid preset; applicability remains employer-reviewed.

An additional NYC_UPFRONT policy at the same cafe provides 32 immediately available unpaid hours from 22 February 2026, independently of approved-work accrual; its unused hours do not carry to the next January grant.

Employment start and current cafe or approved work determine availability, with approved use retaining its grant history.

A separate NY_PRENATAL policy at the same cafe provides 20 paid hours without accrual from 1 January 2025.

Its 52-week period is 364 elapsed days from the first approved use; January does not replenish that period, and a duration correction retains its first-use date.

The rolling bank uses the existing annualUsed report field for the active 52-week period.

Expanded categories include preventive care; applicable closures, exclusions, bereavement and evacuation; Oregon parental leave, hazardous conditions and blood donation; Washington immigration proceedings; and NYC childcare, public disasters and housing or benefits proceedings.

Complete employer and employee eligibility and coverage variants remain unproved.

The NYC small-employer unpaid preset is its accrued base bank; the owner must also add the distinct NYC_UPFRONT policy for the same cafe to provide its separate 32-hour supplemental bank.

Complete jurisdiction reason catalogs and employee-specific eligibility remain unproved.

LEAVE-001 and PAY-001 provider balance and code mapping remains with those clauses.

Employer-size reviews now refuse a 40-hour New York tier at 100 employees, and refuse unpaid tiers when employer counts, income, NYC domestic-worker coverage, Portland presence or Philadelphia chain establishments require paid time.

These financial review fields remain owner-only.

Oregon donations are disabled unless the effective employer policy explicitly allows them.

The owner prepares exact minutes and a named recipient; the donor explicitly consents through their own session, then a separate owner approves on the effective venue date after checking current approved balances and the retained policy revision.

A donation debits and credits the same Oregon bank, does not accrue or consume annual absence use, creates no absence or paid service, and is never itself a payroll line.

The recipient still requests a permitted absence and receives pay only on approved use.

Transfers retain consent and approval history through restart and archive transfer.

The donor may withdraw before approval.

No automatic transfer, reversal or deletion occurs.

RL-103 resolves this donation boundary; LEAVE-006 carries it without promotion.

San Francisco also exposes organ or tissue donation as a permitted purpose. ct policy ruling (27 October 2026): APPROVE WITH RIDERS; LEAVE-003 remains PARTIAL.

Reaffirm the approved private-administration default: employees read their own balances and permitted-purpose requests; only the live native owner administers all balances, purposes, approvals, corrections and balance or source downloads through the interim door.

Ordinary managers receive only the generic absence window labelled Paid leave, without private balances or purposes, and no medical details are requested.

Owner-only administration is too narrow for the contracted multi-location operations buyer: separately scoped private leave administration must follow under TEAM-001 and ACCESS-003, preserving the privacy and retention duties of PRIVACY-001.

This ruling approves neither statutory applicability nor legal compliance and does not decide the separate Oregon donation policy.

## MINOR-001

Employers record an employee's date of birth and any state work permit.

Maintained presets apply federal FLSA child-labor limits for 14- and 15-year-olds (school-day, school-week, non-school-week and evening limits) and state minor rules for California, New York, Illinois, Washington, Oregon and Colorado, with configurable school calendars.

Scheduling, swaps, pickups and clocking warn or refuse before a minor exceeds a limit; the age is visible only to people who need it.

Interim default: only the owner records or reads birth dates and permit references; staff, managers and agents receive no birth and permit records.

Rule messages name the applicable rule and limit without revealing a birth date or age.

This privacy default was approved by ct on 23 October and reaffirmed on 24 October 2026.

The shipped non-agricultural core hour checks use an explicit dated school calendar, venue dates and Sunday–Saturday weeks; dates outside the calendar refuse.

A school-week-dependent limit additionally requires every date in that Sunday-through-Saturday week to be covered, and California or Washington next-day rules require the next date to be covered; unknown dates never imply non-school permission.

School-day, school-week and evening limits recheck publication, cover, swaps, open-shift requests and approval and clock-in; a late clock-out is retained with named exceptions rather than trapping an open clock.

Recorded approved, submitted and returned actuals join planning and clock limits without double-counting overlapping intervals; a pending reduction cannot remove approved hours.

Current approved corrections replace superseded work.

Worked-time submission, editing, clock closure and approval retain named violations rather than discarding worked time.

Colorado additionally checks eight hours in any elapsed 24 hours, and California permits the 00:00–00:30 extension only on a non-school date.

Recorded permit expiry is checked, but references remain employer-recorded, not verified.

Dated owner reviews bind required permit kinds and restrictive permit terms to the workplace.

All current matching permit reviews apply together, regardless of their order; the strictest daily, weekly and clock-window terms prevail.

Manual time uses its recorded workplace, clock closure uses the matched shift and every transferred segment uses its own workplace.

New transfers recheck minor rules before being accepted; completed work remains retained with named exceptions.

Washington checks recorded parent and applicable school authorization, class release, continuous adult-supervision evidence after 20:00 and its supported six-hour and 28-hour special variance; New York late school-week work checks parent and next-school-day consent.

These employer records do not verify legal authority or live presence.

Other exception variants remain unimplemented.

## SCHEDULE-005

Managers print or export the published week as PDF by site, role or employee and show a read-only wall schedule on a site screen, each stamped with the revision and publication time.

Posting records support POLICY-002 posting duties, and a later change marks printed copies superseded in the app.

Private notes, wages and leave reasons never print.

Owners and managers print.

A printed copy is a PDF built from the rows recorded at printing (person, position, shift times and shift label; never pay, contact details, notes or time-off reasons), so it downloads byte-identical later, stamped with its posting time.

Its revision is the week's publication number: 1 for the first publication of that week, 2 for the next.

A copy is superseded once the week's current published schedule, read with the same cafe, position or person, differs from what it printed; when a newer publication caused that, the copy shows that publication's time.

The wall display is a read-only page for one cafe's current week, opened on the site screen in an owner or manager session, and reloads every minute.

Private shift notes are SCHEDULE-004's to keep out and posting duties are POLICY-002's.

## SCHEDULE-006

Managers and affected employees see each shift's history: who created, moved, reassigned, swapped, canceled or republished it, when, why, and which notices and acknowledgments followed.

Managers compare any two published revisions of a week as a diff by person, site and hours, and export the change log for POLICY-002 records.

Each published shift continues a shift line across the revisions of its week: a republished row continues the current revision's row with the same person, times and cafe, else it starts a new line.

A manager moves or reassigns one shift within its week (`shift.change`) or cancels it (`shift.cancel`), each with a reason, before it starts and while it is not waiting for call-out cover; that publishes a new revision of the week in which only that shift differs, the changed shift's ROSTER-003 confirmation starts empty, and open swaps and call-out offers on the unchanged shifts follow them.

A published week may also carry a reason.

Swaps, call-out cover and COST-002 substitutes change the published shift in place and appear in its history at their own times.

A shift's history lists, oldest first, its created, moved, reassigned, swapped, covered, canceled and republished (unchanged) events, each with who decided (the person's name, or Owner), when, why and the shift as it then stood, and its acknowledgments (the assignee's ROSTER-003 confirmation, or their consent to a swap).

No schedule notice is sent yet, so each event's notice state reads "not sent: in-app schedule only until NOTICE-001"; NOTICE-001 fills it with its delivery and acknowledgment states before it ships.

Managers read every shift's history; an employee reads the history of any shift line they were ever assigned (`GET /api/lanyard/shifts/{id}/history` and the Schedule's changes card).

Managers compare two published revisions of a week (`GET /api/lanyard/weeks/{week}/compare?from=&to=`) by shift line as added, removed and changed shifts with the net minutes each person and cafe gain or lose, and export the week's change log as CSV (`GET /api/lanyard/weeks/{week}/changes.csv`: time, shift line, action, employee, previous employee, times, cafe, by, reason and notice state); POLICY-002's records inherit this export.

## COVER-001

Employees offer a shift or propose an exchange; eligible coworkers consent and a scoped manager approves the exact exchange.

Availability, qualification, rest, overtime, leave and coverage are rechecked at decision time.

Pending swaps do not change responsibility; concurrent requests cannot assign the same shift twice.

Swap eligibility reads each person's effective AVAIL-001 pattern for the swapped dates.

An employee offers one of their upcoming published shifts to a named coworker, or proposes exchanging it for one of that coworker's upcoming published shifts at their cafe; an eligible coworker is active, has the same home cafe and (when the proposer has one) the same position, and is not hidden from the ROSTER-004 team view.

The proposer sees only coworkers and shifts that pass the checks, and a refusal names the reason only to the person it concerns or a manager.

The proposal pins each shift's revision.

Proposal, consent and approval each recheck both moves: the shift is still published to the same person at the pinned revision, not called out and not started, and the taker, after giving up their own side of an exchange, has no overlapping shift, is available (AVAIL-001 pattern or dated availability) and has no approved leave across it; projected weekly hours over 40 or daily over 8 are shown as overtime before approval, never refused or hidden.

Until TEAM-001 brings site scopes the owner decides any swap and a manager decides only swaps whose shifts are all at their home cafe, never one they are in.

Approval moves both shifts in one write, marks each taker confirmed and closes every other open swap on either shift; until then each shift stays with its original assignee.

Each person reads the swaps they are in with both names and outcomes in the app; that in-app record is the only notice Lanyard sends today, and push, SMS, email and acknowledgment are NOTICE-001's.

Coverage holds by construction because each shift keeps one assignee of the same position; qualification checks are PEOPLE-002's, rest rules POLICY-001's and the overtime premium estimate COST-002's, each joining swap rechecks before it ships.

## COVER-002

Managers publish unassigned shifts to eligible staff or a controlled pool.

Employees see job/site/rate details and request pickup; manager policy determines approved pickup versus explicit final approval.

Atomic assignment closes all other offers, rechecks eligibility and prevents duplicate pickup or silent coverage loss.

A SCHEDULE-002 template row saved for a position without a person becomes an open shift when the template is applied.

The owner posts for any cafe and a manager only for their home cafe until TEAM-001 brings site scopes, choosing per open shift whether the first eligible request is approved at once or a manager approves one request, and optionally a pool of named people.

An eligible person is active, not hidden from the ROSTER-004 team view and in the pool, or without a pool at the shift's cafe and (when set) position, with no overlapping shift, availability (AVAIL-001 pattern or dated windows) across it and no approved leave; their projected week hours and any overtime (over 40 a week or 8 a day) are shown to the manager before approval, never refused or hidden.

Staff see only open shifts they may request, with cafe, position, label, times and their own hourly rate when EARN-001 estimates are on.

Assignment rechecks eligibility, adds one published shift confirmed by the taker to the week's published revision (refused until that week is published), closes every other request and marks the open shift filled; revision fences refuse a second pickup or approval.

A saved week keeps its open shifts as position-only rows; applying them adds draft open shifts to the new draft, posted for manager approval when that draft is published and superseded with it otherwise.

The in-app request record is the only notice; NOTICE-001 delivers notices, PEOPLE-002 qualifications join eligibility, COVER-004 adds tiers and priority and COST-002 the premium estimate.

## COVER-003

Employees report an absence or managers record a call-out against a shift with minimal private reason disclosure.

The manager sees a qualified available replacement shortlist, cost/overtime effects and timed offers; employees accept and a manager approves assignment.

An unfilled shift escalates to the responsible manager and remains uncovered until accepted, then attendance is monitored through actual clock-in.

Its replacement order keeps AVAIL-001's ranking: teammates whose effective pattern prefers the whole shift come first.

Until TEAM-001 adds finer scopes, the owner acts for admin and every cafe, and a manager acts only for shifts at their home cafe.

Current eligibility uses active staff in the caller's position (any position if unset), AVAIL-001 availability, approved leave, overlap and the existing 40-hour weekly/8-hour daily checks; PEOPLE-002 qualifications and POLICY-001 rest and jurisdiction rules inherit these checks before shipping.

The shortlist shows scheduled hours before and after, the offered shift's USD wage estimate and difference from the original assignee (minutes times current hourly cents divided by 60, rounded to a cent; unknown rates stay unknown), and COST-002's projected overtime and premium estimate.

The coverage report uses the current published assignment and recorded punches captured by its as-of instant; it is a read, never a fabricated clock or response.

In-app offers and the employee's acceptance are the notice and acknowledgment until NOTICE-001, which inherits real delivery channels for call-outs, replacement approvals, and reopened cases before shipping.

Offers pin the shift revision, follow COVER-004's configured tiers (the preferred-first shortlist when no cafe order is saved), and expire at shift end; an expired offer cannot be accepted or approved.

A waiting case is actionable to the owner and cafe managers.

An approved replacement remains assigned awaiting a recorded clock-in; when CLOCK-004's configured no-show point is reached with neither its matching punch nor covering approved time, the case reopens for those managers while the assignment stands.

A manager explicitly refreshes a waiting or reopened case to close outstanding offers and issue a fresh eligible shortlist, excluding the original caller and current replacement; a new acceptance and exact approval change the assignment, retaining earlier offers, replies and approvals.

Only a recorded replacement clock-in verifies coverage.

Legacy offers without a recorded shift-revision pin remain readable and labelled legacy, but cannot be accepted or approved; the same explicit refresh issues fresh pinned offers without inventing historical consent.

## COVER-004

Managers choose how open shifts and replacements are offered: to all eligible staff at once, in timed tiers by priority (part-time staff who want more hours, preferred availability, fewest hours this week, seniority or a custom ranking) or first-come pickup.

Where a POLICY-002 preset requires offering hours to existing staff before hiring or using temporary workers (San Jose, Seattle, San Francisco and New York City), the offers and responses are kept as the compliance record.

Each COVER-002 open shift is posted with its order: everyone eligible at once, or tiers of a chosen size (1–50 people) opening a chosen number of minutes (1–1440) apart from the posting time; first-come pickup is COVER-002's approved pickup with either order.

At posting, the people eligible under COVER-002 are ranked by the rule, ties by fewest published minutes in the shift's workweek, then name: part-time staff who want more hours (their effective AVAIL-001 pattern's preferred weekly hours exceed their published hours in that workweek) first, then other part-time staff, then employment type not set, then full-time; a whole-shift AVAIL-001 preferred pattern first; fewest hours; earliest start date first with no start date last; or the manager's listed order with unlisted people after.

Tier k (from 0) opens k × minutes after posting and everyone else eligible may request once the last tier has opened; a person sees and may request or decline the shift only from their tier's opening, and tiers stay open after the next opens.

The open shift keeps its offer log: each tier's people and opening instant, and each decline, request, approval and closure with its time.

Open shifts a published SCHEDULE-002 template row posts are offered to everyone eligible at once.

Call-out replacements follow the cafe's saved replacement order (everyone qualified at once when none is saved), set by the owner or a manager of that cafe until TEAM-001; each offer carries its tier and reaches its person at the tier's opening, and replacements are always manager-approved (COVER-003).

The owner records each person's employment type (part-time, full-time or not set) and optional start date on People; an unset type is never treated as full-time.

The owner alone turns on a cafe's access-to-hours rule, labelled with the San Jose, Seattle, San Francisco and New York City ordinances; POLICY-002's presets set it for covered cafes when they ship, and until then Lanyard does not decide whether an ordinance applies.

With it on, an open or filled open shift at that cafe lists the existing active staff at the cafe (and position) who are part-time or have no employment type (shown as "employment type not set" for the owner to confirm) and whom no tier of its offer log reached while it was open; a person added to Lanyard after the shift was posted, at that cafe and position, is a hire, and the open shift and that person's People row are flagged while anyone is still owed the offer.

The flag clears once every owed person was offered the hours (a filled shift keeps the flag when it was filled first).

Employment type and start date are read by managers and the person only, and are erased with an unused person.

The in-app records are the only notice (NOTICE-001 delivers).

## ROSTER-004

Employees see who else works their site, role and day on the published schedule, showing coworker name, role and shift times only, so they can arrange swaps and handovers.

Managers choose per site whether staff see the whole site or only their role, and can hide a person for safety reasons.

Drafts, wages, leave reasons, contact details and other sites stay hidden.

By default each site shows staff its whole published team; an owner or manager may narrow a site to the viewer's own position.

A staff member's site is their home cafe on People; a shift belongs to the cafe it was scheduled at, else its person's home cafe, and an installation without cafe names is one site.

Role means the person's position on People.

The team view lists every currently published shift at that site (never a draft or superseded revision), each as coworker name, position, start and end only.

A hidden person appears in no staff team view at any site, their own view included, staff never learn who is hidden, and the hidden person's own schedule is unchanged.

Each site's setting is saved as an exact revision.

## NOTICE-001

Publication, changes, pickups, swaps and cancellations create recipient-specific in-app, push, email and US SMS notices in the recipient's language (LANG-001), using APNs/FCM, Resend and Twilio as supported delivery services.

Deduplicated attempts expose queued, provider-accepted, delivered where observable, failed and employee-acknowledged states separately.

Consent, quiet hours, urgent policy, US sender registration and opt-out preferences control contact; sensitive leave/pay data is excluded.

COVER-001 swap proposals, consents and decisions and COVER-002 open shifts and pickup decisions reach their people through it; until then the in-app swap record is the only notice.

TIME-007's forgotten clock-out reminder is one of its notices: when a punch reaches its reminder point the employee receives it by push or SMS under the same consent, quiet-hour and opt-out preferences; until then TIME-007 shows it only in Lanyard.

COVER-003 call-outs, replacement approvals and reopened cases, COVER-004 tier offers (when each tier opens) and LOG-001 mentions are notices too; until then each is shown only in Lanyard.

## NOTICE-002

Managers set shift reminders, acknowledgment deadlines, open-offer expiry, late/no-show and missed-punch/break alerts, timesheet review cutoffs and payroll review reminders.

Durable scheduled work survives restart, deduplicates per shift/revision/period, stops obsolete notices after resolution and escalates unresolved exceptions to an accountable manager.

Exact semantics (ct 22 October 2026): owner for every cafe and managers for their home cafe until TEAM-001 set per-cafe reminders (off by default; CLOCK-004's late/no-show rules reused); each due item is one durable row unique by kind, subject, revision or period, recipient and due time, processed by a seed scheduled handler at least every 15 minutes, never duplicated by restart or replay and withdrawn with a reason, never shown late, once its purpose has passed.

Employee reminders reach the employee; exception and payroll reminders reach the cafe's managers other than the employee and the owner; one escalation per unresolved item reaches the owner as accountable manager until TEAM-001 (none to oneself).

Approved resolution, a received punch or approved time, the employee's confirmation of the current revision, offer close or period lock withdraw pending follow-ups in the same transaction; a note never does.

Reminders are shown in Lanyard only, carry no pay, wage, leave or call-out reason, and are labelled as such; configuration and escalations are audited.

## CAL-001

Employees subscribe to private revocable iCalendar feeds in Google Calendar and Outlook Calendar.

Published assignments, changes and cancellations use stable event identities and correct site time zones; private notes, coworkers and draft shifts are excluded.

The app states provider-controlled refresh and does not present a subscription as immediate two-way scheduling.

## FEEDBACK-001

After clock-out employees may rate the shift, leave an optional comment or flag an issue (understaffed, equipment, safety, conflict).

Managers see feedback by site, shift and manager with trends, reply and mark it resolved; where the employer enables it, an employee may hide their name from the site manager.

Feedback never affects pay, approval or scheduling rank.

Today feedback answers one phone-clocked shift, once, from its timesheet: a 1–5 rating, a comment, any of the four flags, or a skip; the shift's cafe is its matched shift's cafe, else the person's home cafe, and its manager is whoever published that shift's week.

The owner reads every cafe's feedback and a manager their home cafe's, until TEAM-001's site scopes; skips are kept only for their author.

The weekly report is the Time screen's week: response count, flags by kind and the average rating against the previous week, filtered by cafe and manager.

A reply is read by the author; a manager or the owner marks it resolved.

The owner, acting for the employer, turns anonymous feedback on for the installation (off until then); an anonymous answer, safety flags included, shows managers and the owner its cafe, date, manager and content only, never its author, shift or timesheet.

Its author, clock, history actor and command digest are stored only as HMAC-SHA256 digests keyed by the installation secret, so its records, history and the installation archive alone never name the author; inside the installation the keys serve the author's own view and replies and the one-answer-per-shift fence, and a restore into another installation keeps the answer with no author.

Events on it name no one and are read by no one (AUDIT-001).

Feedback lives in its own records: timesheets, approvals, payroll, schedules, the call-out shortlist and agent context never read it, and FAIR-001 and OPT-001 carry that in their text and acceptance before they ship.

## LOG-001

Managers keep a daily logbook per site with entries by category (sales notes, incidents, maintenance, staffing, menu outages) and mentions, read by the next shift's managers with read receipts.

Entries link to shifts, people and attendance exceptions; corrections are new versions, and an incident exports for insurance or for HR follow-up in Willow.

Until TEAM-001 brings site scopes, the owner (acting for admin) writes and reads every cafe's logbook and a manager only their home cafe's; staff and agent keys never read it.

An entry has a venue date, one category (sales notes, incident, maintenance, staffing or menu outage), text, its author's name, up to five attachments per entry, each up to 10 MB, held in Base’s R2 bucket custody (createPortability buckets) and served only to its readers, mentions of that cafe's active managers, and optional links to a shift at that cafe, a person whose home cafe it is and an attendance exception (a timesheet carrying a TIME-003 exception) of a person there.

The next shift's managers are that cafe's managers: any of them other than the author acknowledges an entry once per revision, and each read receipt keeps who, when and the revision read.

A correction needs the entry's exact revision and keeps every earlier version with its text, category, mentions, links, attachments, author and time.

Read receipts refer to content revisions; marking an entry read does not create a fresh content revision to acknowledge.

Older receipt record revisions are mapped to the entry’s stored edit boundaries and retained as recordRevision, preserving original authors and timestamps.

Search filters by cafe, category and month of the entry date, newest first.

An incident (only) exports as a text file with its links, attachment names, sizes and SHA-256 hashes, mentions, read receipts and earlier versions; Lanyard sends it nowhere, and delivery to Willow is HR-001's.

The in-app mention is the only notice (NOTICE-001 delivers), and PRIVACY-001 carries retention and legal holds for entries.

## CLOCK-002

Current phone web clients persist encrypted pending clock, break and CLOCK-008 job-change events across page closure, client/device restart and loss of service, showing captured versus received times and pending state.

The actor-scoped IndexedDB outbox uses AES-GCM and a non-extractable key, serializes tabs, and replays original command identities in capture order.

Accepted entries are deleted; rejected originals and dependent events stay unresolved on the device and are submitted for manager review once authority is available.

Revoked sessions never apply time; the next owner or manager sign-in on that device sees only the count of unsynced punches from revoked sessions and may explicitly submit their originals for review.

The server allows recovery only for the owner or the employee’s home-cafe manager, until TEAM-001 supplies finer scopes.

Review retains originals, device-reported errors, receipt time and a reasoned resolution by another authorized manager, never silently applying rejected time; TIME-003/009 provide reviewed missing/corrected time.

Sign-out warns of the saved count before deleting the actor’s local originals and key; another employee’s interface exposes none.

Clock skew, out-of-order and conflicting captures remain explicit.

Offline punches use the TIME-005 rule effective on their captured clock-in date.

CLOCK-001 kiosk and MOBILE-001 native clients inherit this encrypted persistence, reconciliation, revocation and review obligation before shipping.

## CLOCK-003

Employers configure per-site geofences and explicit mobile location permissions for punch-time verification, showing accuracy and reasoned exception paths when location is unavailable.

Clocking location is limited to the event, with no background employee tracking; supervisors review disputed or out-of-zone punches without changing captured facts.

Phone punches may also require a punch photo under CLOCK-005.

Facial-recognition matching and dedicated hardware verification are optional partner integration.

An out-of-zone punch records an exception on its timesheet, which TIME-008 bulk approval skips.

When it ships, the punch's location and out-of-zone flag join the TIME-009 approval review row.

Current native API foundation: the owner alone configures an explicitly consented circular site policy, accuracy limit and elapsed retention days.

Native clock-in and clock-out require an active owner-enrolled device when the policy is enabled.

Coordinates require employee notice acknowledgment and explicit consent, and an observation within one minute of the captured event.

Client coordinates are reported evidence, not hardware-attested location.

The whole reported accuracy circle must fit inside the fence to count as inside; poor accuracy, an uncertain boundary, denied permission and absent evidence retain named exceptions.

Only the employee and owner read coordinates; managers and agents do not.

Owner review adds a reason without modifying captured facts.

An owner can hold a receipt and explicitly erase its coordinates after its retained policy period; no automatic deletion runs, and erasure fences older archives while retaining punch facts and flags.

RL-102 resolves this location boundary. TEAM-001/ACCESS-003 still owe scoped readers; PRIVACY-001 to PRIVACY-003 govern dispositions.

The native browser clock requests one fresh position only after notice acknowledgment and explicit consent at clock-in or clock-out; opening the clock, breaks, transfers and retries never request a position.

Browser denial, timeout, missing support and stale observations keep a named coordinate-free exception.

Dedicated site settings are not yet implemented.

## CLOCK-004

Managers see who is scheduled, present, on break, late, missing or clocked at the wrong site, with freshness and unresolved conflicts.

Scheduled shift boundaries and configured grace periods generate accountable late/no-show alerts and coverage actions; published or confirmed shifts alone never count as worked.

The board is read as of an instant (now on Time; any instant through `GET /api/lanyard/attendance?asOf=&site=`) and lists the published shifts that start on that venue date or are running then, at every cafe for the owner and, until TEAM-001 brings site scopes, at a manager's home cafe.

Each shift is matched to the punch captured by then: its TIME-006 matched clock, else the person's unmatched clock that began within two hours of the shift start.

A shift is scheduled (before its start), due (within the late grace), present, on break (an open BREAK-001 break), clocked out, covered by approved time, not clocked in, or a no-show; minutes late are shown past the grace.

Freshness is when the punch was received and how long after its capture (a punch captured offline shows the gap, and a read as of an earlier instant marks punches received after it).

A punch whose network matches another cafe's CLOCK-007 approved range or enrolled browser is shown as clocked at that cafe; CLOCK-003's geofence inherits this before it ships.

Unresolved conflicts are the punch's open exceptions and a call-out still waiting for cover.

The owner sets an attendance rule per cafe: a late grace (0–60 minutes after the shift start) and a no-show point (5–240 minutes, after the grace).

With no punch by the grace, the owner and that cafe's managers see a late alert in Lanyard, escalated to a no-show alert at the no-show point; alerts are computed at each read, so no background job runs, and a cafe without a rule shows the board without alerts.

Push and SMS delivery of alerts is NOTICE-001's and repeat escalation NOTICE-002's.

A manager of the cafe or the owner records handling an alert with a note (who and when), which never closes it; the board's cover action calls the shift out to COVER and COVERAGE-001 offers.

Only a received punch for the shift by whoever holds it, or approved time covering it, closes an alert.

## CLOCK-005

Owners turn on photo capture at clock-in, clock-out and optionally break punches, per site and per device type (shared kiosk, employee phone, browser clock).

The client takes a still photo at the punch and stores it with that punch event; approvers see it beside scheduled and captured times in timesheet approval (TIME-009, TIME-008) and on manager mobile.

This is not face matching: no face template is created or compared, and facial-recognition sign-in remains optional partner work under BOUNDARY-001.

Each employee sees a recorded notice before first capture at a site; a refused or failed camera records an explicit exception rather than silently omitting the photo.

Photos are readable only by the employee and scoped approvers, never reach agents or reports, and follow PRIVACY-001 retention and erasure.

A missing required photo records an exception on its timesheet, which TIME-008 bulk approval skips.

When it ships, the punch photo joins the TIME-009 approval review row.

Phone and browser requirements are separate site settings, using the existing owner-enrolled, revocable clock credential to classify the device; this employer label is not hardware attestation.

Unclassified or revoked credentials use the stricter enabled setting, never a user-agent hint.

Site-wide kiosk requirements apply at the next request; a device lacking explicit employer photo consent at enrollment is refused until the owner re-enrolls it.

Existing photo-enabled enrollments keep their stronger each-capture requirement.

Site-only requirements honor the optional break setting and do not collect a job-transfer still.

The owner explicitly approves each site policy, and employees acknowledge the recorded notice and consent separately to each required still; a declined or failed camera keeps the punch with its exception.

Native and kiosk clients take a still at capture time and stop every camera track immediately afterwards.

The existing ct-approved reader fence remains employee and owner only: the owner sees images alongside captured punches during review, and other approvers do not receive photo identifiers or bytes.

Photo bytes never enter agent context or rejected-capture reports.

Until PRIVACY-001 supplies broader dispositions, the owner can place/release a reasoned hold and explicitly erase only photos older than the site's configured elapsed retention days from captured time; a former-employee erasure additionally requires deactivation.

Holds refuse erasure, nothing is deleted automatically, and captured time, exceptions and erasure receipts remain.

Erasure advances Base's redaction/transfer fence; owners must still retire old offline backups that cannot know about later erasure.

This conservative custody/retention default awaits ct confirmation for CLOCK-005; TEAM-001, ACCESS-003, TIME-009 and PRIVACY-001 inherit approval before extending photo readers or dispositions.

## CLOCK-006

Owners configure short questions shown at clock-in or clock-out per site or role (breaks taken, injury today, cash tips declared, or a custom yes-no or number), with required answers, Spanish text and versioned wording.

Answers attach to the punch, open BREAK-001, TIME-003 or safety follow-ups when they indicate a problem and feed TIPS-001 declarations.

Changing a question never rewrites earlier answers.

Questions apply by the punch's cafe (its TIME-006 matched shift's, else the person's home cafe) and the person's position, each optionally required.

Until LANG-001 brings a language preference the clock shows the English and Spanish text together; LANG-001 picks one per person before it ships.

Answers are given at clock-in or clock-out (a TIME-007 confirmation asks none), checked before anything is written, and kept on the punch and its timesheet with the wording and version they answered; rewording a question makes a new version and never rewrites earlier answers.

A "no" to the breaks question records the BREAK-001 exception "missed break reported"; a custom yes-no question flagged on an answer records "<question>: <answer>" as a TIME-003 exception; custom numbers are recorded only.

Injury answers are kept only in a safety follow-up, read by the employee, the owner and the managers of that cafe (never coworkers or agents), opened by a "yes", resolved by the owner or one of those managers (not the employee) with a reason the employee reads, and kept in the archive.

Cash tips are declared in dollars and cents, kept in cents and listed per person and day for managers; TIPS-001 takes them into its tip pool draft as its employee-declaration input.

Agents never receive punch answers.

## CLOCK-007

Owners enable a web time clock for back-office computers, restricted per site to approved public IP ranges or enrolled browsers, so staff can punch from a store computer without a kiosk.

Punches from other networks are refused or flagged as configured, the network identity is recorded with the punch and no other device data is collected.

Only the owner sets a cafe's rule: off (the default; phone clocking from anywhere), refuse or flag, with up to 50 approved IPv4 or IPv6 CIDR ranges (a bare address is one host).

A punch belongs to its TIME-006 matched shift's cafe, else the person's home cafe; both clock-in and clock-out are checked against that cafe's current rule at the punch.

The network identity is the client IP Cloudflare reports (CF-Connecting-IP) and which approval matched (approved range or enrolled browser), recorded on the punch and its timesheet only where the cafe has a rule; no user agent, location or other device data is read.

The owner enrolls the store computer's browser for a cafe with a label: a 256-bit random token set only in an HttpOnly, Secure, SameSite=Strict cookie, kept in D1 as its SHA-256 alone, revocable at once, excluded from archives (a restore re-enrolls), with enrollment and revocation recorded as activity.

A punch from neither is refused naming the cafe, or accepted with the "off-network punch" exception that TIME-008 bulk approval skips.

The recorded IP is read by the owner and managers on the timesheet and by the employee on their own, never by agents or in the payroll CSV.

## CLOCK-008

A clocked-in employee switches job (for example server to bartender) or, where permitted, site from phone or kiosk without clocking out.

Each segment keeps its own job, site, rate and pay codes, overtime still aggregates across the day and week, and a transfer to a job the person is not qualified for is refused.

Transfers keep SCHEDULE-007's work-area reconciliation: on a punch whose shift has a pinned area plan, transfer segments and areas count each payable minute once within the enclosing timesheet, each segment keeps its retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area difference, once, under the enclosing timesheet's single payroll claim.

Today the phone clock's **Change job** (`clock.transfer`: commandId, capturedAt, job and optional cafe) records the change on the person's own open punch through CLOCK-002's encrypted outbox under TIME-001's command identity, after the clock-in, the last change and any finished break, never during a break or after a TIME-007 provisional close.

A punch starts on its matched shift's job and cafe (no job at the home cafe without a shift).

The new job, its skills and certifications and the cafe must hold under PEOPLE-002 from the change to the shift's end; a cafe change is permitted only to a cafe on the person's PEOPLE-002 eligible sites and passes that cafe's CLOCK-007 network rule like a clock-in there (refused, or accepted and flagged off-network); clock-out follows the last change and is checked against the networks of the cafe then being worked, while break, meal-deduction and clock-out question rules stay those of the punch's starting cafe.

At clock-out the changes replace the shift's pinned SCHEDULE-004 area plan for that punch: its payable minutes (after TIME-005 rounding and unpaid meals) are allocated over the segments in proportion to elapsed time, whole minutes by largest remainder with the earlier segment first, and each segment is priced at approval from its own effective-dated job rate.

The timesheet, REPORT-003 interval labor (each segment at its own cafe) and the payroll file carry each segment's job, cafe, minutes and the pay code regular, with its retained rate shown to managers only; BREAK-001 premium inputs stay on the enclosing timesheet.

COST-002's projection and EARN-001 count the whole punch toward the day and week, and PAY-001 inherits classifying each segment's overtime and other pay codes.

A punch that changed job is never approved by an AUTO-001 rule.

CLOCK-001's kiosk inherits job and cafe changes under these rules before it ships.

## BREAK-001

Employees start/end paid rest and unpaid meal breaks on phone or kiosk.

Configured site/state policy checks timing, duration, missed/short breaks, waivers and attestations, producing reviewable exceptions and premium-pay inputs when applicable.

Manual edits preserve employee facts and approval history; missing breaks cannot silently reduce payable work.

A missed or short break is recorded as an exception on its timesheet, so TIME-008 bulk approval skips that timesheet and names the exception.

Breaks are timed on the phone clock: a break start and end keep their capture time and command identity like clock events, one break is open at a time and clock-out waits for it to end; CLOCK-001's kiosk inherits the same break commands and checks before it ships, and POLICY-002's state and city presets fill the same policy fields.

The owner sets one policy per cafe, which applies to a punch at its TIME-006 matched shift's cafe, else the person's home cafe: on a span longer than the meal point (60–1440 minutes worked) a meal of at least the meal length (10–120 minutes) must start no later than that point after clock-in; a span up to the waiver limit (0 = never) may skip the meal only by the employee's own waiver attestation at clock-out; one paid rest of at least the rest length (5–60 minutes) is owed per full rest interval worked (0 = none, else 60–720 minutes) plus one when the remainder is longer than half the interval.

Spans and break lengths are whole minutes, rounded down.

At clock-out the punch's timed breaks are checked and each failure is recorded as an exception on the timesheet: "missed meal break", "short meal break" (no meal long enough), "late meal break" (long enough but started after the point), "missed rest break" or "short rest break"; the employee may add a note kept under a fixed break attestation.

Only finished timed unpaid meal minutes reduce worked time (a break still open at a TIME-007 provisional close ends at the confirmed end), so a missing or short break never reduces payable time.

When the policy pays premiums, a timesheet with a meal exception carries one hour of meal premium and one with a rest exception one hour of rest premium, at the employee's regular rate; payroll files list them as their own lines (pay_code "meal premium" or "rest premium" beside "regular" net hours), never as worked time, exported as signed differences when a correction changes them.

Manager edits, manager-entered time and employee requests are re-checked by their meal minutes (rest is unknown without timed breaks, so an earlier rest exception and premium stay); exceptions found at capture stay until a manager resolves them (TIME-003), the captured times and timed breaks stay beside an edit, and premiums follow the edited facts.

TIME-008 names an exception even when it arrived after the manager pinned the revision.

## BREAK-002

Owners may configure an automatic unpaid meal deduction per site (for example 30 minutes on shifts over 6 hours) when no meal was punched.

The employee sees the deduction at clock-out and confirms the meal was taken or reports it missed or interrupted; a report reverses the deduction for approval and opens a BREAK-001 exception.

Unconfirmed deductions are flagged in approval, and a site under a preset that requires recorded meal periods, such as California, cannot replace meal punches with a deduction.

The rule belongs to the clock's cafe (its matched shift's cafe, else the person's home cafe) and applies when the clocked span is longer than the threshold and no meal minutes were entered; entered meal minutes replace the deduction.

Confirming the meal deducts it and records the answer; reporting it missed or interrupted pays the full span with a "missed meal" or "interrupted meal" exception; no answer deducts it with an "unconfirmed meal deduction" exception.

Excepted timesheets wait for a manager's single approval and TIME-008 bulk approval skips them.

Jurisdiction presets that require recorded meal periods are POLICY-003's, which refuse this setting there.

## TIME-003

Employees review daily/period timesheets, submit missing-punch or correction requests and attest to work and breaks.

Managers compare schedules with captured events, investigate long/open/overlapping time and approve exact reasoned changes with employee visibility.

Exceptions stay assigned and open until resolved, and deadline reminders continue under NOTICE-002.

An edit changes the timesheet's revision, so a TIME-008 bulk approval pinned to the earlier revision skips it; time the employee confirms leaves TIME-008's unconfirmed state.

TIME-006's flagged early and unscheduled punches and TIME-007's provisional closes open such an exception, assigned and open until resolved.

Every exception recorded on a timesheet (TIME-006, TIME-007, BREAK-002 meal flags, CLOCK-007 off-network punches and the employee's own requests) is an open case on the approvers' list until a manager other than the employee resolves it with a reason; approval does not resolve it, and until TEAM-001 brings site-scoped approvers the case is assigned to every manager and the owner, as approval is (TIME-008).

An employee requests a missing punch, or a correction of their own latest approved time, with a reason and the attestation "I confirm these times and breaks are accurate."; the request is waiting time flagged "missed punch" or "employee correction" that a manager approves.

Confirming or correcting a TIME-007 provisional close may carry the same attestation.

The employee confirms time a manager or agent entered for them, which leaves the unconfirmed state; their own clock, requests and confirmed time are never unconfirmed.

Managers compare schedules with captured events in the TIME-009 review; long and open punches are TIME-007's provisional closes and overlapping time is refused at capture, entry and approval.

Employees read their own timesheets with each reason, edit, attestation, approval and resolution; NOTICE-002 carries deadline reminders.

## TIME-004

Payroll administrators define pay periods, collect employee/manager signoff and lock approved hours.

Separate reopening permission requires a reason and records who reopened which period; closed or provider-applied periods accept linked late/off-cycle adjustments instead of rewriting paid history.

Concurrent edits and transfers recheck period state.

Until TEAM-001 brings payroll roles the owner is the payroll administrator and holds the reopening permission: the owner defines, locks, reopens and closes periods, and managers sign off and approve time but never lock, reopen or close.

A period is an inclusive range of venue dates (up to 31 days, never overlapping another), and a timesheet belongs to the period holding its start's venue date.

Each employee with time in the period signs off their own hours and a manager signs off; locking needs every timesheet in it approved, no open punch in it, a manager signoff and every such employee's signoff, and records the locked rows (id, revision, person, minutes).

Every command that writes time is rechecked against its period in the same state version: in a locked period nothing is changed or added.

Reopening a locked period needs a reason, records who reopened it, when and the cleared signoffs and locked rows, and requires fresh signoffs to lock again.

Approved time in an open defined period is held from payroll preparation, and a prepared batch is refused at export once its time's period is reopened.

A locked period closes once every locked row is exported, with the owner's provider reference (the owner's record of the provider run; Lanyard does not verify it with the provider, which is SYNC-001's).

A closed period never reopens: its locked rows keep their times (a row may only be marked superseded by an approved adjustment) and its locked record never changes, while a correction or late entry dated inside it is marked as that period's adjustment, linked to the row it corrects, and exports as the signed difference.

Without defined periods time flows to payroll on approval as before.

## TIME-005

Owners configure, per site and effective-dated, nearest-increment rounding of punches (5 minutes, a tenth of an hour or a quarter hour) or snap-to-schedule within a window, applied at capture or at approval.

Rounding must be neutral: nearest-increment rounding rounds both up and down, and snap-to-schedule treats early and late arrivals and departures symmetrically, with early-arrival snapping limited to time the employee was not permitted to work under TIME-006.

A rule that only reduces paid time is refused at setup.

The captured time is always kept beside the payable time, both visible to the employee and approver, and a period report shows per employee the net minutes rounding added or removed.

Today a site is a cafe, and a punch's cafe is its matched shift's cafe, else the person's home cafe; a rule is in effect from its venue date until a later rule for that cafe starts, and the rule in effect on the clock-in's venue date governs the punch pair and is recorded on the timesheet at clock-out.

Nearest rounding moves each punch to the nearest 5-, 6- or 15-minute mark on the venue clock face, an exact half rounding up.

Snap-to-schedule moves a late arrival within the window to the scheduled start and an early or late departure within the window to the scheduled end; early arrivals are never snapped, because every accepted early clock-in is permitted or approved under TIME-006; punches outside the window or without a matched shift keep their captured time.

Only phone-clock time is rounded, never manual entries or corrections.

A rule applied at capture sets the payable time at clock-out and one applied at approval sets it when the timesheet is approved; payable minutes (the payable span less meal minutes) are what approval, payroll export and EARN-001 pay, and the payroll file keeps the captured start and end.

Only rules that round both ways save: a round-down-only or round-up-only rule is refused.

Approved time is never recomputed, so a later rule never changes it.

The period neutrality report is the Time screen's week: per employee, net payable minus captured minutes on that week's rounded timesheets.

CLOCK-001 and CLOCK-002 round the punches they capture under the same rule, and TIME-009 and PAY-002 show and export captured beside payable time; each carries that in its text and acceptance before it ships.

## TIME-006

Owners set per site or role how early an employee may clock in before a scheduled shift and whether unscheduled punches are allowed.

A punch before the window is refused with the time it opens, or accepted and flagged for manager approval, as configured; an unscheduled punch is refused, accepted pending approval or allowed for listed roles.

Flagged punches keep their captured time and open a TIME-003 exception; approved early time counts as worked.

Flagged early and unscheduled punches are recorded as exceptions on their timesheets, which TIME-008 bulk approval skips.

Owners set a rule per cafe and may add a position rule that replaces its cafe's rule; with no rule clock-in stays unrestricted.

A clock-in's shift is the person's published shift in progress at the captured time, else their earliest published shift starting within 12 hours after it; with none the punch is unscheduled.

The window is measured from that shift's start to the captured time; a refused punch writes nothing and names, in venue time, when clock-in opens.

Allowing unscheduled punches for listed roles is a position rule set to allow.

A flagged punch keeps its captured time and carries "early clock-in" or "unscheduled punch" on its timesheet, shown to approvers and skipped by TIME-008 bulk approval; it becomes payable only through a manager's single approval.

## TIME-007

Owners set a reminder after scheduled end plus a grace period and a maximum open-punch length per site.

A still-open punch gets a forgotten clock-out reminder (shown in Lanyard; its push and SMS delivery is NOTICE-001's), then at the configured point (scheduled end or the cap for unscheduled work) stops accruing and is marked provisionally closed with a TIME-003 exception.

A provisional end is never treated as fact: it cannot be approved or exported until the employee or a manager confirms or corrects it, and the original open state is retained.

A provisional close is an exception on the timesheet, which TIME-008 bulk approval skips.

The owner sets the rule per cafe (reminder grace 0–240 minutes after the scheduled end, longest open punch 1–24 hours); a punch follows the cafe of its TIME-006 matched shift, else the person's home cafe, and a cafe without a rule leaves punches open.

A punch with a matched shift is reminded and provisionally closed at the scheduled end plus the grace and stops counting at the scheduled end; a punch without one is reminded and provisionally closed at the cap and stops there; the cap bounds both.

The mark is computed from the stored punch and the cafe's current rule at each read and command, so it applies from the configured point without a background job and a rule change applies to punches still open.

The reminder is shown in Lanyard to the employee, and the open exception on the punch to managers; no push or SMS is sent until NOTICE-001 delivers it, and TIME-003 carries the exception case.

A clock-out captured after the point is refused; the employee or a manager confirms the provisional end or enters the corrected end, which submits the time with the "provisional close" exception and keeps the provisional end beside it, while the punch keeps its original clock-in and the mark.

Until then no timesheet exists, so nothing can be approved, and payroll preparation lists the punch as held.

## TIME-008

Time approvers filter timesheets by site, role, period and state (clean, exception, edited, unconfirmed) and approve many in one action within their scope.

The action pins each included timesheet's exact revision; at commit any item whose revision changed, that gained an exception (missed break, early or unscheduled punch, provisional close, out-of-zone or missing required photo) or that is the approver's own time is skipped, and the result lists approved and skipped items with reasons.

Each approval records the same actor, time and revision as a single approval, and nothing outside the approver's sites is touched.

Until TEAM-001 brings site-scoped approvers, owners and managers approve for every cafe, as a single approval does, and the cafe filter bounds the action: a pinned item outside the filter is skipped, never approved.

Cafe is the person's home cafe, role is their People position, period is an inclusive range of venue dates on which the work starts, and the states are exception (capture recorded an exception), edited (it corrects earlier approved time), unconfirmed (a manager or agent entered it rather than the person's own clock) and clean (none of these); edited time is also unconfirmed.

At commit a pinned item is skipped with its reason when it is missing, its revision changed, it is the approver's own time, it falls outside the filter, it carries an exception or the single approval refuses it (such as an overlap); every other item goes through the single approval and records its own time.approve decision.

No capture path records an exception yet: BREAK-001 (missed or short breaks), TIME-006 (early and unscheduled punches), TIME-007 (provisional close), CLOCK-003 (out-of-zone punches) and CLOCK-005 (missing required photos) each record theirs on the timesheet, and bulk approval skips them, before they ship; edits of waiting time (TIME-009's edit with a reason, and TIME-003's employee requests) change the revision.

## TIME-009

The approval screen shows per timesheet the scheduled, captured and payable times, variance minutes, breaks taken against required, punch photo and location where enabled, job and site, rounding effect, open exceptions, cost and the employee's running period and overtime totals, with filters for exceptions.

Approvers act from the same row: approve, edit with a reason or send back to the employee.

The review shows TIME-005 captured and payable time side by side.

Owners and managers see the review on every waiting timesheet: the scheduled time is the punch's TIME-006 matched shift (none for unscheduled or hand-entered time); variance is in whole minutes, start and end against the scheduled times (positive is later) and worked minutes against the shift's net minutes; breaks taken are the recorded meal minutes against the greater of the cafe's applicable BREAK-002 deduction and BREAK-001 policy meal minutes, never their sum.

Each threshold uses the captured span in whole minutes and applies only when that span exceeds the configured threshold; an employee-attested BREAK-001 waiver removes only the policy meal requirement.

Paid rest review shows recorded minutes and the count of breaks meeting the policy duration against BREAK-001's required count and minutes (one per full rest interval, plus one when the remaining span exceeds half the interval).

Untimed manual rest evidence is unknown, while a phone punch with no timed rests records zero; paid rest never reduces payable minutes; location is the punch's CLOCK-007 network where the cafe has a rule; job is the person's People position and site the shift's cafe, else their home cafe; rounding effect is payable less captured minutes; cost is payable minutes at the person's hourly rate, rounded half up to the cent; and the running week is the person's approved, waiting and sent-back minutes in the venue workweek (Monday to Sunday) starting no later than this one, with minutes over 40 as overtime.

The exception filter is TIME-008's exception state.

An edit with a reason sets the waiting time's new times as a new revision, keeps the captured times and minutes beside it and is never rounded; sending back with a reason returns the time to the employee, who resubmits the same or corrected times with an optional note before it can be approved.

Punch photos are CLOCK-005's and geofenced location and out-of-zone punches CLOCK-003's to add to the row before they ship.

## POLICY-001

Employers configure effective-dated FLSA workweeks and state and local daily and weekly overtime, double time, consecutive-day, rest and meal and minimum-rest rules; minor limits are MINOR-001 and reporting-time, call-in, split-shift and spread-of-hours premiums are PAYRULE-003.

Lanyard ships maintained presets, each versioned with its effective date and cited source, for: federal FLSA (weekly overtime over 40 hours); California (daily overtime and double time, seventh consecutive day, meal and rest periods with premium pay); Alaska (daily overtime); Nevada (daily overtime under its wage threshold, meal and rest periods); Colorado (daily and consecutive-hours overtime, meal and rest periods); Oregon (meal and rest periods); Washington (meal and rest periods); New York (meal periods); and Illinois (One Day Rest in Seven Act meal period and weekly day of rest).

Any other jurisdiction or employer rule is labeled employer-configured, unmaintained on the site and in every warning it raises.

Planning warns before assignment or publication; actual hours aggregate across jobs and sites and classify regular time, overtime and premiums with explainable rule and version inputs.

For a person working several rates, cost estimates use a weighted-average regular rate labeled as an estimate; the provider's regular-rate treatment stays authoritative.

Changing rules never silently rewrites closed payroll.

A preset that requires recorded meal periods, such as California, refuses BREAK-002's automatic meal deduction for its sites.

Policy checks also run when a SCHEDULE-002 template, copy or recurring shift is applied, and minimum-rest rules join COVER-001 swap rechecks.

Daily and state overtime it computes replaces the 40-hour weekly overtime in the employee's EARN-001 estimate.

Current implemented overtime-core settings are owner-maintained through `policy.save`; `policy.review` returns approved cross-site workweek classifications with retained rate and policy revisions.

Selected nonexempt break review estimates are available for California, Nevada, Colorado, Oregon, Washington, New York and Illinois, with separate cited break-rule versions.

Timed phone captures distinguish missing, short and out-of-window meals and missed or short paid rests; untimed meal totals cannot prove meal timing or paid rests.

California review estimates at most one hour for meal exceptions and one hour for rest exceptions per employee workday across cafes, separately from the overtime estimate.

Latest rest counts combine all retained workday service, including split service and prior-week context; a gap supplies neither paid time nor proof of a rest.

A captured rest crossing the employer workday boundary stays unresolved, and meal premium allocation across that boundary withholds a monetary premium estimate.

Other states report exceptions without inventing a California premium.

Illinois review flags a seventh consecutive worked date without a 24-hour gap, including prior-week work.

Planning warns that break timing is not recorded before publication; it does not certify a compliant break plan.

A reason is required on initial configuration as well as each revision; previous versions, actor and values remain retained.

No review mutates payroll.

These entries do not claim complete maintained meal or rest compliance.

Weekly payroll retains payable whole minutes by venue date, with daily premiums excluded from repeated weekly overtime.

An explicitly reviewed California employer workday recuts those retained allocations at its selected local-time boundary, preserves their approved rates and whole-minute totals, and includes prior-week daily context without replaying it as current-week paid time.

Conflicting cafe anchors require review and withhold a wage estimate.

California seventh-day treatment uses seven worked dates within the configured workweek.

Nevada uses a USD 18 hourly threshold; unknown wages retain the daily check.

Employer minimum rest is explicitly unmaintained.

A policy edit requires a reasoned review and cannot reach locked or closed payroll; prior effective versions remain readable.

Supported overtime and break catalogs are selected explicitly and older break implementations remain reproducible.

For a version change, `policy.preview` shows before-and-after open-workweek classifications and affected periods; `policy.save` requires that preview digest, rechecked against pending time, punches, rates, policies and periods, and retains the owner review.

New York factory and nonfactory selection is explicit: the noon-meal window starts at 11 AM, overnight noon windows are evaluated on the following calendar date, and required meals are matched independently of recorded meal count; California second-meal and Oregon work-period checks exclude unpaid meal minutes.

Colorado consecutive work carries across midnight, adjacent cafes, jobs and workweeks; the higher daily or consecutive calculation, including weekly overtime without duplicated premium minutes, supplies the estimate.

Only qualifying recorded meals reduce consecutive work; unknown deducted meals mark the estimate incomplete and refuse classified payroll.

Employee earnings use complete policy workweeks and retained rates, with daily overtime and double time, while preserving the employee period window and excluding unreviewed break estimates.

Risk projections, pending pickups and swaps use the same rules and weighted premium estimate; substitutes must avoid policy overtime and double time.

Existing manager cost readers receive aggregate estimates and cited versions; detailed actual classifications stay owner-only.

Settings provides catalog selection, cited versions, employer-configured rules, reviewed releases, worker applicability and supported alternate workweeks.

Worker applicability is retained separately for federal overtime, state weekly, daily, consecutive and seventh-day overtime, meals, rests and weekly rest; exclusions require an employer-recorded legal basis, evidence and reviewed preview.

No exemption is inferred from salary, title or role.

Washington additional-meal review uses an evidenced employee normal workday, retained through the same preview and approval.

At three or more additional worked hours it checks an additional thirty-minute meal independently of ordinary five-hour spacing; missing normal-day facts remain unknown and no shift duration is treated as that evidence.

Supported California Wage Order 5 elections, Alaska approved flexible work plans and Nevada mutual four-day schedules require explicit employee participation and retained evidence; unsupported deviations remain unresolved.

Settings and detailed review are owner-only until TEAM-001 supplies payroll administration.

Incomplete applicability, workday or alternate-schedule evidence withholds employee earnings and premium risk amounts; such candidates are never certified as avoiding overtime.

## POLICY-002

Site-specific predictive-scheduling policies track coverage, advance notice, good-faith estimates, employee consent, schedule-change/cancellation premiums, rest between shifts, access to hours and required records.

Lanyard ships maintained fair-workweek presets, each versioned with its covered industries and employer-size thresholds, rules and cited source, for: New York City (fast food and retail), Chicago, Philadelphia, Seattle, San Francisco (Formula Retail Employee Rights Ordinances), Los Angeles (retail), Oregon (statewide), Evanston, Berkeley, Emeryville and San Jose (Opportunity to Work).

Any other ordinance is labeled employer-configured, unmaintained.

A post-publication change previews consent/premium consequences and any employer-authorized exception; employees receive the changed revision and retain their response.

Policy dependencies never silently waive an obligation.

Posting duties are met from SCHEDULE-005 posting records.

The San Jose, Seattle, San Francisco and New York City presets turn on COVER-004's access-to-hours rule for a covered cafe and use its offer log as the access-to-hours record.

## PAYRULE-001

Payroll administrators define effective-dated differentials by time of day, day of week, site, role or shift tag, as a USD amount per hour or a multiplier, with a stacking order.

Approved hours split into differential segments, each with its pay code (PAY-001) and cost (COST-001); overtime classification follows the provider-confirmed regular-rate treatment.

Differentials appear in the employee's EARN-001 estimate.

Differentials subdivide SCHEDULE-007's reconciled work areas: they apply within each area's payable minutes approved from its pinned area plan (each minute once), price from that area's retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area, per-code difference, once, under the enclosing timesheet's single payroll claim.

The owner acts for payroll administration until TEAM-001/ACCESS-003.

Current differential inputs are additional straight-time pay, with explicitly mapped codes; no provider regular-rate confirmation is implied.

Venue dates and rule starts are inclusive, clock-window ends exclusive.

Overnight windows use separate calendar-day rules.

Amounts add USD cents/hour; multipliers act on the running rate after lower stacking orders, with rule ID breaking ties.

Whole payable minutes are allocated inside each retained work area by elapsed weight and largest remainder (earlier interval breaks ties); each rule increment rounds half up to cents per interval.

Approval retains effective rule versions, job rates and position/shift-label inputs; corrections use those inputs.

PAY-001, POLICY-001 and the provider connectors inherit differential regular-rate/overtime treatment before they classify it.

## PAYRULE-002

Owners keep a company holiday calendar seeded with US federal holidays and editable per site, and set holiday rules: a multiplier or added rate for hours worked on a holiday, holiday pay for eligible employees who do not work, and eligibility such as working the scheduled shifts before and after.

Scheduling shows holiday cost and approved holiday hours carry their own pay codes.

Holiday premiums appear in the employee's EARN-001 estimate.

Holiday premiums keep SCHEDULE-007's work-area reconciliation: on a segmented timesheet they apply within each area's payable minutes approved from its pinned area plan (each minute once) at that area's retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area, per-code difference, once, under the enclosing timesheet's single payroll claim.

The owner is the payroll administrator until TEAM-001/ACCESS-003 supply that role.

Federal seeding uses nationwide recurring OPM holidays for years from 1971 (MLK Day from 1986, Juneteenth from 2021, Veterans Day on the fourth Monday in October until 1978 and November 11 thereafter; eleven recurring holidays from 2021) on observed dates (Saturday → Friday, Sunday → Monday), separately for each site/year; it never overwrites employer edits.

One enabled holiday applies per site and venue date.

The latest effective site rule supplies either a total multiplier (1–10, two decimals; only the excess over 1 is additional pay) or integer added USD cents/hour, a pay code and 0–1440 non-work paid minutes.

With attendance eligibility enabled, the nearest published shift ending before the holiday and starting after it must each have approved time covering its full interval and payable minutes; absent adjacent shifts impose no condition, future/pending work waits, and missing elapsed work is ineligible.

Approval retains calendar/rule revisions, adjacent facts, allocated venue-date minutes and per-area rates; corrections retain the original holiday basis for matching date/job/area/site.

Each premium amount rounds half up to USD cents per retained area/date segment; payroll exports signed minute and cent differences by holiday/date/job/area/site/code.

Pending eligibility holds the enclosing time from export.

Non-work pay is owner-approved against an exact fact digest after the holiday ends, for home-site employees with no captured or pending holiday work, including retained inactive employees and scheduled shifts that were not worked; it creates a separate once-only payroll input and ACA paid-service fact, deduplicated against ACA-001 credits by the employer source reference.

These are employer-rule estimates and reviewed payroll inputs, never a wage payment or provider-confirmed payroll calculation.

Non-work corrections require the exact revision and a reason, retain history and export signed differences; non-work pay must be reversed to zero before overlapping worked time is approved.

Holiday work always needs human approval under AUTO-001.

## PAYRULE-003

Jurisdiction presets and employer rules produce premium-pay inputs when an employee reports for a shift that is canceled or cut short (California reporting-time pay, New York call-in pay), works a split shift (California) or exceeds a 10-hour spread of hours (New York), each with the triggering facts, rule version and pay code.

Premiums are reviewed payroll inputs, not final pay calculations.

These premiums appear in the employee's EARN-001 estimate.

Premium inputs keep SCHEDULE-007's work-area reconciliation: on a segmented timesheet they read the per-area payable minutes approved from its pinned area plan and each area's retained effective-dated job-rate basis without re-splitting, repricing or counting a minute twice, and a later correction exports only the signed difference per job, area and code, once, under the enclosing timesheet's single payroll claim.

The owner acts as payroll administrator until TEAM-001 adds that role; the owner or the person's cafe manager reviews inputs, never their own.

Rules retain their source and revision, the applicable employer-entered minimum wage and optional employer-configured minute thresholds.

California reporting inputs top up to half the scheduled minutes (minimum 120, maximum 240) when less than half was worked, at each retained job rate no lower than the configured minimum; California split inputs top up one minimum-wage hour after offsetting retained daily earnings above minimum, only for an employer-directed non-meal/non-rest, non-voluntary split away from the employee's residence.

New York hospitality call-in inputs top up to 180 minutes, capped at a confirmed fixed repeating shift's scheduled minutes; spread inputs add one minimum-wage hour for an elapsed span strictly over 600 minutes, including unpaid intervals.

The inputs require employer review of applicability and exceptions and never claim provider verification or final wages.

A zero-work arrival record retains the actual report and cancellation timestamps and scheduled source revision without fabricating worked time or changing the published schedule.

Daily inputs read all approved source work at the cafe/date and attach their full premium to one reviewed timesheet's claim; a later daily correction reconciles all earlier premium exports for that person/cafe/date/kind under its fresh anchor claim.

Proportional allocations use the existing payable work-area minutes, floor premium minutes and split-pay cents with the remainder in the last area, and retain source rates and rule; split-pay cents are authoritative after the earnings offset.

A date-moving correction reviews both the prior date (zero reverses) and new date.

## COST-002

As punches accrue, Lanyard projects each employee's workweek and daily totals, including remaining scheduled shifts at all sites, against POLICY-001 thresholds and alerts the scheduler and the employee's manager when overtime is projected, with the USD premium estimate and qualified non-overtime substitutes for the remaining shifts.

Swaps and pickups that would create overtime show it before approval.

A workweek follows PAY-009's group definition, Monday to Sunday by venue date for unassigned people.

The projection as of an instant (now on the Schedule; any instant through `GET /api/lanyard/overtime?week=&asOf=`) is the person's recorded time in the week that started before it (submitted, approved or sent-back timesheets, a pending correction replacing its source, and open punches counted up to the instant) plus their published shifts in the week, at every cafe, that start at or after it and have no punch yet; daily totals are the same minutes by venue date.

Configured POLICY-001 daily, consecutive-hours, seventh-day and weekly rules classify the projection, including double time; without a configured policy the threshold remains the federal 40-hour workweek.

For a configured policy the premium estimate uses half the weighted regular rate for overtime and the full weighted rate for double time, rounded to cents; the unconfigured federal path uses half the person's hourly rate for each projected overtime hour (straight time is already in COST-001's cost); a person without a rate gets no estimate and the alert says so.

Substitutes for each remaining shift are teammates in the person's position (everyone when unset) who are free for it under COVERAGE-001's overlap, availability and approved-leave checks and avoid projected overtime and double time under the effective rules with it, fewest projected hours first.

Alerts appear in Lanyard on the Schedule for the owner and, until TEAM-001 brings site scopes, the managers whose home cafe is the person's home cafe or the cafe of one of their remaining shifts; push and email delivery is NOTICE-001's.

Approving a substitute is a manager of the shift's cafe (or the owner) giving a remaining shift to a listed substitute, rechecked at approval; the shift records whom it moved from, who decided, when and why, and the new assignee's ROSTER-003 confirmation starts empty.

Pending pickup requests and swaps show each receiving person's projected hours, overtime and premium estimate to the manager before approval; overtime never refuses them, and an open shift posted for approval on pickup has no approval step, so its overtime appears in the alert.

## ACA-001

For employers at or near Applicable Large Employer size, Lanyard tracks hours of service (worked and paid leave) per employee against the Affordable Care Act 130-hours-per-month full-time test, supports the look-back measurement method (standard measurement, administrative and stability periods) for variable-hour employees and warns schedulers when planned hours would make one full-time for the period.

Hours and status export to the payroll provider or Willow for 1094-C and 1095-C filing, which Lanyard does not file.

The owner acts as payroll administrator until TEAM-001 and ACCESS-003 provide that role; managers read reports and scheduler warnings only for employees of their home cafe.

The owner defines variable-hour groups and standard measurement periods of 3–12 whole calendar months, an administrative period of 0–90 days, and the following stability period.

Full-time stability lasts at least six months and the measurement length; a non-full-time result is capped at the measurement length.

The separate monthly test is at least 130 hours; the standard look-back test is at least 30 hours per elapsed seven-day week over the inclusive measurement dates.

Only current approved payable time counts as worked service, across all sites; pending time and corrections are listed separately, and superseded revisions never count twice.

Payable minutes spanning venue dates are allocated in proportion to elapsed time, including proportional unlocated meal deductions and rounding, with whole-minute remainders assigned by largest fraction then earlier date.

Employer-recorded paid non-work credits (vacation, holiday, illness, disability, layoff, jury, military or other paid leave) carry a unique source reference, reason and exact-revision correction history; they create no worked time, payroll payment or leave-bank entry.

LEAVE-001, LEAVE-003, PAYRULE-002, PAYSYNC-004 and HR-001 inherit supplying paid-service facts without duplicating those credits before their paid-leave capabilities ship.

Reports use current source revisions filtered by service date and show their ids/revisions and monthly totals; a future as-of date is refused, unfinished months remain pending, and the look-back result remains pending until measurement ends and then names the stability dates.

A scheduler warning appears when recorded service plus future published shifts, or the reviewed draft replacing its week, crosses either the monthly or look-back threshold; a shift already represented by time or a punch is excluded from that projection.

The UTF-8 CSV carries measurement, monthly and source rows for the filer, with planned minutes separate from service; downloading records an audit event and performs no submission or filing.

The calculation basis follows the [IRS full-time employee definitions](https://www.irs.gov/affordable-care-act/employers/identifying-full-time-employees).

## TIPS-002

For employees paid a tipped cash wage, Lanyard checks each workweek, under the site's jurisdiction, that cash wage plus allocated or declared tips meets the applicable minimum wage and raises any shortfall as a make-up pay input.

It records time on duties that do not produce tips so the employer can apply its reviewed dual-jobs treatment.

Sites in jurisdictions that bar a tip credit (California, Washington, Oregon, Nevada, Minnesota, Alaska and Montana) refuse a tip-credit setup.

The owner, acting as payroll administrator until TEAM-001/ACCESS-003, records each cafe's tip-credit setup from an inclusive venue date: its US state or DC, the minimum wage that applies at the cafe in USD per hour and the jobs whose work produces tips.

That minimum wage is employer-entered and at least the federal $7.25; Lanyard keeps no state or local minimum wage rates and says so on the screen.

A later version starts on its own date, one saved for the same date replaces it, and each earlier week keeps the version in force on its dates; a setup in one of the seven barring states is refused and nothing is saved.

Each PAY-009 workweek, Monday to Sunday on the venue calendar for unassigned people, a person with approved minutes in a tipped job at a cafe whose setup is in force is checked: each payable minute counts on its venue date under PEOPLE-002's allocation and in its SCHEDULE-007 or CLOCK-008 job segment; the minimum wage due and the cash wage are those tipped minutes at the cafe's minimum wage and at their retained job rates, each rounded half up to the cent per venue date and segment; tips are the CLOCK-006 cash tips declared on those punches, counted in the workweek of the punch's first tipped minute.

A positive difference of the minimum wage due over cash wage plus tips is the make-up pay input, and a tipped minute with no rate on file leaves the week unchecked and says so.

Minutes in the cafe's other jobs are listed by job and cafe as non-tipped duty time and never enter the check; Lanyard applies no dual-jobs treatment itself.

Checks and make-up pay inputs are read on Payroll, as JSON and as a CSV whose download is recorded, by the owner and by managers who may read the person's wages (PEOPLE-002: their home cafe's people); Lanyard does not pay the input.

Ordinary hours-only files keep the separate make-up download; owner-selected mapped PAY-001 templates can include eligible single-site inputs under their own earning code with exact-source checks and signed differences.

TIPS-001's approved allocations join the declared tips, and PAY-001 maps the make-up pay input to its own pay code, before each ships.

## REPORT-002

Owners produce jurisdiction-scoped reports for audits: schedule postings and changes with notice given, consent and predictability-pay records (POLICY-002), meal and rest compliance and premiums (BREAK-001), minor-hour checks (MINOR-001), sick leave accrual and use (LEAVE-003), rounding neutrality (TIME-005), tip-credit make-up (TIPS-002) and punch edits with reasons.

Each traces to source revisions and is retained for the period its preset requires.

CT REPORT-002 ruling, 27 October 2026: APPROVE WITH RIDERS; REPORT-002 remains PARTIAL.

The live native owner may preserve the exact reviewed report with an explicit reason and affirmative owner authorization, retaining its original JSON, CSV, source revisions, integrity digests and authorization through later corrections, restart and supported installation archive restore.

The consent control records owner authorization; it establishes neither employee consent nor a statutory legal basis.

Existing source-specific consent duties remain.

Preservation and privacy administration remain existing-owner-only, with no automatic expiry or erasure.

Separately approved named audit grants now provide bounded read-only API delivery under TEAM-001 and ACCESS-003.

Indefinite storage describes the current technical behavior; it is not a ruling that every copied personal fact may lawfully be kept forever.

The owner can prepare, inspect, preserve and download an authorized audit packet now, and remains responsible for separately reviewed external disclosures and employee requests.

Owner credentials must not be shared.

Authority is governed by TEAM-001 and ACCESS-003.

Retention, holds and employee-rights disposition are governed by PRIVACY-001.

## REPORT-003

Managers see labor cost as a percentage of sales and sales per labor hour by site, role and 15-, 30- or 60-minute interval for scheduled, forecast and actual hours, using POS or SALES-001 data (SALES-001 already shows them per day and over the days entered, on scheduled hours), with targets per daypart and flags where actual labor percentage exceeds target.

Forecast hours arrive with DEMAND-001, which adds them to this report; until then it covers scheduled and actual hours.

The owner reads any cafe and, until TEAM-001, a manager their home cafe; staff and agent keys never read it.

A report is one cafe and venue day in 15-, 30- or 60-minute intervals on the venue clock.

Scheduled hours are published shifts and actual hours are live timesheets (a pending correction replaces its source) and open punches up to now; each counts by its overlap with the interval scaled by its paid minutes over its span (an unpaid break spread evenly), and cost is those minutes at the person's hourly rate, rounded to the cent per interval, overall and per position.

Sales are SALES-001 hourly sales: a 15- or 30-minute interval takes an equal share of its hour, labelled "hourly sales split evenly"; an hour without hourly sales (a day with only a daily value included) is incomplete, never zero.

Labor percentage is cost over sales to one decimal and sales per labor hour is sales over hours to the cent.

The owner and that cafe's managers save named dayparts per cafe (start and end on the venue clock, never overlapping, and a target labor percentage); an interval starting inside a daypart whose actual labor percentage exceeds its target is flagged.

## DASH-001

A site or multi-site manager opens one dashboard for today and this week: who is on now and late (CLOCK-004), open and unconfirmed shifts, pending approvals (time, leave, swaps, availability), overtime risk (COST-002), labor percentage against sales and budget, unresolved exceptions and the payroll cutoff countdown, each linking to its record and scoped to their sites.

Until TEAM-001 brings multi-site scopes, a manager's dashboard covers their home cafe and the owner (acting for admin) sees every cafe or picks one; staff and agent keys have none.

It reads as of an instant (now on the Schedule screen): today is that venue date and this week its Monday-to-Sunday venue week.

On now: CLOCK-004 board rows present or on break; late: rows clocked in after their cafe's late grace, plus missing and no-show rows.

Open shifts: COVER-002 open shifts starting this week that have not ended; unconfirmed: published shifts starting this week, not ended, that the employee has not confirmed.

Pending approvals: submitted time, pending time off, agreed swaps waiting for a manager and pending availability patterns of people at the cafe.

Overtime risk: this week's COST-002 alerts for people at the cafe.

Unresolved exceptions: timesheets carrying a TIME-003 exception with no resolution.

Labor percentage: this week's published shifts at each person's hourly rate (per shift, to the cent) over that cafe's forecast sales for the week, to one decimal, beside its labor budget percentage and marked over when above it, labelled "of forecast sales"; beside it, once SALES-001 sales are entered for the week, the scheduled labor of the days with entered sales over those sales, labelled "of entered sales" with the number of days; POS-001 sales join that line when it ships.

Payroll cutoff: whole venue days from today to the end date of the earliest open TIME-004 pay period not yet ended, or none without one.

Each item names its record and links to the card that resolves it; each count is its list's length, so resolving a record clears it.

## EARN-001

Employees see their own scheduled and worked hours this period, overtime and premiums so far, approved tips and an estimated gross pay labeled as an estimate before taxes and deductions, with the pay period and pay date.

Employers can turn the estimate off; it never shows coworkers' data, and the payroll provider's pay statement stays authoritative.

The period and pay date follow PAY-009 when assigned to a pay group; unassigned people keep the workweek, Monday to Sunday on the venue calendar, with a record counting in the week of its venue start date; scheduled hours are the person's published shifts less their meal minutes; approved TIME-005 payable minutes use complete POLICY-001 workweek classifications, including daily overtime and double time.

Straight time uses each retained rate; overtime adds half the workweek weighted regular rate and double time adds the full rate, labeled as an estimate.

Gross rounds once to cents and the displayed categories allocate its rounding cent; submitted time shows as pending and stays out of the estimate.

Estimates are on until the owner, acting for the employer, turns them off; with estimates off or no rate on file no amount or rate is shown, and with estimates off the person's own rate is withheld from their session.

The pay date is the owner's set number of days after the week ends, shown as not set until saved, and the owner's https link opens the provider's pay statement.

Premiums join the estimate with PAYRULE-001, PAYRULE-002, PAYRULE-003 and POLICY-001 (remaining statutory break premiums; daily and state overtime already supplies the estimate), approved tips with TIPS-001, and pay schedules replace the workweek with PAY-009; each carries that in its text and acceptance before it ships.

## PAY-001

Payroll administrators map employee, employment type, job, location, PTO, sick leave, holiday, regular, overtime and double time, differentials, break premiums, scheduling premiums and tip codes before transfer.

Approved hours and signed corrections carry effective policy and rate references and reconcile by period and employee.

W-2 employees and supported 1099 contractor workflows are explicit; contractor exports cannot silently apply employee overtime or tax treatment.

Providers without a live connector receive the same classified lines through PAY-002 templates and the named presets PAY-003 to PAY-008.

Classification keeps SCHEDULE-007's work-area reconciliation and CLOCK-008's job segments: a segmented timesheet's classified lines carry the per-area payable minutes approved from its pinned area plan (each minute once, together equal to the enclosing timesheet's payable minutes) and each area's retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area difference, once, under the enclosing timesheet's single payroll claim.

Each CLOCK-008 job segment's overtime and other pay codes are classified under that segment's own job, cafe and retained rate.

A TIPS-002 make-up pay input is classified under its own pay code for its person and workweek.

The current native mapped path uses owner-maintained templates and explicitly selected W-2 or supported 1099 workflows.

Policy classification uses retained POLICY-001 overtime-core rules and job rates after the complete workweek closes and all recorded time is approved; single-rate employee hours split into regular, overtime and double time, while supported contractor output contains regular worked time only and applies no tax treatment.

Approved employer-recorded PTO and tip inputs retain a unique source reference, reason, actor and versions without creating punches or changing leave banks.

Unmapped identities, jobs, sites or earning codes refuse output.

Mixed-rate overtime, legacy provider-history conversion and multi-site make-up allocation are refused pending their reviewed treatment; this is partial implementation, not a narrowing of the full target.

The owner-only, regular-only contractor and no-inferred-conversion workflow slice is ct-approved with the riders below.

Templates require explicit owner approval of each retained revision; omitted approval is false, including earlier templates until reviewed.

Unknown worker classifications remain unclassified until the owner explicitly selects a workflow.

Owner review does not certify legal contractor status.

A later template revision never rewrites a closed period, its retained batch or its download.

PAY-003 to PAY-008 and PAY-010 to PAY-011 inherit the classified-source and exact-template checks before shipping their presets.

## PAY-002

Payroll administrators build export templates for any provider without a live connector: file type (CSV, TSV, other delimiter or XLSX; provider-specific formats such as QuickBooks Desktop IIF come as maintained presets, PAY-011), header row and column names, column order, date, time and number formats, grouping (one row per employee per pay code, or per day, job or location) and the mapping of every Lanyard pay code (regular, overtime, double time, PTO, sick, holiday, differentials, premiums, tips) and employee, job and location identifier to the provider's codes.

A preview shows the exact file; an unmapped code or employee blocks export; exports keep PAYROLL-001 once-only claims, signed corrections and hashes.

Templates keep TIME-005 captured start and end and export payable minutes.

The owner acts as payroll administrator until TEAM-001 and ACCESS-003 supply that role.

The authenticated payroll.template.save command maintains retained template revisions; payroll.prepare selects a template, and Payroll reviews and explicitly exports that exact revision.

CSV, TSV, a single custom delimiter and deterministic XLSX are supported.

Dates use ISO, US or European order; captured times use ISO UTC, UTC date and minute, or UTC time; hours use zero to six decimal places, refusing precision that loses a payable minute.

Employee and earning-code grouping can additionally retain date, job and location; selected identifying columns also remain distinct rather than discarding their source values.

XLSX previews show the exact worksheet cells and downloads retain the original binary hash.

Every encountered earning code and nonempty job or location needs a provider mapping, even when omitted from display columns.

PAY-001 retains responsibility for its classified-source limitations; future source kinds inherit these mapping checks before shipping.

## PAY-003

A maintained PAY-002 preset writes Paylocity's documented time and earnings import layout, with company code, employee ID, earning-code and cost-center mapping.

It cites the Paylocity document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only, not a live connection.

## PAY-004

A maintained PAY-002 preset writes Paycor's documented hours import file with employee number, earning-code and department mapping.

It cites the Paycor document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only.

## PAY-005

A maintained PAY-002 preset writes Rippling's documented hours or earnings import file with employee identifier and earning-type mapping.

It cites the Rippling document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only.

## PAY-006

A maintained PAY-002 preset writes Heartland Payroll's documented time import file with employee ID and earning-code mapping.

It cites the Heartland document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only.

## PAY-007

A maintained PAY-002 preset produces the hours and earnings data Square Payroll accepts through its documented import or timecard path, with team-member and earning-type mapping.

Where Square documents only manual entry, the preset produces a per-employee earnings summary in Square's entry order and says so.

It is labeled export-only.

## PAY-008

A maintained PAY-002 preset produces the hours, tips and earnings data Toast Payroll accepts through its documented import path, with employee and earning-code mapping, and avoids double-counting hours already captured by Toast time clocks under POS-002.

Where Toast documents only manual entry, the preset produces a per-employee earnings summary in Toast's entry order and says so.

It is labeled export-only.

## PAY-009

Payroll administrators define weekly, biweekly, semimonthly or monthly pay schedules per pay group, with pay dates, separately from the FLSA workweek.

When a workweek crosses a semimonthly or monthly period boundary, overtime is computed on the whole workweek, and overtime that becomes known only after the earlier period closes carries into the next period as a labeled adjustment.

Pay schedules replace EARN-001's workweek period and owner-set pay date.

The owner acts as payroll administrator until TEAM-001/ACCESS-003 supply that role.

Each saved group retains its employees, first period date, cadence, pay-date offset (0–31 calendar days after the inclusive period end) and workweek starting weekday, on the venue calendar.

Weekly and biweekly periods run 7 and 14 days from the first period date; semimonthly periods are the 1st–15th and 16th–last day; monthly periods are calendar months.

Opening a scheduled period uses those dates and TIME-004 signoff, lock and close controls.

The first scheduled period also looks back through its entire workweek.

Whole-week approved payable minutes, including PEOPLE-002 date allocations and CLOCK-008 job transfers, are classified chronologically: the first 40 hours are regular and the rest overtime.

Straight-time hours still export once; once the week has ended and all its recorded time is approved, overtime exports as an additional half-rate premium input, with the complete source-week revisions and period starts.

The locked period where the week ends receives it, or the next available locked period if that period already closed; later corrections export signed premium differences without changing old files.

Pending time and open punches hold the week's premium.

PAY-001 inherits the premium input mapping and POLICY-001 the reviewed state/daily overtime extensions before each ships.

COST-002 projections, TIME-009 review, COVERAGE-001 eligibility and TIPS-002 checks use the group's workweek; unassigned people keep Monday–Sunday.

## PAY-010

Alongside the PAYCHEX-001 live connection, a maintained PAY-002 preset writes the time and earnings import file Paychex Flex documents for third-party time systems, with client ID, employee ID, earning-code, rate override and labor-assignment (branch/department) mapping.

It cites the Paychex document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only, never live.

Paychex customers on products other than Paychex Flex (for example SurePayroll) use PAY-002 templates.

## PAY-011

QuickBooks Desktop Payroll Enhanced and Assisted customers get a maintained export-only preset that writes an IIF time-activity file (the `!TIMEACT` header block and one `TIMEACT` row per employee, date, payroll item, customer:job and service item) for import into QuickBooks Desktop's timesheets, with employee name, payroll-item, class and job mapping.

It is not a live connector, it is labeled export-only, and it keeps PAYROLL-001 once-only claims and hashes.

Desktop is served by this file path only; QB-001 is the live QuickBooks Online Payroll path.

## SYNC-001

A payroll administrator authorizes the exact reviewed provider submission.

Durable idempotency keys and source/period fences prevent duplicate sends; transport queued/sent, provider accepted/rejected/partial, applied-to-payroll and paid states remain separate.

Readback reconciles employee/pay-code totals, preserves unknown outcomes for investigation and supports reviewed corrections and off-cycle adjustments.

Provider acceptance alone never means wages paid.

Provider readback confirms the run a TIME-004 pay period was closed with; until then the close records the owner's reference only.

## GUSTO-001

Connect a US Gusto company through approved production authorization, map employees/jobs/PTO/pay codes and transfer approved classified hours under SYNC-001.

Gusto employees, new hires, terminations, compensations and PTO balances are read under PAYSYNC-001 to PAYSYNC-004 so Gusto can be the employee master.

Provider permissions, supported employee/contractor paths and time-data versus payroll-application states are explicit; reauthorization and disconnect preserve source history without sending more work.

## ADP-001

US buyers connect ADP RUN or ADP Workforce Now using each product's supported production app/partner authorization.

Separate capability matrices map employees, jobs, regular/overtime/PTO/tips and periods; approved transfers and readback follow SYNC-001, and each product's workers, new hires, terminations, pay rates and leave balances are read under PAYSYNC-001 to PAYSYNC-004.

A connection to one product is never represented as support for the other.

## PAYCHEX-001

The live Paychex connection is Paychex Flex (Essentials, Select, Pro and Enterprise plans) through Paychex's production developer API and partner program.

Lanyard maps workers, earning codes and labor assignments, sends approved period hours, tips and adjustments to the Flex payroll with readback under SYNC-001, and reads workers, new hires, terminations, rates and leave balances under PAYSYNC-001 to PAYSYNC-004 so Flex can be the worker-record master.

The PAY-010 Paychex Flex import file is labeled export-only and cannot satisfy this live promise; other Paychex products use PAY-002 templates; required provider agreements are delivery work.

## QB-001

The live QuickBooks path is QuickBooks Online Payroll Core, Premium and Elite attached to a US QuickBooks Online Simple Start, Essentials, Plus or Advanced company.

Lanyard writes approved hours as employee time activities with the mapped payroll item, customer/job and class, so they appear in the QuickBooks Online Payroll run, and reads back what the run used under SYNC-001.

A QuickBooks Online company without a Payroll subscription receives time only for job costing and is labeled "not payroll application"; a missing Payroll subscription or permission is shown before any send.

Employees, rates, jobs and leave balances are read under PAYSYNC-001 to PAYSYNC-004.

QuickBooks Desktop Payroll is not a live connection: Desktop Payroll Enhanced and Assisted customers use the PAY-011 IIF export.

## PAYSYNC-001

For each connected payroll provider (Gusto, ADP RUN, ADP Workforce Now, Paychex Flex, QuickBooks Online Payroll) the buyer chooses, per field group, which system is authoritative: employee lifecycle (hire, rehire, termination and their effective dates), legal and preferred name and contact details, emergency contacts, pay rate and job (wage type, hourly or salaried rate, job title and default site/department), and leave balances per leave type.

Each field group has exactly one authority across Lanyard, the payroll provider and an HR-001 source; choosing a second authority for the same field is refused.

Changes from the authority arrive by provider webhook where offered and otherwise by a scheduled poll, with last-sync time, freshness and per-record errors shown.

In Lanyard a non-authoritative field is read-only with its source named (CONTACT-001 emergency contacts included: the card shows the authority's contacts and Lanyard's own contact edit is refused), and an edit to it is refused or, where the buyer enables it, queued as a change request for the authoritative system.

Lanyard writes back only fields it is authoritative for and the provider accepts.

The authority map, every inbound change and every conflict are audited.

## PAYSYNC-002

When the payroll provider owns the lifecycle, Lanyard reads its employees and new hires and matches each one to a Lanyard person in a fixed order: provider employee ID equal to the stored payroll identifier (PEOPLE-001), then verified email, then mobile number.

A name-only match is proposed for review and never linked automatically, and ambiguous or conflicting matches wait in a review queue.

An unmatched new hire is created inactive and uninvited until a manager approves it with site and job, unless the buyer turns on the stated auto-invite rule: invite by email or text (PEOPLE-003) once the hire's start date is within a set number of days and their site and job are mapped.

A rehire reactivates the same Lanyard person with prior history.

A termination takes effect at the provider's effective date: sign-in and kiosk access are revoked, shifts after that date are flagged and moved to the open-shift and coverage queues (COVER-002, COVERAGE-001) with the manager notified, pending swaps and offers are withdrawn, and past shifts, hours and payroll history are kept.

## POS-001

Authorize Square POS accounts/locations and reconcile sales, refunds, staff/job identifiers and available tip inputs into location-local demand and labor-to-sales reports.

Incremental cursors, deduplication, backfill and freshness labels prevent duplicate or stale sales.

Payment capture/refunds remain in Square; importing sales cannot approve hours or tip pools.

## POS-002

Connect supported Toast restaurants through Toast production/Partner Connect permissions and required connector subscriptions or fees.

Reconcile per-location sales, refunds, jobs, available tips and time inputs with clear source ownership; duplicate Toast clock data cannot double-count Lanyard punches.

Demand and cost reports retain freshness and source provenance.

## POS-003

Connect Clover merchant/location data for sales/refunds, employee identifiers, available clock/tip inputs and labor-to-sales analysis, with an explicit authority choice when Clover terminals supply punches.

Approvals and corrections stay in Lanyard's time workflow; POS event retries cannot create duplicate work.

## POS-004

Buyers connect Shopify POS and supported Lightspeed Restaurant K series locations for staff/sales inputs used in demand and labor reporting.

Each adapter documents available data, permissions, plan requirements, location mapping, incremental/backfill behavior and provider limitations without presenting one Lightspeed product as all editions.

## SALES-001

Businesses whose POS has no connector enter daily or hourly sales, transactions, covers or other workload metrics per site, manually or by CSV upload with a reviewed preview, mapping and duplicate detection.

Entered data is labeled manual, keeps edit history and feeds COST-001, REPORT-003 and DEMAND-001 exactly as connector data does.

The owner enters and reads sales for every cafe and, until TEAM-001, a manager for their home cafe; staff and agent keys never read them.

A value is one cafe, venue date (YYYY-MM-DD), hour (0–23) or the whole day, metric (sales, transactions, covers or a workload metric named in letters) and value: sales in dollars and cents, kept as whole cents, every other metric a whole number.

A day holds either one daily value or hourly values per metric, never both.

A CSV upload names its cafe (or maps a cafe column) and maps columns to fields (date, hour, site, sales, transactions, covers or metric:<name>; headers that already name a field map themselves); its preview lists each value, each row error and each duplicate (a value that repeats one the cafe already has or an earlier file row), and the import needs the exact preview and refuses the file while any duplicate or error remains.

Every value is labelled Manual (form or CSV), and a correction (the entry's exact revision) keeps each earlier value with its source, who and when.

On the Schedule screen's Sales and workload card, beside the COST-001 sales forecast, and in the DASH-001 labor line: labor percentage is that day's scheduled labor cost (published shifts at each person's hourly rate, per shift to the cent) over its entered sales, to one decimal, and sales per labor hour is entered sales over scheduled hours, to the cent, per day and over the days with entered sales; COST-001 inherits switching both to worked cost when it brings it.

DEMAND-001 inherits updating a forecast from entered sales, and REPORT-003 the interval report.

## HR-001

Connect BambooHR and the sibling [Willow](https://github.com/just-every/run-willow) for employee lifecycle, employment attributes, emergency contacts and leave.

The buyer chooses one authoritative source per field and leave balance/decision through the same PAYSYNC-001 authority map that covers connected payroll providers, maps people and sites, and resolves conflicts before writeback.

Termination revokes scheduling access and flags future shifts as in PAYSYNC-002; approved absence reaches staffing once.

Willow owns the HR record, documents and broader HR lifecycle; Lanyard owns schedules, attendance, coverage and labor operations.

It delivers LOG-001 incident exports to Willow for HR follow-up.

## DEMAND-001

Managers forecast sales/workload and required staffing by location, role and interval from POS history or SALES-001 entries, events, seasonality and employer-entered assumptions.

Missing/stale inputs, confidence, version and actual-versus-forecast error remain visible.

Managers can override with a reason; a forecast never manufactures worked hours or automatically changes a published schedule.

**Exact semantics built (sx, 22 October 2026):** for one cafe and venue day, the estimate for each hour is the mean of that hour's entered hourly sales on the same weekday over the prior weeks (default four; event days and days not yet complete are left out), widened one population standard deviation each way and moved by the cafe's growth percent and the day's employer-entered event uplift, rounded to cents once.

Confidence is high with four or more samples within 15% spread, medium within 35%, otherwise low; an hour with fewer samples than the cafe's minimum (default two) is unknown, never zero.

A forecast is incomplete, with its reasons, when no hourly sales exist, the latest entered sales are older than the stale threshold (default three days) or an hour has some but too few samples.

Role demand, only for a complete forecast and hours with forecast sales, is each role's larger of its minimum staff and forecast sales over its employer-entered sales per labor hour.

Saved versions are immutable and bound to the reviewed inputs; a reasoned override of one hour makes a new version that keeps the computed value, reason, person and time.

Authority (ct 22 Oct 2026): the owner and that cafe's managers read, save and override forecasts until TEAM-001.

After TEAM-001, scoped schedulers and read-only analysts read them, and only managers save or override.

Staff read none.

An agent key reads a cafe's forecast versions, role demand and demand delta only under TRADEOFF-001's `comparison.read` scope, cafe limit and audit, and never saves or overrides one.

POS-001 to POS-004 inherit: connector history must feed the same hourly sales rows with their freshness label so the stale rule applies.

LEARN-001 inherits the saved versions as the pre-service forecasts it evaluates.

## OPT-001

Managers choose service coverage, labor budget, employee preferences, fairness and cost objectives; the optimizer proposes feasible schedules and auto-fill using qualifications, availability, leave, rest, policy and cross-site hours.

Fairness is the FAIR-001 measures.

It explains infeasible coverage, overtime alternatives and objective tradeoffs rather than hiding constraints; people review the complete diff before publication.

The optimizer reads each person's effective AVAIL-001 pattern, preferred blocks and weekly maximum.

The optimizer never reads FEEDBACK-001 ratings, comments or flags.

Agent reads of FAIR-001 values or comparison costs use TRADEOFF-001's `comparison.read` scope, cafe limit, redaction, small-cell, unknown and audit rules.

**Delivered comparison slice (sx, 22 October 2026):** existing published service slots remain fixed.

Each alternative compares role-matched scheduled minutes with the latest saved manual DEMAND-001 version for each venue day and hour, retaining version ids, revisions and digests.

Unpaid scheduled break minutes are apportioned evenly across the shift, as in the interval report.

Known intervals show required, scheduled, uncovered and excess minutes; a missing day, incomplete forecast or missing role requirements keeps the complete-week gap unknown, with observed intervals separate.

The employer's COST-001 weekly forecast and labor-budget percentage set a cap on the scheduled wage/holiday estimate.

High-fairness moves cannot cross a known cap, and preparation refuses a known over-budget or unpriced alternative; missing budgets remain explicit.

A changed saved demand version or budget requires fresh digest-bound review.

This is a local assignment comparison, not demand-derived shift generation or a statutory cost/service-outcome calculation.

## FAIR-001

Fairness in OPT-001, TRADEOFF-001 and LEARN-001 is computed from four named measures over a configurable trailing window (default eight weeks) among employees eligible for the same role and site: (1) preference gap, the absolute difference between each person's scheduled and preferred weekly hours, reported as mean and maximum; (2) undesirable-shift spread, each person's count of closing, close-then-open, weekend and holiday shifts (the employer chooses which tags count), reported as maximum minus minimum and standard deviation; (3) preference violations, the count of shifts placed in an employee's prefer-not blocks; (4) hours-offer equity, each part-time employee's share of offered extra hours against their requested share.

Each measure shows its inputs and window; protected traits are never inputs.

Preference measures read AVAIL-001 preferred blocks and preferred weekly hours.

Fairness measures never read FEEDBACK-001 ratings, comments or flags.

Reports use whole Monday–Sunday venue weeks ending with the selected week, inclusive (one to 52 weeks, default eight).

Historical role/site populations are explicit employer-confirmed effective cohorts, retaining staff, job, qualification, site and employment-type revisions; every currently eligible person must be included, including zero-assignment people.

Certificates expire after their inclusive expiry date.

Recording time never establishes past eligibility.

Missing cohorts remain unknown; current home-cafe/position preference rows may still be inspected but are labelled unconfirmed and do not establish historical fairness.

Each confirmed person-week compares published payable scheduled minutes, assigned by shift start date, with AVAIL-001 preferred weekly hours only when those hours are known and equal on all seven dates and eligibility covers the complete week.

Missing or midweek-changing preferences, partial eligibility and unpublished weeks remain unknown and excluded from the mean/max with reasons and sample counts.

A shift fully covered by effective preferred blocks is counted separately.

Explicit AVAIL-001 prefer-not blocks and dated exceptions are soft availability: overlap counts one violation per shift, never a hard refusal or an inference from time outside preferred blocks; unavailable blocks retain precedence.

The employer selects any of closing, close-then-open, weekend and holiday tags per cafe and records closing/opening wall times and a maximum elapsed close-to-open interval (inclusive).

A shift matching any selected tag counts once, with individual tag counts also exported; closing means ending on a later venue date or at/after closing time, close-then-open counts an opening shift at/before opening time following the same person's preceding same-site closing within the selected elapsed interval, weekend uses the shift's start venue date, and holiday uses any touched venue date in the employer calendar.

Spread is maximum minus minimum and population standard deviation over the cohort's eligible people.

Eligibility confirmations never restart the trailing window: each role/site population combines its effective basis revisions before computing counts and shares.

The report's overall spread is the maximum complete role/site spread.

Requested extra hours are explicit effective weekly minutes, separate from preferred hours.

Hours-offer equity compares each eligible part-time person's offered payable minutes divided by all such offered minutes with their requested minutes divided by all such requested minutes; zero or missing denominators remain unknown.

Only retained open-shift tiers and replacement offers opened by the report cutoff and before closure count, once per opportunity and recipient; future tiers, repeats and unknown legacy recipient logs are explicit.

A request recorded after posting cannot establish a posting-time request.

The cutoff is the earlier of the current instant and the window end.

Schedule comparisons use existing published service slots, preserving their times, jobs, sites and breaks; low priority reduces scheduled USD cost, while high priority starts there and accepts only feasible assignment moves or exchanges that reduce at least one of spread, mean/max preference gap or violations without increasing the others.

This deterministic local search reports its method and does not claim global optimality.

Availability, approved leave, active staff, job/site qualifications and weekly maxima are rechecked.

Cost is an effective-rate scheduled wage and configured holiday-rule estimate with cent rounding, separate from the fairness inputs; missing costs remain unknown.

Both alternatives export source revisions, assignments, all four measures, rate inputs, USD difference, identical slot coverage and any existing uncovered open shifts.

OPT-001, TRADEOFF-001 and LEARN-001 inherit these measures and source/unknown rules before their additional capabilities ship.

Existing owner and home-cafe manager report authority applies; no new authority is granted.

Source roster/shift/pattern/cohort/offer/request revisions and dates are downloadable; protected traits and feedback are never calculation inputs.

## AI-001

Managers request changes in plain language or upload an existing schedule image.

AI extracts employees/sites/local times and labels ambiguities, sources and low-confidence fields in a draft; it never assumes a blurry name or DST time.

Normal conflict/cost/policy checks apply and a human approves the exact diff; uploaded material is permission-scoped and erasable.

## AUTO-001

Payroll administrators may authorize narrow automatic approval rules for exact schedule-matching captured time with required break attestation and no exception.

The rule/version, input revision and automated decision are recorded; wages, uncertainty, missed breaks, self-interest conflicts and late corrections go to human review.

Owners can pause/revoke rules and rerun a preview without changing history.

Until TEAM-001 brings payroll roles the owner is the payroll administrator: only the owner saves, previews, authorizes, pauses and revokes a rule, one per cafe.

A rule approves a submitted timesheet only when it was punched against a published shift at the rule's cafe, starts and ends in the same minutes as that shift, keeps the shift's scheduled break, carries the employee's BREAK-001 break attestation and has no exception (TIME-003, TIME-006, TIME-007, CLOCK-006, CLOCK-007 and every later exception source), break premium, correction, manager edit or overtime (more than 40 recorded hours in its workweek); a manager's or the authorizing owner's own time always goes to a person.

A saved version starts as a draft.

A preview lists every waiting timesheet at the cafe with its revision and either "would approve" or the reasons it needs a person, and writes nothing; authorizing needs that preview's exact digest (any changed timesheet or rule refuses it), approves the preview's clean items at their revisions and turns the rule on, after which each clean punch is approved in the command that submits it.

Each automatic approval records the rule, its version, the input revision and time, and is attributed to the rule.

A paused rule approves nothing until authorized again; a revoked rule stays revoked.

## LINK-001

Buyers and approved partners use documented versioned roster/time/coverage/report APIs, scoped credentials and signed event webhooks, with replay identities and observable delivery/reconciliation.

Zapier and Make can start reminders or request drafts under least privilege.

## OPS-001

Owners see connector scopes, last successful sync, cursor/backfill coverage, errors, expiring grants, queued attempts and assigned unresolved mismatches.

Durable work resumes after restart; bounded retries honor provider limits and ambiguous writes await reconciliation rather than blind resend.

Reauthorization, deletion and replay are deliberate and do not mutate prior payroll evidence.

## MIGRATE-002

A Deputy buyer can use a documented supported export/API extraction and MIGRATE-001 preview to bring employees, locations/jobs, availability/leave requests and leave balances, future schedules, historical time/breaks and available wage/policy/task-segment data.

Missing source fields and manual transfer steps are listed before commitment; no synthetic fixture is called a verified Deputy export.

## MIGRATE-003

A When I Work buyer migrates available employees/sites/jobs, availability/leave, reusable/recurring schedules, future assignments, pending swaps/open shifts and historical time through a documented extraction.

MIGRATE-001 preserves unsupported items explicitly; calendar subscriptions and employee access are reissued under Lanyard authority after reviewed cutover.

## MIGRATE-004

A Homebase buyer migrates available people/locations, schedules, availability/leave, historical punches/breaks/corrections and payroll status with POS staff mapping and available labor/sales history.

Pending offline captures are reconciled during cutover, notifications are reauthorized and MIGRATE-001 exposes any data requiring separate extraction.

## MIGRATE-005

A 7shifts restaurant buyer migrates available locations/roles, employees, schedules/availability/leave, historical time/breaks, wage records, POS mapping and tip pool inputs/allocations.

Historical tip and labor totals reconcile to source exports; restricted/unavailable source fields have named buyer-reviewed transfer steps rather than guessed reconstructions.

## MIGRATE-006

A Connecteam buyer migrates the workforce scheduling/time portion: staff/jobs/sites/qualifications, schedule/tasks, availability/leave, clock settings, punches/breaks, approvals/locks and payroll mappings where extractable.

Kiosk/device/location permissions are explicitly re-enrolled.

Unrelated HR/operations modules are linked to their proper product/service and their source gaps are disclosed.

## MIGRATE-007

A Legion buyer migrates available employees/locations, preferences, staffing constraints, schedules, historical work, labor budgets and demand/forecast inputs with source/version provenance.

Optimization outputs remain historical until reviewed; source model internals that cannot export are explicitly rebuilt from authorized inputs without claiming equivalent learned weights.

## PRIVACY-001

Owners configure US record-retention periods and legal holds by data type, minimize punch location, message and image data and fulfill authorized access, export, correction and erasure requests.

Necessary employment and payroll history remains restricted while held; deletion removes eligible attachments, import originals, derived copies and connector credentials, returns a scoped result and extends archive fences.

Buyers receive explicit handling for external messages, provider copies and downloaded archives.

Retention, legal holds and the employee's access export cover JOURNAL-001 notes; the export carries employee-visible notes only, never private ones.

Retention and legal holds also cover LOG-001 logbook entries and their attachments.

Current implementation uses owner-only, explicit audited privacy commands, with no automatic deletion or expanded readers.

Retention review periods cover employment history, journal notes and attachments, photos and location; the longer of the privacy review and existing capture or site period applies.

Notes use the end of their declared record date in UTC.

Employment, punch and payroll facts remain restricted even after the review period.

Employee exports contain only that employee's payroll lines and current employee-visible notes, with omissions named; private notes and prior note versions are excluded.

Explicit expired-note and attachment erasure removes prior versions and saved command copies, retains disposition receipts and advances the archive fence.

Erased notes cannot be edited back.

The product workflow default was approved with changes by ct on 25 October 2026; this is not legal sign-off or production authorization.

Only the live native owner administers privacy operations, without gaining additional content-reading authority.

Each operation requires attributable owner review and a reason identifying the request or authority; the command's consent checkbox records owner authorization, never employee consent or a statutory legal basis.

Capture consent remains specific to each photo or location capture; declining a later capture withdraws permission for that capture and preserves its named exception, without erasing lawfully retained records.

Configured days are manual review thresholds, not legally approved retention periods; unresolved legal eligibility requires restricted retention and review.

Statutory duties and every applicable hold remain controlling.

Releasing one hold never releases another or initiates deletion; a separate authorized erasure rechecks current eligibility.

Necessary employment facts remain restricted through this door, without claiming indefinite lawful retention of every fact.

Eligible journal erasure remains distinct from ERASE-001 unused-identity erasure.

Installation archives retain their supported private content and authority exclusions separately from employee exports; restore respects destination or supplied later journal fences and requires fresh authentication.

Disconnected archives, downloads and external copies cannot be recalled; owners must protect and retire copies and arrange external handling.

Linked owners lose direct and group chat access after transfer under CHAT-001 live membership and current-cafe checks across reads, search, files and commands.

Kiosk notice acknowledgment is distinct from affirmative per-capture consent, including declined or failed captures.

PRIVACY-001 governs retention, holds and employee-rights disposition for report sources and retained copies.

Initial maintained retention presets must distinguish federal payroll records at three years, federal wage-computation records at two years, Chicago fair-workweek records at three years, Chicago paid-leave records at five years, and applicable California hours, wage and sick-leave records at three years, while preserving longer employment-duration, jurisdictional and other applicable duties.

Each preset records its source, effective date, applicability and retention anchor.

The longest applicable obligation controls; unknown applicability remains explicitly unresolved and cannot authorize deletion.

A retained report cannot shorten its sources’ duties.

Every applicable hold independently blocks disposition of its covered sources and copies.

Releasing one hold does not release another or initiate deletion.

Employee access, export and correction requests require identity and authority review, employee-scoped disclosure and an attributable response; eligible erasure requires a separate reviewed action that rechecks current duties and every hold, removes covered local derivatives and saved results, and advances restore fences.

Ordinary employee exports retain their existing visibility rules; statutory requests requiring additional material need separately reviewed fulfillment rather than a blanket refusal based on that visibility setting.

Disconnected archives, downloads and provider copies require explicit external handling.

Unsupported disposition remains open and cannot be reported as fulfilled.

No legal compliance or complete provider erasure is established by this ruling.

REPORT-002 sources and immutable report copies inherit this clause’s applicable record-class retention, independent holds, employee-request handling, reviewed eligible disposition and restore fences; indefinite technical storage is not blanket authority for indefinite lawful retention.

## COVERAGE-001

With manager-authorized contact and staffing policies, the coverage agent reads the affected shift, demand delta, qualifications, availability, leave, cross-site actual/approved hours, fatigue/rest limits, rates and prior responses.

It proposes qualified available non-overtime replacements first, explains exceptions, sends authorized offers, collects employee consent, expires losing offers and brings the exact change to a human manager.

It carries the approved change through schedule notices and payroll preparation, then checks acknowledgment and actual clock-in; only evidence closes coverage.

Revocation stops further outreach and stale data triggers fresh review.

## TRADEOFF-001

The planning agent compares candidate schedules using POS demand, service requirements, effective wage/policy data, employee preferences and the FAIR-001 fairness measures.

It shows USD cost, overtime, missed preferences, FAIR-001 values, coverage/service risk and uncertainty for each alternative with source facts.

Managers choose objectives and approve exceptions; protected traits are excluded from ranking and the agent cannot waive required qualifications or breaks.

The comparison also reports a separate scheduled weekly overtime estimate for each alternative: payable scheduled minutes are split by venue date using the existing retained-rate allocation, then grouped by each employee’s configured PAY-009 workweek (Monday by default).

Minutes above 2,400 use half the scheduled-minute-weighted base hourly rate, rounded once per employee-workweek to USD cents; the download retains shift, rate-profile and pay-group revisions.

This is a scheduled estimate, not payable or statutory overtime, and is separate from the existing wage/holiday cost objective.

Unpublished adjacent calendar weeks and cross-cafe scheduled work make the complete workweek unknown; missing base rates make the premium unknown.

Actual punches, daily overtime, regular-rate inclusions, jurisdiction policy and manager-approved exceptions remain uncalculated.

A preparation key may read comparison costs and FAIR-001 inputs only through the new, separately granted, read-only `comparison.read` scope.

No existing key gets it, and creating a key without it grants nothing new.

Only the owner may grant it when creating the key, after a consent screen warning that repeated aggregate cost reads can narrow down individual pay; managers and access levels cannot grant it.

The key names its cafes at creation, with no all-cafes grant; any other cafe returns not found.

The scoped read returns each alternative’s assignments, FAIR-001 totals and per-cohort values, per-person preference gap, undesirable-shift counts and prefer-not violation counts, cohort ids, positions and dates, scheduled minutes, per-employee-workweek overtime minutes with unknown reasons, and alternative-level USD cost, premium and difference totals.

It never returns rates or rate profiles; per-shift or per-employee cents, including per-person premiums; payroll IDs, contact details or download files; per-person requested or offered extra-hour minutes (hours-offer equity returns cohort totals only); qualification evidence, feedback or protected traits.

A USD total is withheld as `small-cell` when fewer than 3 distinct employees contribute a nonzero amount; a difference is withheld when fewer than 3 distinct employees’ assignments differ.

Withheld values are never zero or unknown.

Incomplete workweeks, missing rates and missing fairness inputs stay unknown with their reasons and are never inferred.

Erased people appear only as a former employee.

Archives and imports never carry key scopes.

Every scoped read writes owner-visible activity naming the key, cafe and week; revocation, expiry or an owner-version change refuses the next read.

Preparing the fairness draft and publishing remain human decisions; LEARN-001 separately permits evidence-bound proposal recording under the same grant.

Until this scope ships, comparisons remain native owner and home-cafe manager reads.

## CUTOFF-001

The payroll agent monitors actual punches, breaks, approved revisions, mapping failures and provider acceptance/application against the pay-period cutoff.

It explains discrepancies in plain language, requests factual corrections from employees and follows up with accountable managers until resolved.

Workers confirm facts, managers approve exact time and payroll administrators alone authorize submission/off-cycle treatment; agent reasoning cannot invent hours, hide an exception or call accepted time paid.

## LEARN-001

The agent compares forecast demand, published staffing, actual attendance, sales/service outcomes, FAIR-001 measures and unresolved exceptions, attributing known error sources and retaining uncertainty.

It proposes revised demand assumptions, offer timing and objective weights (including FAIR-001 fairness weights) with a measured comparison and versioned explanation.

Managers approve model/policy changes; protected traits, unobserved work and unresolved payroll are never imputed as success, and reverting a model never alters historical records.

Agent reads of FAIR-001 values or comparison costs use TRADEOFF-001's `comparison.read` scope, cafe limit, redaction, small-cell, unknown and audit rules.

**Proven native report slice:** `GET /api/lanyard/learning?week=YYYY-MM-DD&site=CAFE&weeks=8` uses existing SALES-001 owner/home-cafe-manager authority and grants no agent access.

It compares completed venue days using the latest retained forecast saved strictly before that service day started.

Forecast whole dollars become USD cents; signed error is actual minus forecast and mean absolute error rounds once to whole cents over observed days only.

Actual sales require an explicit daily entry or all 24 hourly entries; incomplete hours, missing/late forecasts and incomplete service days stay unknown with reasons.

Forecast revisions and corrected sales inputs remain inspectable, an entered zero is a known zero, and unresolved no-show signals never establish known absence.

Missing POS history stays unknown.

This read neither changes schedules nor proposes or applies policy.

**Exact semantics built (sx, 22 October 2026):** a cafe's demand-assumption proposal uses completed service days, up to 26 weeks, that have a complete DEMAND-001 forecast version saved before the day started and at least one hour of entered sales; the model's own pre-override hourly forecast is compared with those sales, never the manager's override.

At least three comparable days are needed; the earlier two thirds fit one percentage bias and the latest third is held out, and a proposal to move the cafe's growth percent exists only when applying that bias strictly lowers the held-out mean hourly error.

Days with no forecast, an incomplete forecast or no entered sales are counted as unknown and never as success; overrides, event days and unresolved no-show signals are named error sources, with absence never assumed.

The owner or that cafe's manager records a proposal bound to the reviewed evidence digest, approves it (refused when the assumptions changed since), declines it with a reason or reverts an approved change while the assumptions still stand at the applied revision; saved forecasts and entered sales are never altered.

Authority (ct 22 Oct 2026): an agent key under `comparison.read` and its cafe limit may record a proposal bound to the evidence digest.

Only a human (the owner, or that cafe's manager until TEAM-001) approves, declines or reverts one.

Every recording, decision and revert is audited with actor, role and reason, and no proposal changes an assumption before human approval.

Offer-timing and objective-weight proposals, FAIR-001 attribution and connected-POS freshness are not built.
