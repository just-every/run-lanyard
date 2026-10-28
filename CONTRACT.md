# Lanyard target product contract

Lanyard is a complete US hourly-workforce product: build and fill schedules, handle swaps and call-outs, capture actual work, control labor cost and overtime, allocate tips, and reconcile approved hours with payroll. A buyer of Deputy, When I Work, Homebase or 7shifts can move this whole operational job to Lanyard; Connecteam and Legion set additional mobile and optimization depth. The first buyer runs a 10–100 person US service, retail or hospitality business. Currency and budgets are USD; sites use US time zones, daylight saving and employer-reviewed federal/state/local policy.

## Product target

| | |
| --- | --- |
| Category | Employee scheduling and time & attendance (hourly workforce management) |
| Incumbents a buyer switches from | Deputy, When I Work, Homebase, 7shifts |
| Up-and-comers it must also beat | Connecteam, Legion |
| First buyer | Owner or operations manager of a 10–100 person US hourly service, retail or hospitality business |

The primary journey: move the crew in, build and publish the week, fill changes, capture actual work, decide exact hours and reconcile the payroll handoff.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later are reported separately.
- Done means every acceptance point has recorded proof.
- Field proof is kept in its register.
- ACCEPTANCE.md and the homepage claims document are generated from this file.

## Door rules

- **D-1.** A workforce decision binds its exact source revisions; later corrections retain the original worked or published facts and reconcile only the signed change.
- **D-2.** A missing punch, disputed evidence or policy violation remains explicit; it cannot invent attendance, discard worked hours or establish wages paid.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | ACCESS-001 | not run |
| BASE-ACCESS-002 | Sessions | ACCESS-001, PUBLIC-001 | not run |
| BASE-ACCESS-003 | Public endpoints | none | not run |
| BASE-ACCESS-004 | Server-side authorisation | ACCESS-001 | not run |
| BASE-INPUT-001 | Validation | PEOPLE-001 | not run |
| BASE-INPUT-002 | HTML | none | not run |
| BASE-INPUT-003 | Uploads | PAYROLL-001, JOURNAL-001, SCHEDULE-004, CHAT-001, MOBILE-002, CLOCK-001, CLOCK-003, CLOCK-005, TIME-008, TIME-009, SALES-001, BOUNDARY-001, SCHEDULE-007, PRIVACY-003 | not run |
| BASE-SECRET-001 | No leakage | BASE-001 | not run |
| BASE-SECRET-002 | Startup | none | not run |
| BASE-DATA-001 | Export and import | TIME-002, PAYROLL-001, PAYROLL-002, ARCHIVE-001, ERASE-001, AUDIT-001, BASE-001, ACCESS-002, SCHEDULE-005, SCHEDULE-006, LOG-001, CLOCK-008, TIME-007, PAYRULE-001, PAYRULE-002, PAYRULE-003, ACA-001, REPORT-001, REPORT-002, PAY-001, PAY-002, PAY-003, PAY-004, PAY-005, PAY-006, PAY-007, PAY-008, PAY-010, PAY-011, PAYCHEX-001, QB-001, PAYSYNC-003, HR-001, AI-001, MIGRATE-002, MIGRATE-005, MIGRATE-007, SCHEDULE-007, LEAVE-006, PRIVACY-002, PRIVACY-003 | not run |
| BASE-DATA-002 | Retention | PRIVACY-001, PRIVACY-002, PRIVACY-003 | not run |
| BASE-DATA-003 | Erasure | ERASE-001 | not run |
| BASE-DATA-004 | Outbound flows | AI-001 | not run |
| BASE-DATA-005 | Independence | none | not run |
| BASE-PUBLIC-001 | Privacy | PUBLIC-001 | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | none | not run |
| BASE-OPS-002 | Migrations | BASE-001 | not run |
| BASE-OPS-003 | Idempotency | none | not run |
| BASE-OPS-004 | Failure is visible | none | not run |
| BASE-OPS-005 | Audit | AUDIT-001 | not run |
| BASE-ROLE-001 | Roles through every door | ACCESS-001, PEOPLE-001, MOVE-001, ROSTER-001, ROSTER-002, TIME-002, PAYROLL-001, PAYROLL-002, AGENT-001, AUDIT-001, TEAM-001, PEOPLE-002, PEOPLE-003, CONTACT-001, ACCESS-002, ACCESS-003, JOURNAL-001, SCHEDULE-001, SCHEDULE-002, SCHEDULE-003, SCHEDULE-004, LEAVE-001, AVAIL-001, LEAVE-002, LEAVE-003, MINOR-001, SCHEDULE-005, SCHEDULE-006, COVER-001, COVER-002, COVER-003, COVER-004, ROSTER-004, NOTICE-002, CHAT-001, FEEDBACK-001, LOG-001, MOBILE-001, MOBILE-002, LANG-001, CLOCK-001, CLOCK-003, CLOCK-004, CLOCK-005, CLOCK-006, CLOCK-007, TIME-003, TIME-004, TIME-006, TIME-007, TIME-008, TIME-009, POLICY-001, PAYRULE-001, COST-001, COST-002, ACA-001, TIPS-001, REPORT-001, REPORT-002, REPORT-003, DASH-001, PAY-009, GUSTO-001, QB-001, PAYSYNC-002, PAYSYNC-004, POS-001, POS-002, POS-004, SALES-001, HR-001, DEMAND-001, OPT-001, FAIR-001, AI-001, LINK-001, OPS-001, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-007, BOUNDARY-001, COVERAGE-001, TRADEOFF-001, CUTOFF-001, LEARN-001, TEAM-002, TEAM-003, SCHEDULE-007, LEAVE-004, LEAVE-005, LEAVE-006, PRIVACY-002 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | AUDIT-001, TEAM-001, CONTACT-001, ACCESS-003, REPORT-002, PAY-011, OPT-001, LEARN-001, TEAM-003 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | ARCHIVE-001 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ARCHIVE-001, ERASE-001, AUDIT-001, CONTACT-001, ACCESS-003, JOURNAL-001, SCHEDULE-001, SCHEDULE-002, LEAVE-003, MINOR-001, CLOCK-003, BREAK-002, POLICY-001, COST-002, AI-001, PRIVACY-001, BOUNDARY-001, LEAVE-004, LEAVE-005, LEAVE-006, PRIVACY-002, PRIVACY-003 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | PEOPLE-001, ACCESS-002 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | ACCESS-002 | not run |
| BASE-INSTALL-001 | Free self-host and removal | BASE-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | PEOPLE-001, AUDIT-001, PEOPLE-002, PEOPLE-003, CONTACT-001, ACCESS-002, ACCESS-003, JOURNAL-001, SCHEDULE-002, SCHEDULE-004, AVAIL-001, LEAVE-002, LEAVE-003, MINOR-001, SCHEDULE-005, SCHEDULE-006, COVER-001, COVER-002, COVER-003, COVER-004, ROSTER-004, NOTICE-001, NOTICE-002, NOTICE-003, FEEDBACK-001, LOG-001, LANG-001, CLOCK-002, CLOCK-003, CLOCK-004, CLOCK-005, CLOCK-006, CLOCK-007, CLOCK-008, BREAK-001, BREAK-002, TIME-003, TIME-004, TIME-005, TIME-006, TIME-007, TIME-008, TIME-009, POLICY-001, POLICY-002, PAYRULE-001, PAYRULE-002, PAYRULE-003, COST-002, ACA-001, TIPS-002, REPORT-001, REPORT-002, REPORT-003, DASH-001, EARN-001, PAY-001, PAY-002, PAY-009, PAYSYNC-001, PAYSYNC-002, SALES-001, DEMAND-001, OPT-001, FAIR-001, AUTO-001, MIGRATE-001, PRIVACY-001, COVERAGE-001, TRADEOFF-001, LEARN-001, SCHEDULE-007, POLICY-003 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | PUBLIC-001, PEOPLE-003, SCHEDULE-001, MOBILE-001, MOBILE-002, LANG-001, CLOCK-005, PAYSYNC-002, BOUNDARY-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | PUBLIC-001 | not run |
| BASE-AGENT-001 | One MCP door per seed | none | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-002 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | AGENT-001 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | AGENT-001, ACCESS-003, SURFACE-002, SURFACE-005 | not run |
| BASE-AGENT-006 | Every action declares its risk class | ROSTER-002, AGENT-001, DEMAND-001, OPT-001, FAIR-001, AI-001, LINK-001, COVERAGE-001, TRADEOFF-001, CUTOFF-001, LEARN-001, SURFACE-001, SURFACE-003, SURFACE-004, SURFACE-005, SURFACE-006 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | ROSTER-002, AGENT-001, DEMAND-001, OPT-001, FAIR-001, AI-001, LINK-001, COVERAGE-001, TRADEOFF-001, CUTOFF-001, LEARN-001, SURFACE-003, SURFACE-004, SURFACE-007 | not run |
| BASE-AGENT-008 | Truthful attribution | AGENT-001, AI-001, SURFACE-003, SURFACE-005, SURFACE-007 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | AUDIT-001, SURFACE-006, SURFACE-007 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-002, SURFACE-006 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | none | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | ROSTER-002, SURFACE-004 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-007 | not run |

## Published clauses

- `ACCESS-001`: *Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001
- `PEOPLE-001`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-SIGNIN-001, BASE-ROLE-001, BASE-MAIL-001
- `MOVE-001`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `ROSTER-001`: *Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2
- `ROSTER-002`: *Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-012, BASE-ROLE-001 · *Rules:* D-1, D-2
- `ROSTER-003`: *Tier:* Core · *Rules:* D-1, D-2
- `TIME-001`: *Tier:* Core · *Rules:* D-1, D-2
- `TIME-002`: *Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Rules:* D-1, D-2
- `PAYROLL-001`: *Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-DATA-001 · *Rules:* D-1, D-2
- `PAYROLL-002`: *Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Rules:* D-1, D-2
- `AGENT-001`: *Tier:* Core · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-ROLE-001 · *Register:* R-33
- `ARCHIVE-001`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001, BASE-DATA-006
- `ERASE-001`: *Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006, BASE-DATA-001
- `AUDIT-001`: *Tier:* Core · *Cites:* BASE-OPS-005, BASE-AUDIT-001, BASE-AGENT-009, BASE-ROLE-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001
- `PUBLIC-001`: *Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-DOCS-001, BASE-ACCESS-002, BASE-ACCESSIBILITY-001 · *Register:* R-31, R-32
- `BASE-001`: *Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-OPS-002, BASE-DATA-001, BASE-SECRET-001

### Existing guarantees

#### ACCESS-001 — Native sessions and server-side authority

**Requirement.** Owners grant workforce access; managers make staffing and time decisions; staff see their own private work. A manager cannot decide their own time or leave.

**Acceptance.**
1. Sign in as owner, manager and two staff through native invitation/confirmation routes; use the app and HTTP commands, attempt cross-person reads, self-approval, signed-out and cross-origin mutations, then deactivate a signed-in employee.
2. Unauthorized attempts fail without writes.

#### PEOPLE-001 — Staff lifecycle and payroll identities

**Requirement.** The owner adds, edits, activates, invites and deactivates employees with a unique email and payroll identifier and an explicit staff or manager role; staff without email use PEOPLE-003. Stale revisions cannot overwrite newer people records. Invitation and activation remain separate actions; removing access retains employment history.

**Acceptance.**
1. In People, create and invite staff, reject duplicate email/payroll IDs, edit the exact revision and deactivate a signed-in person.
2. Their prior shifts and hours remain while their private requests are denied.

#### MOVE-001 — Reviewed Staff CSV move-in

**Requirement.** The owner previews Staff CSV v1 without writes and applies only the exact reviewed fingerprint. Imported people start inactive and uninvited. Original inputs, mapping provenance, results and an import journal remain inspectable; undo removes untouched imports and preserves later native edits and dependent work. This documented format is not a verified vendor adapter.

**Acceptance.**
1. Paste Staff CSV in Move in, preview and inspect it, reject changed bytes at apply, apply the reviewed input, read its originals/journal, edit one imported person and undo.
2. Only untouched rows disappear and nobody is invited automatically.

#### ROSTER-001 — Availability and explicit leave decisions

**Requirement.** Staff record availability and request dated time off; managers approve or reject the exact pending request. Pending requests do not silently become approved absence. Self-approval and approval that collides with an already published shift are refused; the manager resolves coverage explicitly.

**Acceptance.**
1. Through staff and manager app/command doors record availability, request overlapping leave, reject self-approval, approve a valid request and attempt a published-shift conflict.
2. Inspect the decision author and retained state.

#### ROSTER-002 — Conflict-checked revision publication

**Requirement.** Managers and delegated agents prepare and publish an exact weekly roster revision. Publication rechecks active staff, availability, approved leave and overlapping assignments together. Republishing supersedes the previous week without deleting work history. An agent publication carries commitment; the company's policy decides whether it runs or is held for a person.

**Acceptance.**
1. Prepare an invalid week through the roster API and see named conflicts and refused publication.
2. Prepare a valid week, attempt stale approval, publish as a manager and inspect superseded records and activity.
3. A changed input requires fresh review.

#### ROSTER-003 — Personal published schedule confirmation

**Requirement.** Employees see their own current published shifts and confirm the exact shift revision. A confirmation records who and when, and cannot acknowledge a superseded shift or somebody else's assignment. Confirmation indicates the employee's response, not completed work. Seeing coworkers' shifts is ROSTER-004.

**Acceptance.**
1. Publish a roster, open it as each employee and confirm a personal shift.
2. Attempt a foreign or stale confirmation; inspect the visible published assignment and confirmation separately from clock records.

#### TIME-001 — Identity-bound phone capture and replay

**Requirement.** A signed-in employee clocks in and out with original capture time, receipt time and a stable command identity. Retrying the same body/person returns the same result without duplicate time; reusing its identity for a changed body or person fails. Only one open clock is allowed and captured unpaid break minutes reduce worked minutes. CLOCK-002 encrypts and retains the phone client’s pending captures across restart.

**Acceptance.**
1. Use staff clock commands to start and stop a shift, replay both events, and reuse an identity with another time/person.
2. Read one closed clock and one submitted timesheet with correct net minutes; an employee cannot approve it.

#### TIME-002 — Exact time approval and linked corrections

**Requirement.** Managers review submitted hours, prepare reasoned missed time and approve the exact revision. A correction links to the latest approved source, retains the original and requires fresh approval; overlap and future-time checks apply. Employees never approve their own work and a pending correction prevents exporting its obsolete source. Approving many timesheets at once is TIME-008, under the same exact-revision rule.

**Acceptance.**
1. Prepare missed time, approve it through a manager session, correct its break or duration, approve the correction and inspect retained superseded history.
2. Reject self/stale approval and overlapping work; attempt payroll export while a correction awaits decision.

#### PAYROLL-001 — Reviewed once-only payroll files and signed adjustments

**Requirement.** A manager reviews the exact approved-source CSV and explicitly exports that revision. Unique source claims prevent two batches claiming the same time revision. Downloads verify immutable bytes and hash and are manager-only; later corrections export the signed difference from previously claimed time. Payroll IDs must still match at export. Downloading twice does not create a new batch, but cannot prevent somebody uploading a file twice outside Lanyard.

**Acceptance.**
1. Prepare two competing batches through payroll commands, export one and reject the other.
2. Download identical bytes twice through the authenticated CSV route, refuse staff access, then approve a negative correction and export only its delta while the old download stays unchanged.

#### PAYROLL-002 — Explicit manual provider acknowledgment

**Requirement.** After downloading a payroll file, a manager records the provider reference against the exact exported batch. Lanyard labels this as a person-recorded acknowledgment. It does not imply a live transfer, provider readback, payroll application or wage payment; those states belong to SYNC-001 and the named connectors.

**Acceptance.**
1. Export hours, record a provider reference through the payroll acknowledgment action, reload the batch and inspect its reference, actor and time.
2. A draft cannot be acknowledged and a stale batch revision is refused.

#### AGENT-001 — Delegated workforce actions and reduced preparation context

**Requirement.** Delegated workforce access exposes reduced preparation context and roster, time and payroll actions within the granted jobs. The preparation-context projection omits payroll identifiers, download files and staff contacts. A decision or publication carries commitment; a payroll transfer also carries money and external, and a grant change carries access. The company's policy decides every agent action. The named person's own confirmations remain attributable to that person.

**Acceptance.**
1. Under the held company policy, issue a key, read its reduced context and prepare time; attempt a time decision and payroll transfer through both doors and see the pending policy decision without an effect.
2. After the named person decides the saved revision, inspect the separate preparation and decision records; revoke the key and retry the same workforce action without a write.

#### ARCHIVE-001 — Complete installation archive with authority exclusions

**Requirement.** The workforce archive retains the original owner identity and supported people, rosters, time revisions, payroll files/source claims, events and import originals/journals. Sessions, sign-in links, agent keys, provider credentials and the development outbox are excluded; configuration is re-entered and the archived owner signs in anew. A destination or supplied later erasure journal fences older erased workforce identities. Disconnected copies need the handling described in PRIVACY-003.

**Acceptance.**
1. Use public rer export/import commands on an installation with staff, published shifts, corrected/exported hours and import history.
2. Round-trip records and files, reject damaged/populated imports, inspect excluded authority and sign in anew as the archived owner; supply a later erasure journal to refuse resurrection.

#### ERASE-001 — Unused identity erasure and restore fence

**Requirement.** An owner erases an unused, uninvited, never-imported workforce identity and records a fence against its recreation or restore. Invited, imported or employed people retain necessary employment facts with deactivation available. PRIVACY-001 to PRIVACY-003 govern the broader disposition. This is the retained-workforce replacement for eligible identity deletion: Supersedes `BASE-DATA-003` under the recorded retained-employment decision.

**Acceptance.**
1. Create an unused person, erase via its exact revision, inspect the state for removed name/email, refuse native/CSV recreation and refuse an older archive with the later fence.
2. Attempt erasing invited or imported staff and require retention with deactivation available.

#### AUDIT-001 — Durable decisions and transactional history

**Requirement.** Roster publication, time decisions, payroll export/acknowledgment, staff import actions, erasure and payroll downloads retain their workforce subject, actor role and decision time. A mutation, its payroll claims, decision record and replay outcome form one atomic outcome. Staff imports record each created or removed person; downloads record their own event. The workforce activity projection has the field and site boundaries in the [activity projection](docs/contract/MECHANISMS.md#audit-001), including anonymous feedback and private-note exclusions.

**Acceptance.**
1. Perform the roster-to-payroll journey through public doors, inspect each actor/revision/event, restart and round-trip the archive.
2. Cause a stale concurrent mutation and verify no orphan decision or source claim appears.
3. Read the activity as the owner (all of it), the cafe's manager (everything about the cafe's people, nothing about another cafe), a second cafe's manager (only that cafe's person and setting) and an employee (only events on their own records, never roster publication or payroll); each event carries only actor, role, action, subject id and time.

#### PUBLIC-001 — Public run site and installed Lobby

**Requirement.** The Lanyard run site leads from the hourly-workforce target to installation and owner guides. Its installed Lobby reflects the durable owner claim before first-run confirmation; marketing and installed operational state stay distinguishable.

**Acceptance.**
1. Build the run site, follow homepage to /run and /docs, then claim an installation through native setup and inspect the installed Lobby before and after first-run confirmation.
2. Private product data remains session-protected.

#### BASE-001 — Maintained installation and operations commands

**Requirement.** The maintained Lanyard command guide covers its workforce setup, launch, diagnostics and explicit reset. Its archive restores the retained workforce owner under ARCHIVE-001, and reset cannot remove another workforce installation.

**Acceptance.**
1. From a fresh clone use documented command help and structural check, launch and sign in, build and verify, exercise backup/restore, then perform a provider-authorized deployment and health readback.
2. Reset requires explicit confirmation and never removes another installation.

## Target clauses

### Workforce records and schedule building

#### TEAM-001 — Multi-location roles and delegated management

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001

**Requirement.** Owners organize businesses, locations, departments and jobs; assign employees to several eligible sites; and independently scope schedulers, managers, time approvers, payroll administrators and read-only analysts. Wage and tip visibility remain separate. Custom permissions use ACCESS-003, private leave authority TEAM-002, and audit authority TEAM-003.

**Acceptance.**
1. Create two locations with a shared employee and separate managers through organization settings.
2. Use each role to schedule, approve, report and export; reject foreign-site actions and wage reads, then revoke a grant during an active session.
3. A site manager's bulk approval pinned to a foreign-site timesheet skips it (TIME-008).
4. Delegate fair-workweek administration and consequence review to one permitted site, with separate wage permission; another site remains outside that grant.

#### TEAM-002 — Scoped private leave administration

*Tier:* Core · *From:* TEAM-001 · *Cites:* BASE-ROLE-001

**Requirement.** A separately appointed leave administrator manages named employees and sites. Reading permitted purposes requires a separate grant; scheduling, ordinary leave approval and payroll permissions confer no private bank or purpose access. Ordinary managers see only generic absence. A person cannot approve their own leave. PRIVACY-001 to PRIVACY-003 govern custody.

**Acceptance.**
1. Grant private administration at one site, inspect a bank and decide and correct a request; refuse another employee or site and a purpose read without its separate grant.
2. Refuse the administrator's own leave decision, revoke the grant during the session and verify later reads, decisions and downloads fail without changes.

#### TEAM-003 — Named read-only audit grants

*Tier:* Core · *From:* TEAM-001 · *Cites:* BASE-ROLE-001, BASE-AUDIT-001

**Requirement.** Audit access is a separate read-only permission for a named person, bounded by business, sites, employees, jurisdictions, report classes and date range, with purpose and access end date. Sensitive wage data needs its own necessary-purpose permission. An audit grant confers no operational, integration or privacy administration; private leave purposes, private notes and unrelated personal data stay outside its ordinary projection. This is the REPORT-002 authority outcome of RL-1.

**Acceptance.**
1. Grant a named auditor read-only access to one permitted site, employee set, jurisdiction, report class and period; verify the exact expected records and fields, refuse each out-of-scope read and download and every operational mutation, then revoke access during an active session and verify the next request fails.

#### PEOPLE-002 — Jobs qualifications preferences and effective pay rates

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001

**Requirement.** Managers maintain job skills, certifications with expiry, site eligibility, employee preferences, minimum/maximum hours, employment classification and effective-dated USD wage/job rates. Qualification expiry blocks unsuitable assignment and private wage access is restricted. Changes preserve the rate/policy basis used for past costs and payroll preparation. Applying a SCHEDULE-002 template, copy or recurring shift rechecks qualifications, and so does every COVER-001 swap proposal, consent and approval and every COVER-002 pickup. Its employment classification takes over COVER-004's employment type and start date. The public job/profile commands are employer-recorded facts, not credential verification. A manager maintains profiles for their home cafe, and the owner acts for payroll administration until TEAM-001/ACCESS-003. The [retained jobs qualifications preferences and effective pay rates details](docs/contract/MECHANISMS.md#people-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Add a cross-trained employee with expiring certification, different job rates and preferences; schedule across the expiry/rate boundary, reject an unqualified shift and inspect historical cost snapshots after a rate change.
2. Apply a SCHEDULE-002 template that places an unqualified person and see the qualification conflict before publishing.
3. A COVER-001 swap that hands a shift to an unqualified coworker is refused.

#### PEOPLE-003 — Phone-number staff accounts and text invitations

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-ACCESSIBILITY-001

**Requirement.** Owners and managers add hourly staff with only a US mobile number, invite them by SMS through Twilio and let them sign in with a one-time text code bound to that number; email is optional for staff. Mobile numbers are unique among active people, verified before use and changed only through a re-verified flow. Carrier opt-out (STOP), number change or a lost phone revokes text sign-in without deleting employment history, and PEOPLE-001 payroll identity rules still apply.

**Acceptance.**
1. Add a staff member with only a mobile number, send the text invitation, sign in with the code and confirm a published shift.
2. Reject a duplicate number, an expired or replayed code and a sign-in after STOP or a number change; the person's prior shifts and hours remain and each attempt appears in audit.

#### CONTACT-001 — Emergency contacts on the shift and employee card

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-DATA-006, BASE-MAIL-001

**Requirement.** Each employee has emergency contacts (name, relationship, phone) held by the field authority chosen under PAYSYNC-001: Willow or BambooHR (HR-001), the connected payroll provider where it exposes them, or Lanyard. When Lanyard is the authority staff maintain their own contacts in the employee app. Owners and site managers whose scope covers the person's shift see the contacts read-only on the shift, live-attendance and employee cards, including from a CLOCK-004 late or no-show alert; other roles and other sites cannot read them. Every view is audited and the data follows PRIVACY-001 retention and erasure. The [retained emergency contacts on the shift and employee card details](docs/contract/MECHANISMS.md#contact-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. As staff add two emergency contacts; as the site manager open a no-show alert for that person and call from the card.
2. A manager at another site is refused and the attempt is audited.

#### ACCESS-002 — Manager single sign-on and required second factor

*Tier:* Core · *Cites:* BASE-SIGNIN-001, BASE-SIGNIN-002, BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001 · *Register:* R-1

**Requirement.** Owners select Google Workspace, Microsoft Entra ID or Okta for workforce manager and payroll-administrator sign-in, mapped to existing people by verified email or explicit subject. They can require a passkey or authenticator factor before time decisions and payroll export. Staff retain their text-code or email-link route.

**Acceptance.**
1. Configure Google and Microsoft sign-in, sign in as a mapped manager and refuse an unmapped account.
2. Require a passkey for the payroll role, attempt an export without it (refused) and with it, then deactivate the manager and retry during the open session.

#### ACCESS-003 — Custom access levels

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-005, BASE-AUDIT-001, BASE-DATA-006, BASE-MAIL-001

**Requirement.** Owners define named workforce access levels from the permission catalog, scoped to business, location and department. People may hold different levels at different sites; the catalog includes emergency contacts, wages, time decisions, payroll, reports and integrations. TEAM-001 role defaults are editable and grant nothing until configured. No level widens a preparation-context grant. TEAM-002 and TEAM-003 carry private leave and audit authority; the catalog and substitution semantics are documented in the [access details](docs/contract/MECHANISMS.md#access-003).

**Acceptance.**
1. Create a "Shift lead" level that can edit drafts and approve swaps but cannot publish, see wages or approve time, assign it at one site and exercise it through the app and HTTP commands; refused actions write nothing.
2. Attempt to grant a level containing payroll export as a manager without it (refused), then remove the swap permission during an active session and see the next approval refused, with both changes in audit.
3. A scheduler level without the emergency-contact permission is refused a CONTACT-001 contact card and the attempt is audited.

#### JOURNAL-001 — Employee notes and manager journal

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-DATA-006, BASE-MAIL-001

**Requirement.** Authorized managers add dated notes to an employee's record (attendance conversations, performance, commendations) with category, author and optional attachment, and choose per note whether the employee can see it. Notes are scoped by site and role, never appear in team views, agent context or broad reports, keep prior versions when edited and follow PRIVACY-001 retention, legal hold and access requests. The [retained employee notes and manager journal details](docs/contract/MECHANISMS.md#journal-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. As a site manager add a private note with an attachment and an employee-visible note to an employee; read them as a second-site manager, the employee and an agent key and see only what each may read.
2. Edit one note and inspect its retained version, and refuse a stale edit; PRIVACY-001 carries the employee's record export and which notes it contains.

#### SCHEDULE-001 — Editable visual schedules and publication review

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-006, BASE-ACCESSIBILITY-001 · *Rules:* D-1, D-2

**Requirement.** Managers build day/week schedules with drag-and-drop, resize, copy and bulk assignment, seeing roles, sites, headcount, breaks, coverage gaps and live conflict/cost warnings. Drafts remain private until a reviewed publish/change diff. Undoing a draft edit cannot erase published history; mobile managers can perform the same core scheduling work. Review applies to every currently shipped scheduling door, including SCHEDULE-002 templates, copies and recurrence. Daily headcounts and USD estimates group shifts by their start date in the venue time zone; cost uses whole elapsed shift minutes less meal minutes at current hourly rates, rounded to cents per shift. Exact unchanged rows cancel one-for-one in the change preview; changed rows appear as removed and added. TEAM-001, SCHEDULE-003, DEMAND-001 and COST-001 inherit the same editing and review obligations for every new site, coverage and cost capability they add before shipping.

**Acceptance.**
1. Build a realistic service week in the schedule UI, move and bulk-edit shifts, inspect warnings and the employee-facing change diff, publish it and verify employee views.
2. Repeat core edits at 390px and reject stale publication.

#### SCHEDULE-002 — Reusable templates recurring shifts and duplication

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-006, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers save schedules and role-based shifts as templates, duplicate selected days/weeks, and generate recurring assignments with explicit end dates and exceptions. Applying a template rechecks current leave, availability, qualifications, budgets and policies without auto-publishing or copying stale confirmations. Owners and managers save, copy and repeat. Each makes a new draft revision of the target week holding its current rows (its open draft, else its published revision) plus the added shifts at the same venue wall times, so a copy across a daylight-saving change keeps 7:00 am; nothing is published and no confirmation is carried. Templates and copies keep each shift's person, times, meal minutes, label and cafe; a person no longer active is left out and named. The [retained reusable templates recurring shifts and duplication details](docs/contract/MECHANISMS.md#schedule-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Save a week, duplicate it into a holiday week and apply a recurring pattern with an exception.
2. Review conflicts for an employee now on leave, edit only one occurrence and publish after approval without altering previous weeks.

#### SCHEDULE-003 — Cross-site coverage and double-booking prevention

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2

**Requirement.** One schedule spans multiple locations and time zones with location/role coverage requirements. Employee conflicts, travel time, minimum rest, overtime and hours budgets are calculated across all their sites. Authorized managers coordinate transfers without competing bookings; site-local times, overnight shifts and US daylight saving transitions remain explicit.

**Acceptance.**
1. Build schedules for two US sites sharing staff, including an overnight and DST-boundary shift.
2. Try overlapping and impossible-travel assignments, compare cross-site hours and publish a valid coverage plan through authorized managers.

#### SCHEDULE-004 — Shift instructions checklists and blocker handovers

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers attach operational instructions and checklists to shifts. The current assignee reads them, completes named tasks and reports immutable blockers with files; earlier authors retain their own responses. Editing instructions creates new task identities without treating an old answer as completion. Notes remain absent from print and wall schedules. Work-area allocation is SCHEDULE-007; custody and revision details are in the [handover details](docs/contract/MECHANISMS.md#schedule-004).

**Acceptance.**
1. Staff open it on mobile, complete tasks and report a blocker; managers inspect the handover.
2. A printed copy and the wall display of that week show none of the notes (SCHEDULE-005).

#### SCHEDULE-007 — Reconciled job and area segments

*Tier:* Core · *From:* SCHEDULE-004 · *Cites:* BASE-INPUT-003, BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers divide a shift into ordered job/area segments that cover its elapsed minutes. Every job remains qualification-checked on reassignment. Submission pins the instruction and area plan; payable minutes are allocated once over the retained areas and effective job rates. Approved labor, classifications and payroll reconcile to the enclosing timesheet. Corrections export signed per-job, per-area differences under its one claim. Allocation details are in the [handover details](docs/contract/MECHANISMS.md#schedule-004).

**Acceptance.**
1. Publish a shift split between counter and kitchen with a closing checklist.
2. Submit and approve the segmented worked shift, reconcile the segment totals and retained rates to labor and payroll, then correct its duration and export only the signed per-area difference once.

#### LEAVE-001 — PTO balances and staffing-aware time off

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2

**Requirement.** Employees view PTO/sick balances, request full/partial-day leave and see decisions; managers review coverage and policy limits before approving. Accruals, carryover and paid/unpaid codes are employer-configured with effective dates. Each leave type has one explicit authority under PAYSYNC-001: Lanyard, an HR-001 source or the connected payroll provider (PAYSYNC-004); approvals update availability and payroll classification without duplicate balances.

**Acceptance.**
1. Configure a US PTO policy, accrue a balance, request partial-day leave and approve with a coverage warning.
2. Carry a year-end balance and reconcile paid/unpaid hours; connect HR or payroll-provider authority and reject conflicting double decisions and balance edits.

#### AVAIL-001 — Recurring availability preferences and approval

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001

**Requirement.** Employees set recurring weekly availability as available, preferred or unavailable blocks per day with effective start and end dates, add one-off exceptions and state preferred and maximum weekly hours. Managers may require approval of availability changes; a pending change does not alter scheduling until approved, and a change that collides with published shifts lists the affected shifts. Scheduling, swaps, offers, optimization and FAIR-001 read the effective pattern for each date. An approved pattern governs each venue date from its first day to its optional last day, the newest first day winning; a date's one-off exceptions replace that weekday's blocks. A shift touching an unavailable block or exception is flagged as marked unavailable; otherwise it is available when the effective available or preferred blocks, or dated availability windows, cover it end to end. The [retained recurring availability preferences and approval details](docs/contract/MECHANISMS.md#avail-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. As staff submit a recurring pattern starting next month with one exception date, approve it as manager and schedule across the effective date.
2. Shifts before the date follow the old pattern, a shift in an unavailable block is flagged, a preferred block ranks first in the call-out shortlist (COVER-003 keeps that order) and a still-pending change leaves conflicts unchanged.

#### LEAVE-002 — Time-off blackout dates limits and team leave calendar

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers set blackout dates and per-site or per-role limits on how many people may be off at once, and see a team leave calendar of approved and pending time off beside the schedule. Requests inside a blackout or over a limit are refused or routed for explicit override with a reason; employees see the allowed dates before requesting, and pending requests show distinctly from approved leave. The [retained time-off blackout dates limits and team leave calendar details](docs/contract/MECHANISMS.md#leave-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Configure a holiday blackout and a two-person limit for servers, submit three overlapping server requests and one inside the blackout, approve two, override the third with a reason and inspect the calendar and refusals as staff and as manager.

#### LEAVE-003 — Paid sick and safe leave jurisdiction presets

*Tier:* Core · *Cites:* BASE-DATA-006, BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Maintained sick and safe leave presets cover California, Colorado, Illinois, New York State, Oregon, Washington, New York City, Chicago, Seattle, San Francisco, Los Angeles and Philadelphia. Each retains effective sources for accrual, caps, carryover, waiting, increments, eligibility, reasons and paid/unpaid status. Approved work accrues by work site; use, corrections, PTO tiers, normal-day floors and paid-service deduplication follow the [bank rules](docs/contract/MECHANISMS.md#leave-003). Unlisted jurisdictions and alternative arrangements are labelled employer-configured and unmaintained. Native service and effective private employer reviews determine eligibility, never app role, salary, title or payroll mapping; employer assertions do not establish independent legal verification. Effective purpose guidance preserves covered-family, safe-leave and proceeding categories without collecting medical or family details. The RL-2 private-administration outcome retains employees' own bank/purpose reads and interim owner-only administration, with ordinary managers seeing generic absence; delegated administration remains TEAM-002. LEAVE-004 and LEAVE-005 hold separate supplemental banks. Oregon donation follows LEAVE-006 under RL-103; it creates no pay until authorized leave use. LEAVE-001 and PAY-001 retain provider authority and mapping, and PRIVACY-001 to PRIVACY-003 retain custody obligations.

**Acceptance.**
1. For each listed preset accrue leave from approved hours for an employee working there, cross a cap and a year boundary, take a partial-day absence and export the balance and pay code.
2. An employee splitting time between two jurisdictions accrues under each site's preset, and an unlisted city shows the unmaintained label.
3. Record effective employee coverage and prior qualifying service, refuse excluded or unresolved future use without changing earned minutes or approved sources, then review covered employment and complete permitted use; retain the private reviews after restart and restore.
4. Apply native qualifying-service thresholds and restrictive state floors, rebuild Seattle qualification without duplicate use, and refuse unlisted or not-yet-effective purposes without an absence or backdated entitlement.

#### LEAVE-004 — Separate NYC supplemental unpaid leave

*Tier:* Core · *From:* LEAVE-003 · *Cites:* BASE-DATA-006, BASE-ROLE-001 · *Rules:* D-1, D-2

**Requirement.** The separate NYC supplemental bank grants 32 immediately available unpaid hours from 22 February 2026 without accrual, beside the accrued NYC base bank at the same cafe. Employment start and current cafe or approved work determine availability. Unused supplemental hours do not carry to the next January grant; approved use retains its grant history.

**Acceptance.**
1. At one cafe use the accrued NYC bank and separate 32-hour supplemental bank, refuse pre-employment and pre-effective-date use, exhaust the supplemental balance and refuse further use.
2. Cross January without carrying unused supplemental minutes, correct an approved use and restore the retained banks without combining their sources.

#### LEAVE-005 — Separate New York prenatal bank

*Tier:* Core · *From:* LEAVE-003 · *Cites:* BASE-DATA-006, BASE-ROLE-001 · *Rules:* D-1, D-2

**Requirement.** A separate prenatal policy provides 20 immediately available paid hours from 1 January 2025 without accrual. Its 52-week period starts with first approved use; January does not replenish it and a correction retains the first-use date. The prenatal bank remains separate from other sick-time banks and supplies mapped pay and retained signed corrections.

**Acceptance.**
1. Use the immediately available prenatal bank, cross January without replenishment, exhaust it and refuse excess use; start its next 52-week period from the retained first-use date.
2. Correct use, reconcile the mapped wage and signed difference, and restore the independent bank and source history.

#### LEAVE-006 — Voluntary Oregon bank donations

*Tier:* Core · *From:* LEAVE-003 · *Cites:* BASE-DATA-006, BASE-ROLE-001, BASE-DATA-001 · *Rules:* D-1, D-2

**Requirement.** Under RL-103, an effective employer policy must allow Oregon donation. The owner prepares a named recipient and exact minutes; the donor consents in their own session and can withdraw before a separate owner decision. Approval rechecks both current balances and the exact effective policy, recipient and minutes. The transfer atomically conserves bank minutes without accrual, annual absence use, immediate payroll or paid service. Pay follows only approved use for an authorized purpose. Consent, withdrawal, transfer and approval history survive restart and archives; there is no automatic reversal or deletion. RL-2 and PRIVACY-001 to PRIVACY-003 govern private custody.

**Acceptance.**
1. Refuse donation when the policy disallows it, without actual donor consent, after withdrawal, with changed policy or balances, and with a self-approved substitute for donor assent.
2. Approve the exact consented transfer, read both balanced sources and history, refuse a duplicate, and pay the recipient only on later approved permitted use; restart and restore without losing either side.

#### MINOR-001 — Minor work-hour limits and permits

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-006, BASE-MAIL-001

**Requirement.** Employers record private birth and permit evidence for federal FLSA limits and maintained California, New York, Illinois, Washington, Oregon and Colorado minor-work rules, with dated school calendars. Planning, swaps, offers and clocking name each applicable restrictive rule without revealing age to coworkers. Worked time and violations are retained. Under RL-104, an assertion binds its source, actor, time, workplace, effective dates and rule version; missing, stale or incompatible authority cannot grant an exception. Parent/school consent represents the named parties' evidence rather than an owner substitute, and supervision evidence does not establish live presence. The [minor-rule details](docs/contract/MECHANISMS.md#minor-001) preserve calendar, cumulative-hour and restrictive-permit calculations. Birth/permit custody follows RL-4 and PRIVACY-001 to PRIVACY-003.

**Acceptance.**
1. Schedule a 15-year-old past the school-day limit and after the evening cutoff, offer them an open shift that would breach the weekly limit and attempt an early clock-in; each is refused or flagged with its rule.
2. A 17-year-old under a state rule is checked separately, and a teammate cannot see either age.
3. Record parent/school, release, supervision and variance evidence; refuse missing, stale, wrong-workplace or incompatible authority, apply all restrictive terms together and retain completed work with its violations.

#### SCHEDULE-005 — Printable and posted schedules

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers print or export the published week as PDF by site, role or employee and show a read-only wall schedule on a site screen, each stamped with the revision and publication time. Posting records support POLICY-002 posting duties, and a later change marks printed copies superseded in the app. Private notes, wages and leave reasons never print. Owners and managers print. A printed copy is a PDF built from the rows recorded at printing (person, position, shift times and shift label; never pay, contact details, notes or time-off reasons), so it downloads byte-identical later, stamped with its posting time. Its revision is the week's publication number: 1 for the first publication of that week, 2 for the next. The [retained printable and posted schedules details](docs/contract/MECHANISMS.md#schedule-005) define source fields, calculations and revision behavior.

**Acceptance.**
1. Publish a week, print site and employee PDFs, open the wall display, then change a shift.
2. The PDFs carry the old revision, the display moves to the new revision and the posting record shows both times; wages and time-off reasons are absent from every output (SCHEDULE-004 keeps its private notes out).

#### SCHEDULE-006 — Schedule change history and revision compare

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers and affected employees see each shift's history: who created, moved, reassigned, swapped, canceled or republished it, when, why, and which notices and acknowledgments followed. Managers compare any two published revisions of a week as a diff by person, site and hours, and export the change log for POLICY-002 records. Each published shift continues a shift line across the revisions of its week: a republished row continues the current revision's row with the same person, times and cafe, else it starts a new line. A manager moves or reassigns one shift within its week or cancels it, each with a reason, before it starts and while it is not waiting for call-out cover; that publishes a new revision of the week in which only that shift differs, the changed shift's ROSTER-003 confirmation starts empty, and open swaps and call-out offers on the unchanged shifts follow them. The [retained schedule change history and revision compare details](docs/contract/MECHANISMS.md#schedule-006) define source fields, calculations and revision behavior.

**Acceptance.**
1. Publish a week, then move one shift, approve a swap and cancel another.
2. Open each shift's history as manager and as the affected employees, compare the first and latest week revisions and export the change log with reasons and notice states.

### Coverage employee experience and follow-up

#### COVER-001 — Employee shift swaps with final approval

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Employees offer a shift or propose an exchange; eligible coworkers consent and a scoped manager approves the exact exchange. Availability, qualification, rest, overtime, leave and coverage are rechecked at decision time. Pending swaps do not change responsibility; concurrent requests cannot assign the same shift twice. Swap eligibility reads each person's effective AVAIL-001 pattern for the swapped dates. An employee offers one of their upcoming published shifts to a named coworker, or proposes exchanging it for one of that coworker's upcoming published shifts at their cafe; an eligible coworker is active, has the same home cafe and (when the proposer has one) the same position, and is not hidden from the ROSTER-004 team view. The [retained employee shift swaps with final approval details](docs/contract/MECHANISMS.md#cover-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. On employee mobile accounts (the responsive app; native apps are MOBILE-001's) propose and accept a two-person swap, approve as manager and inspect both changed schedules/notices (each person's in-app swap record; delivered notices are NOTICE-001's).
2. Refuse an ineligible coworker, stale request and two competing approvals; retain the original assignee until completion.
3. A coworker whose AVAIL-001 pattern marks the swapped shift unavailable is refused.

#### COVER-002 — Open shifts offers and pickup

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers publish unassigned shifts to eligible staff or a controlled pool. Employees see job/site/rate details and request pickup; manager policy determines approved pickup versus explicit final approval. Atomic assignment closes all other offers, rechecks eligibility and prevents duplicate pickup or silent coverage loss. A SCHEDULE-002 template row saved for a position without a person becomes an open shift when the template is applied. The owner posts for any cafe and a manager only for their home cafe until TEAM-001 brings site scopes, choosing per open shift whether the first eligible request is approved at once or a manager approves one request, and optionally a pool of named people. The [retained open shifts offers and pickup details](docs/contract/MECHANISMS.md#cover-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Post an open shift, view it as eligible and ineligible staff and submit competing pickup requests.
2. Approve one, verify all other offers close and current assignments/notices (the in-app request records; delivered notices are NOTICE-001's) update exactly once.
3. Apply a template with a position-only row and see it posted as an open shift.

#### COVER-003 — Call-out replacement and verified coverage

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Employees report an absence or managers record a call-out against a shift with minimal private reason disclosure. The manager sees a qualified available replacement shortlist, cost/overtime effects and timed offers; employees accept and a manager approves assignment. An unfilled shift escalates to the responsible manager and remains uncovered until accepted, then attendance is monitored through actual clock-in. Its replacement order keeps AVAIL-001's ranking: teammates whose effective pattern prefers the whole shift come first. The [retained call-out replacement and verified coverage details](docs/contract/MECHANISMS.md#cover-003) define source fields, calculations and revision behavior.

**Acceptance.**
1. Call out before a shift, contact eligible replacements, let one offer expire, approve an accepted replacement and observe notice/acknowledgment and clock-in.
2. A nonresponsive replacement reopens an actionable coverage exception without fabricating attendance.
3. A teammate whose AVAIL-001 pattern prefers the shift is contacted first.

#### COVER-004 — Offer order and access-to-hours priority

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers choose how open shifts and replacements are offered: to all eligible staff at once, in timed tiers by priority (part-time staff who want more hours, preferred availability, fewest hours this week, seniority or a custom ranking) or first-come pickup. Where a POLICY-002 preset requires offering hours to existing staff before hiring or using temporary workers (San Jose, Seattle, San Francisco and New York City), the offers and responses are kept as the compliance record. Each COVER-002 open shift is posted with its order: everyone eligible at once, or tiers of a chosen size (1–50 people) opening a chosen number of minutes (1–1440) apart from the posting time; first-come pickup is COVER-002's approved pickup with either order. The [retained offer order and access-to-hours priority details](docs/contract/MECHANISMS.md#cover-004) define source fields, calculations and revision behavior.

**Acceptance.**
1. Post an open shift with a two-tier offer, let tier one expire with one decline, have tier two accept and approve.
2. Inspect the offer log, times and responses; at a San Jose site, hiring a new person for those hours is flagged until existing part-time staff have been offered them.

#### ROSTER-004 — Team schedule visibility for staff

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Employees see who else works their site, role and day on the published schedule, showing coworker name, role and shift times only, so they can arrange swaps and handovers. Managers choose per site whether staff see the whole site or only their role, and can hide a person for safety reasons. Drafts, wages, leave reasons, contact details and other sites stay hidden. By default each site shows staff its whole published team; an owner or manager may narrow a site to the viewer's own position. A staff member's site is their home cafe on People; a shift belongs to the cafe it was scheduled at, else its person's home cafe, and an installation without cafe names is one site. The [retained team schedule visibility for staff details](docs/contract/MECHANISMS.md#roster-004) define source fields, calculations and revision behavior.

**Acceptance.**
1. Publish a week for two roles at two sites; as staff open the team view and see coworkers' names and times for the permitted scope, then switch the site to role-only and hide one person.
2. Requests for drafts, wages, contact details or another site's shifts return nothing.

#### NOTICE-001 — Delivered schedule notices and acknowledgment

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Publication, changes, pickups, swaps and cancellations create recipient-specific in-app, push, email and US SMS notices in the recipient's language (LANG-001), using APNs/FCM, Resend and Twilio as supported delivery services. Deduplicated attempts expose queued, provider-accepted, delivered where observable, failed and employee-acknowledged states separately. Consent, quiet hours, urgent policy, US sender registration and opt-out preferences control contact; sensitive leave/pay data is excluded. COVER-001 swap proposals, consents and decisions and COVER-002 open shifts and pickup decisions reach their people through it; until then the in-app swap record is the only notice. TIME-007's forgotten clock-out reminder is one of its notices: when a punch reaches its reminder point the employee receives it by push or SMS under the same consent, quiet-hour and opt-out preferences; until then TIME-007 shows it only in Lanyard. The [retained delivered schedule notices and acknowledgment details](docs/contract/MECHANISMS.md#notice-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Publish and change a shift for consenting employees, one with a Spanish preference; receive notices through each configured real provider, the Spanish-preference employee in Spanish, and acknowledge the exact revision.
2. Inspect receipts, a provider rejection, opted-out/quiet-hour routing and duplicate callbacks; delivery alone cannot mark employee acknowledgment.
3. Leave a TIME-007 punch open past its reminder point and receive the forgotten clock-out reminder by push or SMS (TIME-007).

#### NOTICE-002 — Reminders escalation and payroll follow-up

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001

**Requirement.** Managers set shift reminders, acknowledgment deadlines, open-offer expiry, late/no-show and missed-punch/break alerts, timesheet review cutoffs and payroll review reminders. Durable scheduled work survives restart, deduplicates per shift/revision/period, stops obsolete notices after resolution and escalates unresolved exceptions to an accountable manager. The [retained reminders escalation and payroll follow-up details](docs/contract/MECHANISMS.md#notice-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Configure a shift and payroll period, receive a reminder, leave a schedule change unacknowledged, miss a punch and cross the review deadline.
2. Restart the scheduler, resolve each item and inspect one appropriate escalation with no obsolete follow-up.

#### NOTICE-003 — Reminder delivery under employee contact settings

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** NOTICE-002 reminders and escalations respect employee contact settings: they leave Lanyard by push, email or SMS only through NOTICE-001's channels under its consent, quiet-hour, urgent-policy and opt-out preferences, and an opted-out or quiet-hour recipient keeps the in-app item.

**Acceptance.**
1. Repeat NOTICE-002's journey with a consenting, an opted-out and a quiet-hour employee: only the consenting employee is contacted outside Lanyard, the others keep the in-app reminder, and the escalation follows NOTICE-001's urgent policy.

#### CHAT-001 — Team messaging and operational handover

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003

**Requirement.** Staff and authorized managers use direct, group, site and shift threads, announcements and read acknowledgments, with attachments, search and retained handover context. Deactivated people lose access; private HR and payroll facts stay outside broad team threads. Shift-related conversations link to the actual schedule revision and cannot replace a formal swap or time approval. Under RL-6, removal and voluntary departure enforce current membership across history, files, search and commands without granting new readers; retained conversation history remains intact.

**Acceptance.**
1. Send a site announcement and shift handover, acknowledge and search them as staff, then transfer or deactivate a member and verify thread permissions.
2. A chat request to swap still requires the COVER-001 approval journey.

#### CAL-001 — Google and Outlook calendar subscriptions

*Tier:* Core · *Register:* R-3

**Requirement.** Employees subscribe to private revocable iCalendar feeds in Google Calendar and Outlook Calendar. Published assignments, changes and cancellations use stable event identities and correct site time zones; private notes, coworkers and draft shifts are excluded. The app states provider-controlled refresh and does not present a subscription as immediate two-way scheduling. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Subscribe from Google and Outlook, publish/change/cancel an overnight shift and inspect refreshed events and timezone.
2. Rotate/revoke the feed, confirm old access fails and verify another employee cannot retrieve it.

#### FEEDBACK-001 — Post-shift employee feedback

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001

**Requirement.** After clock-out employees may rate the shift, leave an optional comment or flag an issue (understaffed, equipment, safety, conflict). Managers see feedback by site, shift and manager with trends, reply and mark it resolved; where the employer enables it, an employee may hide their name from the site manager. Feedback never affects pay, approval or scheduling rank. The [retained post-shift employee feedback details](docs/contract/MECHANISMS.md#feedback-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Clock out three employees and submit a low rating with a safety flag, an anonymous comment and a skip.
2. The site manager sees the flag, resolves it with a reply the employee sees and the weekly report shows the trend; the anonymous author stays hidden, including from the stored records and history, which link it only through keyed digests, and the rating is absent from every ranking input.

#### LOG-001 — Manager logbook and shift handover log

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001

**Requirement.** Managers keep a daily logbook per site with entries by category (sales notes, incidents, maintenance, staffing, menu outages) and mentions, read by the next shift's managers with read receipts. Entries link to shifts, people and attendance exceptions; corrections are new versions, and an incident exports for insurance or for HR follow-up in Willow. The [retained manager logbook and shift handover log details](docs/contract/MECHANISMS.md#log-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Write closing and incident entries with five attachments of 10 MB each at one site, mention the opening manager, read and acknowledge as that manager, search last month by category and export the incident.
2. A manager of another site cannot see it and an edit retains the original.

#### MOBILE-001 — Employee and manager mobile apps

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESSIBILITY-001 · *Register:* R-29, R-30, R-31, R-32

**Requirement.** iOS and Android apps plus accessible responsive web cover schedules, team view, availability, leave, swaps, pickups, call-outs, messaging, time capture, earnings and acknowledgments, in English and Spanish (LANG-001); manager approvals and live attendance on mobile are MOBILE-002. Push deep-links to authorized current records; a revoked or shared device cannot expose another employee's work. Keyboard/screen-reader flows, clear pending/error states and recovery from weak connectivity cover core tasks. Its client inherits CLOCK-002 encrypted offline persistence, ordered reconciliation, revoked-session recovery and reasoned review before shipping.

**Acceptance.**
1. Use realistic multi-site data at 1440px and 390px and on supported iOS/Android devices; complete the shift-change-to-clock journey in English and in Spanish, follow a push deep link, lose connectivity and sign out/revoke.
2. Confirm accessible focus, current data and explicit unsent state.
3. Repeat CLOCK-002’s offline/restart/revocation and manager recovery journey on this client.

#### MOBILE-002 — Manager mobile approvals and live attendance

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-ACCESSIBILITY-001 · *Register:* R-29, R-31, R-32

**Requirement.** Managers and time approvers use the mobile apps and 390px web to see live attendance (CLOCK-004), approve, edit with a reason or bulk-approve timesheets (TIME-002, TIME-008, TIME-009), decide leave, swaps, pickups and availability, and view punch photos and locations, under the same site scopes and exact-revision rules as desktop. Late, no-show, missed-punch and pending-approval pushes deep-link to the record.

**Acceptance.**
1. On a phone-sized manager session open a late-arrival push, view the attendance board, approve a swap and a clean timesheet, edit one punch with a reason and bulk-approve the rest.
2. A stale revision is refused and a foreign-site record is not visible.

#### LANG-001 — Spanish staff experience and notices

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-ACCESSIBILITY-001

**Requirement.** Every staff-facing surface ships in English and US Spanish: the employee mobile apps, responsive web, shared kiosk and browser clock, schedule, swap and offer screens, timesheet review, clock questions and attestations, and every outbound push, SMS and email notice and calendar event text. Each employee has a language preference set by them or a manager; the kiosk switches language per signed-in employee and notices render in the recipient's language. Staff-entered text (notes, messages, reasons) stays in its original language. A check fails the build when a staff-facing string lacks its Spanish text.

**Acceptance.**
1. As a Spanish-preference employee complete the shift-change-to-clock journey on phone and kiosk, receive the change notice by push and SMS in Spanish, acknowledge it and answer clock-out questions in Spanish while an English-preference coworker on the same kiosk sees English.
2. Add an untranslated staff-facing string and see the check fail.

### Attendance US policy and labor economics

#### CLOCK-001 — Shared kiosk clocks and device authority

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003 · *Rules:* D-1, D-2 · *Register:* R-30

**Requirement.** A manager enrolls and revokes a tablet/shared-kiosk time clock limited to approved sites. Employees identify themselves with individual PIN/session verification, clock jobs and breaks without viewing others' private records, and sign out between users. Sites may require a punch photo at each kiosk punch (CLOCK-005), and the kiosk shows each signed-in employee their own language (LANG-001). Kiosk administration requires separate authority; lost devices and repeated failed PINs can be locked. Kiosk punches are rounded under the cafe's TIME-005 rule like phone punches. A kiosk punch changes job or cafe without clocking out under CLOCK-008's qualification, eligible-cafe, network and job-segment rules. Its client inherits CLOCK-002 encrypted offline persistence, ordered reconciliation, revoked-session recovery and reasoned review before shipping.

**Acceptance.**
1. Enroll a shared tablet with photo verification on, have two employees (one Spanish-preference) clock consecutive shifts and breaks, attempt identity guessing and cross-person reads, then revoke the tablet during a session.
2. Inspect correctly attributed punches each carrying its photo, the language each employee saw and denied further captures.
3. A kiosk punch at a cafe with a TIME-005 rule shows its captured and payable time.
4. Repeat CLOCK-002’s offline/restart/revocation and manager recovery journey on this client.
5. A kiosk punch changed from counter to kitchen splits into CLOCK-008 job segments with their own rates.

#### CLOCK-002 — Durable offline capture and reconnect reconciliation

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.**  The [retained durable offline capture and reconnect reconciliation details](docs/contract/MECHANISMS.md#clock-002) define source fields, calculations and revision behavior. CLOCK-001 and MOBILE-001 carry this offline/restart/revocation and reasoned recovery journey for their own clients.

**Acceptance.**
1. Clock and time a meal offline, close/restart the client, reconnect and retry; inspect one ordered set, captured/received receipts and capture-date rounded worked time.
2. Reject changed/reused identities, skewed captures and revoked access without losing the originals; on the same device sign in as a manager, see only the revoked-session count, explicitly submit for review and resolve with a reason without applying time automatically.
3. Refuse staff and foreign-cafe recovery, and warn before sign-out discards local captures.

#### CLOCK-003 — Geofenced mobile clocking with privacy controls

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001 · *Rules:* D-1, D-2 · *Register:* R-30

**Requirement.** Site geofences verify punch-time location with explicit employee notice and consent, accuracy and coordinate-free exception paths. RL-102 permits only a fresh observation for clock-in/out on an enrolled device: opening, breaks, transfers, retries and off-shift time capture no location. Denied, unknown, stale or inaccurate evidence cannot establish inside status. Readers are employee and owner under the interim fence, with scoped supervisor review owed under TEAM-001/ACCESS-003; review preserves captured facts. Explicit eligible coordinate erasure preserves minimal punch facts and flags under PRIVACY-001 to PRIVACY-003. Reported observations do not claim hardware attestation or legal consent. Photo capture is CLOCK-005.

**Acceptance.**
1. Clock inside/outside a site and with poor accuracy or location permission denied.
2. Review a documented exception, inspect punch-time location and retention controls, then revoke device access; no off-shift location trail appears.
3. Bulk approval (TIME-008) skips the out-of-zone timesheet with its exception named.
4. The TIME-009 review row shows each punch's location and out-of-zone flag.

#### CLOCK-004 — Live attendance and late or no-show alerts

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Managers see who is scheduled, present, on break, late, missing or clocked at the wrong site, with freshness and unresolved conflicts. Scheduled shift boundaries and configured grace periods generate accountable late/no-show alerts and coverage actions; published or confirmed shifts alone never count as worked. The board is read as of an instant and lists the published shifts that start on that venue date or are running then, at every cafe for the owner and, until TEAM-001 brings site scopes, at a manager's home cafe. Each shift is matched to the punch captured by then: its TIME-006 matched clock, else the person's unmatched clock that began within two hours of the shift start. The [retained live attendance and late or no-show alerts details](docs/contract/MECHANISMS.md#clock-004) define source fields, calculations and revision behavior.

**Acceptance.**
1. Run a service shift with an on-time, late, absent and offline employee.
2. Compare the live attendance board to actual punches, receive a late/no-show escalation, arrange coverage and resolve only from observed or approved time facts.

#### CLOCK-005 — Punch photo verification

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001, BASE-ACCESSIBILITY-001 · *Rules:* D-1, D-2

**Requirement.** Owners turn on photo capture at clock-in, clock-out and optionally break punches, per site and per device type (shared kiosk, employee phone, browser clock). The client takes a still photo at the punch and stores it with that punch event; approvers see it beside scheduled and captured times in timesheet approval (TIME-009, TIME-008) and on manager mobile. This is not face matching: no face template is created or compared, and facial-recognition sign-in remains optional partner work under BOUNDARY-001. Each employee sees a recorded notice before first capture at a site; a refused or failed camera records an explicit exception rather than silently omitting the photo. The [retained punch photo verification details](docs/contract/MECHANISMS.md#clock-005) define source fields, calculations and revision behavior.

**Acceptance.**
1. Turn on photos for a kiosk site and for phone clocking at a second site; clock in and out on both, then approve the timesheets and see each photo beside its punch.
2. Deny the camera on one phone punch and see the exception; a coworker and an agent key cannot read the photos; let retention expire and erase a former employee's eligible photos while the punch facts remain.
3. Bulk approval (TIME-008) skips the denied-camera timesheet with its exception named.
4. The TIME-009 review row shows the punch photo.

#### CLOCK-006 — Clock-in and clock-out questions and attestations

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Owners configure short questions shown at clock-in or clock-out per site or role (breaks taken, injury today, cash tips declared, or a custom yes-no or number), with required answers, Spanish text and versioned wording. Answers attach to the punch, open BREAK-001, TIME-003 or safety follow-ups when they indicate a problem and feed TIPS-001 declarations. Changing a question never rewrites earlier answers. Questions apply by the punch's cafe (its TIME-006 matched shift's, else the person's home cafe) and the person's position, each optionally required. The [retained clock-in and clock-out questions and attestations details](docs/contract/MECHANISMS.md#clock-006) define source fields, calculations and revision behavior. TIPS-001 carries taking these declared cash tips into its pool draft.

**Acceptance.**
1. Configure a break attestation, an injury question and a cash-tips declaration; clock out answering that a meal was missed and that an injury happened.
2. A break exception and a safety follow-up open for the manager, the declaration is listed for managers and an edited question keeps earlier answers under their old wording.

#### CLOCK-007 — Browser time clock on approved networks

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Owners enable a web time clock for back-office computers, restricted per site to approved public IP ranges or enrolled browsers, so staff can punch from a store computer without a kiosk. Punches from other networks are refused or flagged as configured, the network identity is recorded with the punch and no other device data is collected. Only the owner sets a cafe's rule: off (the default; phone clocking from anywhere), refuse or flag, with up to 50 approved IPv4 or IPv6 CIDR ranges (a bare address is one host). A punch belongs to its TIME-006 matched shift's cafe, else the person's home cafe; both clock-in and clock-out are checked against that cafe's current rule at the punch. The [retained browser time clock on approved networks details](docs/contract/MECHANISMS.md#clock-007) define source fields, calculations and revision behavior.

**Acceptance.**
1. Enroll a site's IP range, clock in from it and from an outside network.
2. The first succeeds with the network recorded, the second is refused or flagged as configured, and changing the range takes effect on the next punch.

#### CLOCK-008 — Mid-shift job and site transfers

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** A clocked-in employee switches job (for example server to bartender) or, where permitted, site from phone or kiosk without clocking out. Each segment keeps its own job, site, rate and pay codes, overtime still aggregates across the day and week, and a transfer to a job the person is not qualified for is refused. Transfers keep SCHEDULE-007's work-area reconciliation: on a punch whose shift has a pinned area plan, transfer segments and areas count each payable minute once within the enclosing timesheet, each segment keeps its retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area difference, once, under the enclosing timesheet's single payroll claim. The [retained mid-shift job and site transfers details](docs/contract/MECHANISMS.md#clock-008) define source fields, calculations and revision behavior.

**Acceptance.**
1. Clock in as server, transfer to bartender after three hours and clock out.
2. The timesheet shows two segments with their rates and codes, the payroll export splits them, a transfer to an unqualified job is refused and the week's overtime counts both segments.
3. A transfer on a shift with a pinned SCHEDULE-007 counter/kitchen plan reconciles to the enclosing worked time with each minute counted once at its segment's retained job rate, and a later correction exports only the signed per-job, per-area difference under the timesheet's one claim.
4. A job change captured offline replays with its original time; a cafe change outside the person's eligible cafes or against a refusing network rule is refused, and a flagging rule marks the punch off-network while each cafe's interval labor counts only its own segment.

#### BREAK-001 — Timed meals breaks and exceptions

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Employees start/end paid rest and unpaid meal breaks on phone or kiosk. Configured site/state policy checks timing, duration, missed/short breaks, waivers and attestations, producing reviewable exceptions and premium-pay inputs when applicable. Manual edits preserve employee facts and approval history; missing breaks cannot silently reduce payable work. A missed or short break is recorded as an exception on its timesheet, so TIME-008 bulk approval skips that timesheet and names the exception. Breaks are timed on the phone clock: a break start and end keep their capture time and command identity like clock events, one break is open at a time and clock-out waits for it to end; CLOCK-001's kiosk inherits the same break commands and checks before it ships, and POLICY-002's state and city presets fill the same policy fields. The [retained timed meals breaks and exceptions details](docs/contract/MECHANISMS.md#break-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Clock a meal and paid rest break, miss or shorten a required meal and submit an attestation.
2. Review the exception and a reasoned correction, then reconcile net/pay-code hours and any premium input in payroll preview.
3. A timesheet pinned for bulk approval that then gains a missed-break exception is skipped with the exception named (TIME-008).

#### BREAK-002 — Automatic meal deductions with employee attestation

*Tier:* Core · *Cites:* BASE-DATA-006, BASE-MAIL-001

**Requirement.** Owners may configure an automatic unpaid meal deduction per site (for example 30 minutes on shifts over 6 hours) when no meal was punched. The employee sees the deduction at clock-out and confirms the meal was taken or reports it missed or interrupted; a report reverses the deduction for approval and opens a BREAK-001 exception. Unconfirmed deductions are flagged in approval, and a site under a preset that requires recorded meal periods, such as California, cannot replace meal punches with a deduction. The rule belongs to the clock's cafe (its matched shift's cafe, else the person's home cafe) and applies when the clocked span is longer than the threshold and no meal minutes were entered; entered meal minutes replace the deduction. The [retained automatic meal deductions with employee attestation details](docs/contract/MECHANISMS.md#break-002) define source fields, calculations and revision behavior. The refusal of automatic deductions at California sites belongs to POLICY-003.

**Acceptance.**
1. Enable a 30-minute deduction, work a 7-hour shift without a meal punch and confirm at clock-out; work another and report the meal missed.
2. The first deducts with the confirmation recorded, the second pays the full time with an exception.

#### TIME-003 — Missed punches employee review and exception resolution

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Employees review daily/period timesheets, submit missing-punch or correction requests and attest to work and breaks. Managers compare schedules with captured events, investigate long/open/overlapping time and approve exact reasoned changes with employee visibility. Exceptions stay assigned and open until resolved, and deadline reminders continue under NOTICE-002. An edit changes the timesheet's revision, so a TIME-008 bulk approval pinned to the earlier revision skips it; time the employee confirms leaves TIME-008's unconfirmed state. TIME-006's flagged early and unscheduled punches and TIME-007's provisional closes open such an exception, assigned and open until resolved. Every exception recorded on a timesheet (TIME-006, TIME-007, BREAK-002 meal flags, CLOCK-007 off-network punches and the employee's own requests) is an open case on the approvers' list until a manager other than the employee resolves it with a reason; approval does not resolve it, and until TEAM-001 brings site-scoped approvers the case is assigned to every manager and the owner, as approval is (TIME-008). The [retained missed punches employee review and exception resolution details](docs/contract/MECHANISMS.md#time-003) define source fields, calculations and revision behavior.

**Acceptance.**
1. Miss clock-out, receive an exception, submit a correction as the employee, review/approve it as another authorized manager and inspect the original facts, attestation, reason and employee-visible outcome before payroll.
2. A manager's edit to a timesheet another manager has pinned for bulk approval makes that approval skip it as changed (TIME-008), and the employee's confirmation moves manager-entered time out of the unconfirmed filter.
3. A TIME-006 flagged early punch opens an exception that stays open until a manager resolves it.

#### TIME-004 — Payroll period locks and controlled reopening

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Payroll administrators define pay periods, collect employee/manager signoff and lock approved hours. Separate reopening permission requires a reason and records who reopened which period; closed or provider-applied periods accept linked late/off-cycle adjustments instead of rewriting paid history. Concurrent edits and transfers recheck period state. The [retained payroll period locks and controlled reopening details](docs/contract/MECHANISMS.md#time-004) define source fields, calculations and revision behavior.

**Acceptance.**
1. Approve and lock a period, deny an ordinary manager's edit/reopen, reopen with payroll authority and fresh signoff, then close after provider application.
2. A later correction produces an explicit adjustment and cannot mutate the original paid period.

#### TIME-005 — Punch rounding and snap-to-schedule

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Owners configure, per site and effective-dated, nearest-increment rounding of punches (5 minutes, a tenth of an hour or a quarter hour) or snap-to-schedule within a window, applied at capture or at approval. Rounding must be neutral: nearest-increment rounding rounds both up and down, and snap-to-schedule treats early and late arrivals and departures symmetrically, with early-arrival snapping limited to time the employee was not permitted to work under TIME-006. A rule that only reduces paid time is refused at setup. The captured time is always kept beside the payable time, both visible to the employee and approver, and a period report shows per employee the net minutes rounding added or removed. The [retained punch rounding and snap-to-schedule details](docs/contract/MECHANISMS.md#time-005) define source fields, calculations and revision behavior.

**Acceptance.**
1. Configure quarter-hour nearest rounding at one site and a 7-minute snap-to-schedule window at another; clock in at 8:52, 8:58, 9:04 and 9:09 at each.
2. Approve and read captured and payable times side by side and the period neutrality report, try to save a round-down-only rule (refused) and change the rule effective next week without altering approved history.

#### TIME-006 — Early clock-in window and unscheduled punches

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Owners set per site or role how early an employee may clock in before a scheduled shift and whether unscheduled punches are allowed. A punch before the window is refused with the time it opens, or accepted and flagged for manager approval, as configured; an unscheduled punch is refused, accepted pending approval or allowed for listed roles. Flagged punches keep their captured time and open a TIME-003 exception; approved early time counts as worked. Flagged early and unscheduled punches are recorded as exceptions on their timesheets, which TIME-008 bulk approval skips. Owners set a rule per cafe and may add a position rule that replaces its cafe's rule; with no rule clock-in stays unrestricted. The [retained early clock-in window and unscheduled punches details](docs/contract/MECHANISMS.md#time-006) define source fields, calculations and revision behavior.

**Acceptance.**
1. With a 10-minute window attempt a clock-in 25 minutes early (refused, showing when it opens), switch the site to flag mode and repeat (accepted and flagged), then clock in without a shift (pending approval).
2. Approve the early time and correct the unscheduled punch with a reason; both captured times stay visible and only approved time is payable.
3. Bulk approval (TIME-008) skips the flagged timesheets and names each exception.

#### TIME-007 — Forgotten clock-out reminder cap and provisional close

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Owners set a reminder after scheduled end plus a grace period and a maximum open-punch length per site. A still-open punch gets a forgotten clock-out reminder (shown in Lanyard; its push and SMS delivery is NOTICE-001's), then at the configured point (scheduled end or the cap for unscheduled work) stops accruing and is marked provisionally closed with a TIME-003 exception. A provisional end is never treated as fact: it cannot be approved or exported until the employee or a manager confirms or corrects it, and the original open state is retained. A provisional close is an exception on the timesheet, which TIME-008 bulk approval skips. The [retained forgotten clock-out reminder cap and provisional close details](docs/contract/MECHANISMS.md#time-007) define source fields, calculations and revision behavior.

**Acceptance.**
1. Clock in for a 9-to-5 shift and never clock out; receive the reminder at 5:15 (in the app; push and SMS are NOTICE-001's), see the punch provisionally closed with an open exception at the configured point and an export refused.
2. Correct the end time as the employee, approve as a manager and export; an unscheduled punch left open reaches the 12-hour cap with the same exception.
3. A bulk approval (TIME-008) including the provisionally closed timesheet skips it with the exception named.

#### TIME-008 — Bulk timesheet approval with pinned revisions

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Time approvers filter timesheets by site, role, period and state (clean, exception, edited, unconfirmed) and approve many in one action within their scope. The action pins each included timesheet's exact revision; at commit any item whose revision changed, that gained an exception (missed break, early or unscheduled punch, provisional close, out-of-zone or missing required photo) or that is the approver's own time is skipped, and the result lists approved and skipped items with reasons. Each approval records the same actor, time and revision as a single approval, and nothing outside the approver's sites is touched. The [retained bulk timesheet approval with pinned revisions details](docs/contract/MECHANISMS.md#time-008) define source fields, calculations and revision behavior. Break-exception skipping is also exercised by BREAK-001, and changed-edit skipping by TIME-003.

**Acceptance.**
1. Filter a 60-person week at one cafe to clean timesheets and bulk-approve the listed revisions while another manager decides one included timesheet.
2. The result approves the rest and skips that one, the approver's own timesheet, a foreign-cafe timesheet and hand-entered time pinned outside the filter, each with its reason; audit shows one decision per approved revision and the skipped items are untouched.

#### TIME-009 — Timesheet approval review with schedule variance

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** The approval screen shows per timesheet the scheduled, captured and payable times, variance minutes, breaks taken against required, punch photo and location where enabled, job and site, rounding effect, open exceptions, cost and the employee's running period and overtime totals, with filters for exceptions. Approvers act from the same row: approve, edit with a reason or send back to the employee. The review shows TIME-005 captured and payable time side by side. Owners and managers see the review on every waiting timesheet: the scheduled time is the punch's TIME-006 matched shift (none for unscheduled or hand-entered time); variance is in whole minutes, start and end against the scheduled times (positive is later) and worked minutes against the shift's net minutes; breaks taken are the recorded meal minutes against the greater of the cafe's applicable BREAK-002 deduction and BREAK-001 policy meal minutes, never their sum. The [retained timesheet approval review with schedule variance details](docs/contract/MECHANISMS.md#time-009) define source fields, calculations and revision behavior.

**Acceptance.**
1. Open a week where one employee arrived early, one missed a meal and one clocked out of zone (until CLOCK-003 ships, off the cafe's CLOCK-007 networks).
2. Each row shows the right variance, break, photo (CLOCK-005), location and cost; filtering to exceptions lists exactly those three, and an edit with a reason keeps the captured facts.
3. The review shows each punch's TIME-005 captured and payable time.

#### POLICY-001 — US overtime meal and rest policy rules

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-006, BASE-MAIL-001

**Requirement.** Employers configure effective-dated FLSA workweeks and maintained overtime, double-time and consecutive-day rules for federal FLSA, California, Alaska, Nevada and Colorado. Cross-job/site actuals classify with retained rule and rate inputs; weighted-rate estimates remain distinct from provider-authoritative wages. Unknown applicability withholds amounts, exemptions are never inferred from salary/title/role, and a reviewed version change cannot rewrite closed payroll. POLICY-003 carries meals/rests and POLICY-004 alternate schedules. Calculation and applicability details remain in the [policy rules](docs/contract/MECHANISMS.md#policy-001).

**Acceptance.**
1. Run the federal 42-hour week; California 10- and 13-hour days and seventh day; Alaska 9-hour day; Nevada 9-hour days above/below its wage threshold; and Colorado 13-hour and consecutive-hours cases across jobs and sites.
2. Each raises its pre-publish warning and the expected actual classification traced to the preset version, worked across two sites where it applies.
3. An unlisted city shows the unmaintained label, and a new preset version requires reviewed recalculation of open periods.
4. The employee's EARN-001 estimate uses the preset's daily and weekly overtime.

#### POLICY-003 — Maintained meal rest and weekly-rest rules

*Tier:* Core · *From:* POLICY-001 · *Cites:* BASE-MAIL-001

**Requirement.** Maintained meal/rest and weekly-rest rules cover California, Nevada, Colorado, Oregon, Washington, New York and Illinois. Timed evidence distinguishes missing, short and late meals and paid rests; untimed totals cannot establish timing. California meal/rest premiums remain separate from overtime; unknown workday boundaries and applicability remain unresolved. The Illinois day-of-rest rule uses adjacent-week context. Employer minimum-rest rules remain explicitly unmaintained. The [policy calculations](docs/contract/MECHANISMS.md#policy-001) retain normal-workday, split-service and consecutive-work details.

**Acceptance.**
1. Run California late/second meals, Oregon and Washington missed meals/rests, Washington evidenced normal-workday additional meals, New York late meals, and Illinois meal and seventh-workday cases; inspect warnings and retained actual classifications.
2. Apply the California preset to a site and see BREAK-002's automatic meal deduction refused there.
3. Apply a SCHEDULE-002 template that breaks a state rule and see the policy warning before publishing.
4. A COVER-001 swap that breaks a minimum-rest rule is refused.

#### POLICY-004 — Reviewed alternative workweek evidence

*Tier:* Core · *From:* POLICY-001

**Requirement.** Supported California Wage Order 5 elections, Alaska approved flexible plans and Nevada mutual four-day schedules require explicit employee participation and retained evidence. Employer-reviewed applicability distinguishes federal/state weekly, daily, consecutive, seventh-day, meal and rest duties. A supported choice changes only current eligible calculations after exact source-bound review; unsupported deviations remain unresolved, and historical releases stay reproducible.

**Acceptance.**
1. Review and adopt each supported alternative schedule with employee participation and current source evidence, inspect its across-cafe calculations and refuse missing, changed or unsupported evidence.
2. Change applicability or the employer workday through a reviewed preview, retain prior rules and closed payroll, and withhold estimates for unknown obligations rather than certifying them.

#### POLICY-002 — Predictive scheduling and fair-workweek changes

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Maintained fair-workweek presets cover New York City fast food/retail, Chicago, Philadelphia, Seattle, San Francisco, Los Angeles retail, Oregon, Evanston, Berkeley, Emeryville and San Jose. Effective industry/size coverage determines advance notice, good-faith estimates, employee consent, change/cancellation premiums, rest, access to hours and records. Unlisted ordinances are labelled employer-configured and unmaintained. RL-3 permits owner-only preparation with exact source/version/reason records; a consequence preview confers no consent, exception, publication or payroll authority. Complete site delegation remains TEAM-001/ACCESS-003. Posting evidence uses SCHEDULE-005 and access-to-hours evidence COVER-004.

**Acceptance.**
1. Run one scenario per maintained preset: publish a week for a covered employer, then add, change or cancel a shift inside that preset's notice window, schedule a short rest between a closing and an opening shift where the preset limits it and offer added hours where it requires access to hours.
2. Each produces the preset's consent request, premium input and record; an employer below the preset's threshold at the same location produces none; an unapproved exception is refused; approved premium inputs reach payroll; an unlisted city shows the unmaintained label.
3. Inspect the SCHEDULE-005 posting record of the posted week.
4. Review each consequence under a delegated permitted-site grant; private wages require their separate permission. Retain the employee's exact response, refuse stale/unauthorized or unapproved exceptions without changes, enforce the changed schedule and reconcile approved premiums into payroll.

#### PAYRULE-001 — Shift differentials

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Payroll administrators define effective-dated differentials by time of day, day of week, site, role or shift tag, as a USD amount per hour or a multiplier, with a stacking order. Approved hours split into differential segments, each with its pay code (PAY-001) and cost (COST-001); overtime classification follows the provider-confirmed regular-rate treatment. Differentials appear in the employee's EARN-001 estimate. Differentials subdivide SCHEDULE-007's reconciled work areas: they apply within each area's payable minutes approved from its pinned area plan (each minute once), price from that area's retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area, per-code difference, once, under the enclosing timesheet's single payroll claim. The [retained shift differentials details](docs/contract/MECHANISMS.md#payrule-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Configure a $1.50-per-hour night differential after 10 PM and a weekend multiplier; work an overnight Saturday shift crossing midnight.
2. Read the split segments, codes and cost, change the rate effective next week without altering approved history and export the period with differential lines mapped.
3. The employee's EARN-001 estimate includes the differential.
4. On a SCHEDULE-007 counter/kitchen split shift crossing 10 PM, differential lines stay within each area's pinned payable minutes at its retained job rate, and a later correction exports only the signed per-area difference under the timesheet's one claim.

#### PAYRULE-002 — Holiday calendar and holiday premiums

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Owners keep a company holiday calendar seeded with US federal holidays and editable per site, and set holiday rules: a multiplier or added rate for hours worked on a holiday, holiday pay for eligible employees who do not work, and eligibility such as working the scheduled shifts before and after. Scheduling shows holiday cost and approved holiday hours carry their own pay codes. Holiday premiums appear in the employee's EARN-001 estimate. Holiday premiums keep SCHEDULE-007's work-area reconciliation: on a segmented timesheet they apply within each area's payable minutes approved from its pinned area plan (each minute once) at that area's retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area, per-code difference, once, under the enclosing timesheet's single payroll claim. The [retained holiday calendar and holiday premiums details](docs/contract/MECHANISMS.md#payrule-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Seed the federal calendar, add a company holiday at one site, schedule and work Thanksgiving and the company holiday, then approve.
2. Holiday premium lines appear with codes and cost, an employee who misses the shift after the holiday is shown ineligible under the rule and the other site has no company holiday.
3. The employee's EARN-001 estimate includes the holiday premium.
4. A worked holiday shift split between counter and kitchen (SCHEDULE-004) carries its premium lines per area within the pinned payable minutes at each area's retained job rate, and a later correction exports only the signed per-area difference under the timesheet's one claim.

#### PAYRULE-003 — Reporting-time call-in split-shift and spread-of-hours premiums

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Jurisdiction presets and employer rules produce premium-pay inputs when an employee reports for a shift that is canceled or cut short (California reporting-time pay, New York call-in pay), works a split shift (California) or exceeds a 10-hour spread of hours (New York), each with the triggering facts, rule version and pay code. Premiums are reviewed payroll inputs, not final pay calculations. These premiums appear in the employee's EARN-001 estimate. Premium inputs keep SCHEDULE-007's work-area reconciliation: on a segmented timesheet they read the per-area payable minutes approved from its pinned area plan and each area's retained effective-dated job-rate basis without re-splitting, repricing or counting a minute twice, and a later correction exports only the signed difference per job, area and code, once, under the enclosing timesheet's single payroll claim. The [retained reporting-time call-in split-shift and spread-of-hours premiums details](docs/contract/MECHANISMS.md#payrule-003) define source fields, calculations and revision behavior.

**Acceptance.**
1. At a California site send an employee home an hour into a scheduled 8-hour shift and schedule a split shift; at a New York site work a 7 AM to 6 PM day with a long unpaid break and cancel a shift after arrival.
2. Each premium input appears with its fact trace and code, a manager disputes one with a reason and approved inputs export in the period.
3. The employee's EARN-001 estimate includes the premium.
4. On a SCHEDULE-007 counter/kitchen split day the premium input's fact trace shows the pinned per-area minutes and retained job rates with no minute counted twice, and a later correction exports only its signed difference under the timesheet's one claim.

#### COST-001 — Scheduled versus actual labor cost and budgets

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Managers plan USD labor budgets by site/job/day/week and compare scheduled versus worked hours, wages, overtime, tips/premiums and configured employer burdens. Variance reports distinguish estimated, approved and provider-reconciled cost; rate-effective dates, cross-site hours and forecast sales from POS connectors or SALES-001 entry are visible. When worked cost exists, SALES-001's labor percentage and sales per labor hour and DASH-001's entered-sales line use it. Budget warnings precede publishing and overruns trigger accountable follow-up without hiding required paid time. Budget warnings also appear when a SCHEDULE-002 template, copy or recurring shift is applied.

**Acceptance.**
1. Build and work a multi-role week with rate changes, overtime and a call-out; inspect budget warnings and scheduled/actual cost by site.
2. Correct time and reconcile the variance to approved hours and provider-applied payroll without counting an unworked shift.
3. Apply a SCHEDULE-002 template that takes the week over budget and see the warning before publishing.

#### COST-002 — In-week overtime risk alerts from actual hours

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-006, BASE-MAIL-001

**Requirement.** As punches accrue, Lanyard projects each employee's workweek and daily totals, including remaining scheduled shifts at all sites, against POLICY-001 thresholds and alerts the scheduler and the employee's manager when overtime is projected, with the USD premium estimate and qualified non-overtime substitutes for the remaining shifts. Swaps and pickups that would create overtime show it before approval. A workweek follows PAY-009's group definition, Monday to Sunday by venue date for unassigned people. The projection as of an instant is the person's recorded time in the week that started before it (submitted, approved or sent-back timesheets, a pending correction replacing its source, and open punches counted up to the instant) plus their published shifts in the week, at every cafe, that start at or after it and have no punch yet; daily totals are the same minutes by venue date. The [retained in-week overtime risk alerts from actual hours details](docs/contract/MECHANISMS.md#cost-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Schedule an employee for 38 hours and let them clock 3 extra hours by Thursday.
2. The scheduler receives an alert projecting 41 hours with the estimated premium and a substitute list, a pickup that adds overtime shows its cost before approval and approving a substitute clears the alert.

#### ACA-001 — ACA hours measurement for variable-hour employees

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001

**Requirement.** For employers at or near Applicable Large Employer size, Lanyard tracks hours of service (worked and paid leave) per employee against the Affordable Care Act 130-hours-per-month full-time test, supports the look-back measurement method (standard measurement, administrative and stability periods) for variable-hour employees and warns schedulers when planned hours would make one full-time for the period. Hours and status export to the payroll provider or Willow for 1094-C and 1095-C filing, which Lanyard does not file. The owner acts as payroll administrator until TEAM-001 and ACCESS-003 provide that role; managers read reports and scheduler warnings only for employees of their home cafe. The [retained aca hours measurement for variable-hour employees details](docs/contract/MECHANISMS.md#aca-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Configure a 12-month measurement period, load a year of approved hours for three variable-hour employees with one averaging over 30 hours a week, inspect the computed status for the stability period and the warning for another trending towards 30, and export the hours file for the filer.
2. Also reconcile paid non-work credits and an overnight month boundary, retain a corrected source once, show unresolved time separately, replace rather than double-count a draft week, refuse staff and reduced preparation-grant reads and other-cafe manager rows, and repeat configuration, inspection and download at 1440 and 390.

#### TIPS-001 — Tips pooling and reviewed payroll allocation

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Managers import cash/card tip inputs from POS or employee declaration, configure employer-reviewed US pool eligibility, contribution/distribution and job/hour rules, and allocate by actual approved work. Staff review distributions and discrepancies; managers approve the exact pool revision. Excluded roles, rounding, corrections, tip-credit inputs and provider pay-code mapping remain traceable and never imply Lanyard moved money. Approved tips appear as their own line in the employee's EARN-001 earnings view and estimate. CLOCK-006's clock-out cash-tip declarations are its employee-declaration input. Its approved allocations join those declarations as the week's tips in TIPS-002's make-up check.

**Acceptance.**
1. Import Square/Toast/Clover tip inputs, allocate a service pool across eligible worked roles, reject an excluded participant and reconcile totals/rounding.
2. Approve a correction and transfer mapped tip lines to payroll with provider readback and employee-visible history.
3. The employee's EARN-001 earnings view shows the approved tip line in the estimate.
4. A CLOCK-006 clock-out cash-tip declaration reaches the tip pool draft.
5. An approved allocation counts in that week's TIPS-002 make-up check.

#### TIPS-002 — Tip credit and minimum-wage make-up checks

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** For employees paid a tipped cash wage, Lanyard checks each workweek, under the site's jurisdiction, that cash wage plus allocated or declared tips meets the applicable minimum wage and raises any shortfall as a make-up pay input. It records time on duties that do not produce tips so the employer can apply its reviewed dual-jobs treatment. Sites in jurisdictions that bar a tip credit (California, Washington, Oregon, Nevada, Minnesota, Alaska and Montana) refuse a tip-credit setup. The owner, acting as payroll administrator until TEAM-001/ACCESS-003, records each cafe's tip-credit setup from an inclusive venue date: its US state or DC, the minimum wage that applies at the cafe in USD per hour and the jobs whose work produces tips. The [retained tip credit and minimum-wage make-up checks details](docs/contract/MECHANISMS.md#tips-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Pay a server a tipped cash wage, allocate low tips one week and normal tips the next; the first week shows a make-up input and the second none.
2. Record side work on a non-tipped duty and see it reported, and try to enable a tip credit at a California site (refused).
3. Until TIPS-001 ships, the weeks' tips are CLOCK-006 cash-tip declarations; a later minimum wage checks only the weeks from its date, the six other barring states are refused too, another cafe's manager reads no row, staff are refused and the make-up pay inputs download as a recorded CSV.

#### REPORT-001 — Operational reports exports and scheduled delivery

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001

**Requirement.** Authorized managers filter and export schedules, attendance/late/no-show, breaks/exceptions, PTO, worked hours, overtime, labor cost versus budget/sales, tip allocations and payroll reconciliation by site/job/person/period. Reports reconcile totals and source revisions, distinguish missing data, and support scheduled email delivery with role-scoped access and revocable download links.

**Acceptance.**
1. Run a pay-period report over two locations, reconcile row totals to approved time/POS/payroll, export CSV and schedule a recipient-scoped digest.
2. Verify a site manager cannot retrieve another site's wages and an unresolved offline punch remains visible as incomplete.

#### REPORT-002 — Compliance and audit record reports

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001

**Requirement.** Owners produce jurisdiction-scoped reports for audits: schedule postings and changes with notice given, consent and predictability-pay records (POLICY-002), meal and rest compliance and premiums (BREAK-001, POLICY-003), minor-hour checks (MINOR-001), sick leave accrual and use (LEAVE-003), rounding neutrality (TIME-005), tip-credit make-up (TIPS-002) and punch edits with reasons. Each traces to source revisions and is retained for the period its preset requires. Under RL-1, The live native owner may preserve the exact reviewed report with an explicit reason and affirmative owner authorization, retaining its original JSON, CSV, source revisions, integrity digests and authorization through later corrections, restart and supported installation archive restore. The [retained compliance and audit record reports details](docs/contract/MECHANISMS.md#report-002) define source fields, calculations and revision behavior. Delegated audit authority belongs to TEAM-003 and ACCESS-003; retention, employee requests and disposition belong to PRIVACY-001, PRIVACY-002 and PRIVACY-003.

**Acceptance.**
1. Run a quarter at a Chicago and a California site with schedule changes, premiums, missed meals, a minor and edited punches.
2. Produce each report for an auditor-scoped reader, reconcile counts to the source records and confirm unrelated wage and personal data are excluded.
3. Preserve an owner-authorized exact report and verify original JSON, CSV, source revisions, digests and authorization after correction, restart and supported archive restore.

#### REPORT-003 — Sales per labor hour and labor percentage by interval

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001

**Requirement.** Managers see labor cost as a percentage of sales and sales per labor hour by site, role and 15-, 30- or 60-minute interval for scheduled, forecast and actual hours, using POS or SALES-001 data (SALES-001 already shows them per day and over the days entered, on scheduled hours), with targets per daypart and flags where actual labor percentage exceeds target. Forecast hours arrive with DEMAND-001, which adds them to this report; until then it covers scheduled and actual hours. The owner reads any cafe and, until TEAM-001, a manager their home cafe; staff and agent keys never read it. A report is one cafe and venue day in 15-, 30- or 60-minute intervals on the venue clock. The [retained sales per labor hour and labor percentage by interval details](docs/contract/MECHANISMS.md#report-003) define source fields, calculations and revision behavior.

**Acceptance.**
1. With a day of hourly sales and scheduled and actual hours at two sites, compare sales per labor hour and labor percentage by interval with hand-calculated values, set a dinner target and see the exceeded intervals; missing sales hours show as incomplete, never zero.

#### DASH-001 — Manager daily operations dashboard

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001

**Requirement.** A site or multi-site manager opens one dashboard for today and this week: who is on now and late (CLOCK-004), open and unconfirmed shifts, pending approvals (time, leave, swaps, availability), overtime risk (COST-002), labor percentage against sales and budget, unresolved exceptions and the payroll cutoff countdown, each linking to its record and scoped to their sites. The [retained manager daily operations dashboard details](docs/contract/MECHANISMS.md#dash-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Seed a live day with a late arrival, an open shift, three pending approvals, an overtime risk and a missed punch.
2. The dashboard shows each with correct counts and links, a second-site manager sees only their site and resolving an item clears it.

#### EARN-001 — Employee hours and estimated earnings

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Employees see their own scheduled and worked hours this period, overtime and premiums so far, approved tips and an estimated gross pay labeled as an estimate before taxes and deductions, with the pay period and pay date. Employers can turn the estimate off; it never shows coworkers' data, and the payroll provider's pay statement stays authoritative. The period and pay date follow PAY-009 when assigned to a pay group; unassigned people keep the workweek, Monday to Sunday on the venue calendar, with a record counting in the week of its venue start date; scheduled hours are the person's published shifts less their meal minutes; approved TIME-005 payable minutes use complete POLICY-001 workweek classifications, including daily overtime and double time. The [retained employee hours and estimated earnings details](docs/contract/MECHANISMS.md#earn-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. As an employee with regular and overtime lines mid-period open the earnings view and reconcile hours and estimate to approved records, with a coworker's approved time absent.
2. An unapproved punch shows as pending, turning estimates off hides the amount and the view links to the provider pay statement.

### Connected payroll sales HR and automation

#### PAY-001 — Payroll-ready classified hours and pay codes

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Payroll administrators map employee, employment type, job, location, PTO, sick leave, holiday, regular, overtime and double time, differentials, break premiums, scheduling premiums and tip codes before transfer. Approved hours and signed corrections carry effective policy and rate references and reconcile by period and employee. W-2 employees and supported 1099 contractor workflows are explicit; contractor exports cannot silently apply employee overtime or tax treatment. Providers without a live connector receive the same classified lines through PAY-002 templates and the named presets PAY-003 to PAY-008. Classification keeps SCHEDULE-007's work-area reconciliation and CLOCK-008's job segments: a segmented timesheet's classified lines carry the per-area payable minutes approved from its pinned area plan (each minute once, together equal to the enclosing timesheet's payable minutes) and each area's retained effective-dated job-rate basis, and a later correction exports only the signed per-job, per-area difference, once, under the enclosing timesheet's single payroll claim. The [retained payroll-ready classified hours and pay codes details](docs/contract/MECHANISMS.md#pay-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Prepare a period with regular, overtime, PTO and tip lines and a late negative adjustment, resolve an unmapped pay code and review totals by W-2 and 1099 workflow.
2. Export or transfer the exact approved revision and reconcile all classified minutes and amounts.
3. Classify a SCHEDULE-007 counter and kitchen split shift: its lines keep each area's pinned payable minutes and retained job rate and sum once to the enclosing timesheet, and a later correction exports only the signed per-area difference under that timesheet's one claim.
4. Classify a CLOCK-008 counter-to-kitchen punch: each job segment's lines keep its own job, cafe, minutes and retained rate.
5. A TIPS-002 make-up pay input exports under its own pay code.

#### PAY-002 — Configurable payroll export templates

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Payroll administrators build export templates for any provider without a live connector: file type (CSV, TSV, other delimiter or XLSX; provider-specific formats such as QuickBooks Desktop IIF come as maintained presets, PAY-011), header row and column names, column order, date, time and number formats, grouping (one row per employee per pay code, or per day, job or location) and the mapping of every Lanyard pay code (regular, overtime, double time, PTO, sick, holiday, differentials, premiums, tips) and employee, job and location identifier to the provider's codes. A preview shows the exact file; an unmapped code or employee blocks export; exports keep PAYROLL-001 once-only claims, signed corrections and hashes. The [retained configurable payroll export templates details](docs/contract/MECHANISMS.md#pay-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. Create a template grouped by employee and earning code with custom headers, export a period containing regular, overtime, double-time, PTO and tip lines plus a negative correction and match every row to approved classified hours.
2. Remove one mapping and see export refused; download the exported file twice and receive identical bytes.
3. A template export keeps captured times and pays TIME-005 payable minutes.

#### PAY-003 — Paylocity import preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-4

**Requirement.** A maintained PAY-002 preset writes Paylocity's documented time and earnings import layout, with company code, employee ID, earning-code and cost-center mapping. It cites the Paylocity document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only, not a live connection. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime, PTO and tip lines through the preset and validate the file against Paylocity's published import layout and sample (columns, codes, dates, decimals); import it into a Paylocity company and reconcile the totals.

#### PAY-004 — Paycor import preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-5

**Requirement.** A maintained PAY-002 preset writes Paycor's documented hours import file with employee number, earning-code and department mapping. It cites the Paycor document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime, PTO and tip lines through the preset, validate it against Paycor's published import specification and sample, import it into a Paycor account and reconcile the totals.

#### PAY-005 — Rippling import preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-6

**Requirement.** A maintained PAY-002 preset writes Rippling's documented hours or earnings import file with employee identifier and earning-type mapping. It cites the Rippling document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime, PTO and tip lines through the preset, validate it against Rippling's published import template, import it into a Rippling company and reconcile the totals.

#### PAY-006 — Heartland Payroll import preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-7

**Requirement.** A maintained PAY-002 preset writes Heartland Payroll's documented time import file with employee ID and earning-code mapping. It cites the Heartland document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime, PTO and tip lines through the preset, validate it against Heartland's published import specification, import it into a Heartland account and reconcile the totals.

#### PAY-007 — Square Payroll hours preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-8

**Requirement.** A maintained PAY-002 preset produces the hours and earnings data Square Payroll accepts through its documented import or timecard path, with team-member and earning-type mapping. Where Square documents only manual entry, the preset produces a per-employee earnings summary in Square's entry order and says so. It is labeled export-only. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime and tip lines through the preset, validate it against Square Payroll's published import or entry fields, enter or import it into a Square Payroll account and reconcile the totals.

#### PAY-008 — Toast Payroll hours preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-9

**Requirement.** A maintained PAY-002 preset produces the hours, tips and earnings data Toast Payroll accepts through its documented import path, with employee and earning-code mapping, and avoids double-counting hours already captured by Toast time clocks under POS-002. Where Toast documents only manual entry, the preset produces a per-employee earnings summary in Toast's entry order and says so. It is labeled export-only. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime and tip lines through the preset, validate it against Toast Payroll's published import or entry fields, load it into a Toast Payroll account and reconcile the totals without duplicating Toast-clocked hours.

#### PAY-009 — Pay schedules and workweeks that cross pay periods

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2

**Requirement.** Payroll administrators define weekly, biweekly, semimonthly or monthly pay schedules per pay group, with pay dates, separately from the FLSA workweek. When a workweek crosses a semimonthly or monthly period boundary, overtime is computed on the whole workweek, and overtime that becomes known only after the earlier period closes carries into the next period as a labeled adjustment. Pay schedules replace EARN-001's workweek period and owner-set pay date. The owner acts as payroll administrator until TEAM-001/ACCESS-003 supply that role. Each saved group retains its employees, first period date, cadence, pay-date offset (0–31 calendar days after the inclusive period end) and workweek starting weekday, on the venue calendar. The [retained pay schedules and workweeks that cross pay periods details](docs/contract/MECHANISMS.md#pay-009) define source fields, calculations and revision behavior.

**Acceptance.**
1. Set a semimonthly schedule with a Sunday workweek, work a 45-hour week that straddles the 15th, lock the first period and close the week.
2. The overtime appears as a traced adjustment in the second period, and a biweekly group is unaffected.
3. The employee's EARN-001 view shows the pay period and pay date from the pay schedule.

#### PAY-010 — Paychex Flex payroll import file preset

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-10

**Requirement.** Alongside the PAYCHEX-001 live connection, a maintained PAY-002 preset writes the time and earnings import file Paychex Flex documents for third-party time systems, with client ID, employee ID, earning-code, rate override and labor-assignment (branch/department) mapping. It cites the Paychex document and version it follows, refuses export rather than guessing a missing mapping and is labeled export-only, never live. Paychex customers on products other than Paychex Flex (for example SurePayroll) use PAY-002 templates. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime, PTO and tip lines plus a negative correction through the preset, validate it against Paychex Flex's published import layout, import it into a Paychex Flex company and reconcile the totals; an unmapped earning code blocks the export.

#### PAY-011 — QuickBooks Desktop Payroll IIF time export

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001 · *Rules:* D-1, D-2 · *Register:* R-11

**Requirement.** QuickBooks Desktop Payroll Enhanced and Assisted customers get a maintained export-only preset that writes an IIF time-activity file with the provider's documented activity fields for import into QuickBooks Desktop's timesheets, with employee name, payroll-item, class and job mapping. It is not a live connector, it is labeled export-only, and it keeps PAYROLL-001 once-only claims and hashes. Desktop is served by this file path only; QB-001 is the live QuickBooks Online Payroll path. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Export a period with regular, overtime and PTO lines through the preset, import the IIF into a QuickBooks Desktop Payroll Enhanced company file, see the hours on each employee's weekly timesheet with the mapped payroll items and reconcile the totals; an unmapped payroll item blocks the export.

#### SYNC-001 — Approved transfer and provider-applied reconciliation

*Tier:* Core · *Register:* R-12

**Requirement.** A payroll administrator authorizes the exact reviewed provider submission. Durable idempotency keys and source/period fences prevent duplicate sends; transport queued/sent, provider accepted/rejected/partial, applied-to-payroll and paid states remain separate. Readback reconciles employee/pay-code totals, preserves unknown outcomes for investigation and supports reviewed corrections and off-cycle adjustments. Provider acceptance alone never means wages paid. Provider readback confirms the run a TIME-004 pay period was closed with; until then the close records the owner's reference only. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Connect a payroll account, submit approved hours, inspect acceptance and application readback, then induce partial rejection and a lost response.
2. Resume without duplicate hours, resolve employee/pay-code discrepancies and carry a locked-period correction as a reviewed adjustment.

#### GUSTO-001 — Live Gusto payroll connection

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-13

**Requirement.** Connect a US Gusto company through approved production authorization, map employees/jobs/PTO/pay codes and transfer approved classified hours under SYNC-001. Gusto employees, new hires, terminations, compensations and PTO balances are read under PAYSYNC-001 to PAYSYNC-004 so Gusto can be the employee master. Provider permissions, supported employee/contractor paths and time-data versus payroll-application states are explicit; reauthorization and disconnect preserve source history without sending more work. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Authorize a real Gusto company, preview mappings and approved hours, submit with payroll-admin approval and reconcile provider-accepted/applied totals.
2. Correct one employee, handle a revoked grant and demonstrate no duplicate submission after reconnect.
3. In the same company hire, re-rate and terminate one employee and accrue PTO, and see PAYSYNC-002 to PAYSYNC-004 apply.

#### ADP-001 — Distinct ADP RUN and Workforce Now connectors

*Tier:* Core · *Register:* R-14

**Requirement.** US buyers connect ADP RUN or ADP Workforce Now using each product's supported production app/partner authorization. Separate capability matrices map employees, jobs, regular/overtime/PTO/tips and periods; approved transfers and readback follow SYNC-001, and each product's workers, new hires, terminations, pay rates and leave balances are read under PAYSYNC-001 to PAYSYNC-004. A connection to one product is never represented as support for the other. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. For each named ADP product authorize a supported company, review employee/pay-code mapping, submit a period and reconcile accepted/applied totals including one rejection and later correction.
2. Verify disconnect stops future sends and preserves the exact submission history.
3. In each product hire, re-rate and terminate one worker and accrue PTO, and see PAYSYNC-002 to PAYSYNC-004 apply.

#### PAYCHEX-001 — Live Paychex Flex payroll connection

*Tier:* Core · *Cites:* BASE-DATA-001 · *Register:* R-15

**Requirement.** The live Paychex connection is Paychex Flex (Essentials, Select, Pro and Enterprise plans) through Paychex's production developer API and partner program. Lanyard maps workers, earning codes and labor assignments, sends approved period hours, tips and adjustments to the Flex payroll with readback under SYNC-001, and reads workers, new hires, terminations, rates and leave balances under PAYSYNC-001 to PAYSYNC-004 so Flex can be the worker-record master. The PAY-010 Paychex Flex import file is labeled export-only and cannot satisfy this live promise; other Paychex products use PAY-002 templates; required provider agreements are delivery work. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. In a Paychex Flex company, map workers and earning codes, send a reviewed period and reconcile accepted/applied totals, then resolve a rejected tip/earning code and a closed-period adjustment without replaying paid hours.
2. In the same Flex company hire, re-rate and terminate one worker and accrue PTO, and see PAYSYNC-002 to PAYSYNC-004 apply.

#### QB-001 — QuickBooks Online Payroll live time connection

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Register:* R-16

**Requirement.** The live QuickBooks path is QuickBooks Online Payroll Core, Premium and Elite attached to a US QuickBooks Online Simple Start, Essentials, Plus or Advanced company. Lanyard writes approved hours as employee time activities with the mapped payroll item, customer/job and class, so they appear in the QuickBooks Online Payroll run, and reads back what the run used under SYNC-001. A QuickBooks Online company without a Payroll subscription receives time only for job costing and is labeled "not payroll application"; a missing Payroll subscription or permission is shown before any send. Employees, rates, jobs and leave balances are read under PAYSYNC-001 to PAYSYNC-004. QuickBooks Desktop Payroll is not a live connection: Desktop Payroll Enhanced and Assisted customers use the PAY-011 IIF export. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. In QuickBooks Online companies covering each Payroll tier (Core, Premium and Elite) and each QuickBooks Online plan (Simple Start, Essentials, Plus and Advanced), map jobs and regular/overtime/PTO/tip payroll items, transfer a reviewed period and reconcile the pay-run totals.
2. Connect a QuickBooks Online company without Payroll and see the edition label and refused payroll send, apply an approved correction, and in one Payroll company hire, re-rate and terminate an employee and accrue PTO to see PAYSYNC-002 to PAYSYNC-004 apply.

#### PAYSYNC-001 — Payroll-provider field authority

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** For each connected payroll provider (Gusto, ADP RUN, ADP Workforce Now, Paychex Flex, QuickBooks Online Payroll) the buyer chooses, per field group, which system is authoritative: employee lifecycle (hire, rehire, termination and their effective dates), legal and preferred name and contact details, emergency contacts, pay rate and job (wage type, hourly or salaried rate, job title and default site/department), and leave balances per leave type. Each field group has exactly one authority across Lanyard, the payroll provider and an HR-001 source; choosing a second authority for the same field is refused. Changes from the authority arrive by provider webhook where offered and otherwise by a scheduled poll, with last-sync time, freshness and per-record errors shown. The [retained payroll-provider field authority details](docs/contract/MECHANISMS.md#paysync-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. In each named provider account (PAYSYNC-002 to PAYSYNC-004 name the steps) set lifecycle, pay rate and leave balances to the provider and name/contact to Lanyard.
2. Attempt to also make BambooHR the lifecycle authority (refused); edit a provider-owned wage in Lanyard (refused, or queued as a change request when enabled); edit a Lanyard-owned phone number and see it written back where the provider accepts it.
3. Stop the provider feed and see the people page show the stale sync time.

#### PAYSYNC-002 — Payroll new-hire matching invitation and termination

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-ACCESSIBILITY-001

**Requirement.** When the payroll provider owns the lifecycle, Lanyard reads its employees and new hires and matches each one to a Lanyard person in a fixed order: provider employee ID equal to the stored payroll identifier (PEOPLE-001), then verified email, then mobile number. A name-only match is proposed for review and never linked automatically, and ambiguous or conflicting matches wait in a review queue. An unmatched new hire is created inactive and uninvited until a manager approves it with site and job, unless the buyer turns on the stated auto-invite rule: invite by email or text (PEOPLE-003) once the hire's start date is within a set number of days and their site and job are mapped. The [retained payroll new-hire matching invitation and termination details](docs/contract/MECHANISMS.md#paysync-002) define source fields, calculations and revision behavior.

**Acceptance.**
1. For each named provider (a Gusto company, an ADP RUN company, an ADP Workforce Now company, a Paychex Flex company and a QuickBooks Online Payroll company), hire one employee in the provider and see them matched by payroll ID or created uninvited, then approve and invite them; repeat with auto-invite on.
2. Add a second hire whose name alone matches an existing person and see it held for review.
3. Terminate a scheduled employee in the provider with a future effective date and see access revoked on that date, their later shifts flagged and offered for coverage and their history intact; rehire them and see the same person reactivated.

#### PAYSYNC-003 — Payroll pay-rate and job sync into labor cost

*Tier:* Core · *Cites:* BASE-DATA-001

**Requirement.** When the payroll provider owns pay rate and job, its effective-dated changes (hourly rate, salary, additional job rates and default job and department) land in PEOPLE-002's compensation history with the provider as source. COST-001 scheduled and actual cost and COST-002 overtime alerts recalculate from the effective date. Hours already approved or exported for a period that the change reaches keep their original rate snapshot, and Lanyard raises a reviewed rate adjustment for the payroll administrator instead of silently rewriting them. A provider job or rate with no Lanyard mapping is flagged and blocks scheduling cost for that person until mapped.

**Acceptance.**
1. In each named provider account raise one employee's rate with an effective date inside the current week and see scheduled and actual cost in COST-001 change from that date only.
2. Backdate a second raise into an approved period and see a reviewed adjustment proposed while the exported file and its hash stay unchanged; add an unmapped job in the provider and see it flagged.

#### PAYSYNC-004 — Payroll-held leave balances

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** When the payroll provider owns leave balances, Lanyard reads each employee's balance per leave type with its as-of time and shows it to the employee and managers as the balance of record, alongside Lanyard's approved but not yet transferred leave as a pending deduction. Approved leave hours flow to the provider in the next SYNC-001 transfer under the mapped leave pay code, and after readback the Lanyard balance equals the provider's. Lanyard does not accrue that leave type itself; a Lanyard balance edit is refused, and a difference between the provider balance and Lanyard's expectation is shown for review. Where Lanyard owns the balance (LEAVE-001, LEAVE-003) it writes the balance to providers that accept it.

**Acceptance.**
1. In each named provider account accrue PTO for an employee through a pay run and see the Lanyard balance match the provider's with its as-of time.
2. Request and approve partial-day leave in Lanyard, see it as pending, transfer the period and see the balance equal the provider's after readback.
3. Attempt a Lanyard balance edit (refused) and change the balance in the provider to see a discrepancy raised.

#### POS-001 — Square sales staff and tip inputs

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-17

**Requirement.** Authorize Square POS accounts/locations and reconcile sales, refunds, staff/job identifiers and available tip inputs into location-local demand and labor-to-sales reports. Incremental cursors, deduplication, backfill and freshness labels prevent duplicate or stale sales. Payment capture/refunds remain in Square; importing sales cannot approve hours or tip pools. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Connect two Square locations, backfill and incrementally sync sales/refunds/tips, map staff and compare labor-to-net-sales.
2. Replay events and disconnect one location; totals remain stable and that location is visibly stale.

#### POS-002 — Toast restaurant sales and labor connection

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-18

**Requirement.** Connect supported Toast restaurants through Toast production/Partner Connect permissions and required connector subscriptions or fees. Reconcile per-location sales, refunds, jobs, available tips and time inputs with clear source ownership; duplicate Toast clock data cannot double-count Lanyard punches. Demand and cost reports retain freshness and source provenance. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Complete provider sandbox or official-schema fake  for two restaurants, map jobs and source clocks, backfill sales/tips and compare a service's labor report.
2. Deny an unapproved restaurant and replay a source event without duplicating sales or time.

#### POS-003 — Clover sales terminals and employee mapping

*Tier:* Core · *Register:* R-19

**Requirement.** Connect Clover merchant/location data for sales/refunds, employee identifiers, available clock/tip inputs and labor-to-sales analysis, with an explicit authority choice when Clover terminals supply punches. Approvals and corrections stay in Lanyard's time workflow; POS event retries cannot create duplicate work. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Authorize a Clover merchant, map employees and terminal punches, sync sales/tips and reconcile a shift.
2. Retry events, change an employee mapping and inspect rejected conflicts and freshness before payroll approval.

#### POS-004 — Shopify POS and Lightspeed sales adapters

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-20

**Requirement.** Buyers connect Shopify POS and supported Lightspeed Restaurant K series locations for staff/sales inputs used in demand and labor reporting. Each adapter documents available data, permissions, plan requirements, location mapping, incremental/backfill behavior and provider limitations without presenting one Lightspeed product as all editions. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. For each supported service authorize a provider sandbox or official-schema fake , import sales/refunds and staff mappings, reconcile labor-to-sales for a service period, then replay events and revoke permissions to inspect stable totals and actionable stale state.

#### SALES-001 — Manual and CSV sales and metric entry

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001

**Requirement.** Businesses whose POS has no connector enter daily or hourly sales, transactions, covers or other workload metrics per site, manually or by CSV upload with a reviewed preview, mapping and duplicate detection. Entered data is labeled manual, keeps edit history and feeds COST-001, REPORT-003 and DEMAND-001 exactly as connector data does. The owner enters and reads sales for every cafe and, until TEAM-001, a manager for their home cafe; staff and reduced preparation grants do not include these sales reads. A value is one cafe, venue date (YYYY-MM-DD), hour (0–23) or the whole day, metric (sales, transactions, covers or a workload metric named in letters) and value: sales in dollars and cents, kept as whole cents, every other metric a whole number. The [retained manual and csv sales and metric entry details](docs/contract/MECHANISMS.md#sales-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Upload two weeks of hourly sales by CSV and enter one day manually; preview and reject a duplicate upload, correct a day and see labor percentage and sales per labor hour update with the manual label and edit history.

#### HR-001 — Willow and BambooHR roster and leave authority

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Register:* R-21

**Requirement.** Connect BambooHR and the sibling [Willow](https://github.com/just-every/run-willow) for employee lifecycle, employment attributes, emergency contacts and leave. The buyer chooses one authoritative source per field and leave balance/decision through the same PAYSYNC-001 authority map that covers connected payroll providers, maps people and sites, and resolves conflicts before writeback. Termination revokes scheduling access and flags future shifts as in PAYSYNC-002; approved absence reaches staffing once. Willow owns the HR record, documents and broader HR lifecycle; Lanyard owns schedules, attendance, coverage and labor operations. It delivers LOG-001 incident exports to Willow for HR follow-up. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Connect each HR source, map two employees and leave ownership, import an approved absence and terminate one person.
2. Reconcile one balance/decision, reject conflicting edits, refuse a second authority for a field a payroll provider owns and verify access revocation and coverage handling without duplicate leave.
3. Switch CONTACT-001 emergency contacts' authority to Willow, change a contact there and see the card update while a Lanyard edit is refused.

#### DEMAND-001 — Multi-location demand forecasting

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001, BASE-MAIL-001

**Requirement.** Managers forecast sales/workload and required staffing by location, role and interval from POS history or SALES-001 entries, events, seasonality and employer-entered assumptions. Missing/stale inputs, confidence, version and actual-versus-forecast error remain visible. Managers can override with a reason; a forecast never manufactures worked hours or automatically changes a published schedule. The [retained multi-location demand forecasting details](docs/contract/MECHANISMS.md#demand-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Import a multi-week POS history for two sites, forecast a holiday/event day, inspect uncertainty and role demand, override one interval and compare actual sales/service outcomes afterward.
2. A stale connector produces an explicit incomplete forecast.
3. Upload two weeks of SALES-001 hourly sales, correct a day and see the forecast update from the entered sales with their manual label.
4. Add the forecast hours to the REPORT-003 interval report and compare them with scheduled and actual hours.
5. staff and other-cafe managers are refused every forecast and learning read and command.
6. An agent key without the comparison-read grant is refused.
7. With the forecast grant, the key reads its cafe's forecast and records an evidence-bound proposal; applying, declining or reverting carries standard (+ live for active behavior), decided by the company's policy.
8. Each decision shows in the audit with its actor.

#### OPT-001 — Budget preference and fairness-aware optimized schedules

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001, BASE-AUDIT-001, BASE-MAIL-001

**Requirement.** Managers choose service coverage, labor budget, employee preferences, fairness and cost objectives; the optimizer proposes feasible schedules and auto-fill using qualifications, availability, leave, rest, policy and cross-site hours. Fairness is the FAIR-001 measures. It explains infeasible coverage, overtime alternatives and objective tradeoffs rather than hiding constraints; publication carries commitment, which the company's policy decides for an agent; a person can review the complete diff. The optimizer reads each person's effective AVAIL-001 pattern, preferred blocks and weekly maximum. The optimizer never reads FEEDBACK-001 ratings, comments or flags. Agent reads of FAIR-001 values or comparison costs use the separately granted TRADEOFF-001 comparison scope, cafe limit, redaction, small-cell, unknown and audit rules. The [retained budget preference and fairness-aware optimized schedules details](docs/contract/MECHANISMS.md#opt-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Generate two feasible schedule alternatives from real location demand and employee preferences, inspect costs, FAIR-001 measures and uncovered intervals, raise the fairness priority and see the FAIR-001 spread and preference gap fall with the USD cost difference reported, then approve one diff.
2. An impossible budget/skill requirement stays explicit and cannot waive a break or qualification.
3. An optimized week never places someone in an AVAIL-001 unavailable block or past their weekly maximum.
4. Optimized schedules are unchanged by FEEDBACK-001 ratings and flags.

#### FAIR-001 — Named fairness measures

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001, BASE-MAIL-001

**Requirement.** Fairness in OPT-001, TRADEOFF-001 and LEARN-001 is computed from four named measures over a configurable trailing window (default eight weeks) among employees eligible for the same role and site: (1) preference gap, the absolute difference between each person's scheduled and preferred weekly hours, reported as mean and maximum; (2) undesirable-shift spread, each person's count of closing, close-then-open, weekend and holiday shifts (the employer chooses which tags count), reported as maximum minus minimum and standard deviation; (3) preference violations, the count of shifts placed in an employee's prefer-not blocks; (4) hours-offer equity, each part-time employee's share of offered extra hours against their requested share. The [retained named fairness measures details](docs/contract/MECHANISMS.md#fair-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. On a fixed eight-week dataset with a skewed closing rotation, generate a schedule at a low and at a high fairness priority.
2. The high-priority schedule's undesirable-shift spread and preference gap are no higher and, in the seeded case where a fairer feasible schedule exists, strictly lower; the USD cost difference and any coverage change between the two are reported, and each measure recomputes by hand from the exported inputs.
3. Preference measures count shifts in AVAIL-001 preferred blocks and hours against preferred weekly hours.
4. Measures are unchanged by FEEDBACK-001 ratings and flags.

#### AI-001 — Reviewed natural-language and image schedule preparation

*Tier:* Core · *Cites:* BASE-DATA-004, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-ROLE-001, BASE-DATA-001, BASE-DATA-006 · *Register:* R-2

**Requirement.** Managers use language or schedule images to prepare a source-backed draft with employee/site/local-time mappings and visible uncertainty. Under RL-101, the interim native-owner disclosure names the exact source, cafe context and OpenAI destination, requires applicable no-training terms, and sends only within current permission. Draft extraction carries standard and external, adding sensitive when the source contains regulated personal data; publication carries commitment and the company's policy decides agent calls. Under the held policy a person reviews the exact diff before publication; unreviewed output cannot publish under that policy. PRIVACY-003 stops later disclosure after local erasure without claiming recall of provider logs or disconnected archives. Delegated manager authority remains TEAM-001/ACCESS-003.

**Acceptance.**
1. Use a permission-scoped schedule image and request a language change; inspect exact disclosure, source references, low-confidence fields, conflict/cost/policy validation and no-training terms.
2. Correct ambiguous names and local times and decide the exact draft under the held company policy. Under all-autonomous policy, publication follows its commitment decision without claiming a person confirmed it.

#### AUTO-001 — Policy-limited schedule-aware time approvals

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Payroll administrators may authorize narrow automatic approval rules for exact schedule-matching captured time with required break attestation and no exception. The rule/version, input revision and automated decision are recorded; wages, uncertainty, missed breaks, self-interest conflicts and late corrections go to human review. Owners can pause/revoke rules and rerun a preview without changing history. The [retained policy-limited schedule-aware time approvals details](docs/contract/MECHANISMS.md#auto-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. Preview then authorize a rule for clean scheduled punches, process clean and exception-bearing timesheets and inspect which remain for human approval.
2. Change a source after preview, pause the rule and verify no stale or out-of-policy approval reaches payroll.

#### LINK-001 — Scoped APIs webhooks and workflow automation

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001

**Requirement.** Buyers and approved partners use documented versioned roster/time/coverage/report APIs, scoped credentials and signed event webhooks, with replay identities and observable delivery/reconciliation. Zapier and Make can start reminders or request drafts under least privilege. Agent integration calls carry the same server-computed classes and company-policy decision as their workforce action; site and payroll-period rules remain in force.

**Acceptance.**
1. Connect an authorized workflow to a published-shift or approved-time event, verify the signed payload, request a draft and inspect approval.
2. Retry an event, revoke its key and send foreign-site/stale-period mutations; no duplicate or unauthorized change occurs.

#### OPS-001 — Accountable connector operations and recovery

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-22

**Requirement.** Owners see connector scopes, last successful sync, cursor/backfill coverage, errors, expiring grants, queued attempts and assigned unresolved mismatches. Durable work resumes after restart; bounded retries honor provider limits and ambiguous writes await reconciliation rather than blind resend. Reauthorization, deletion and replay are deliberate and do not mutate prior payroll evidence. Its adapter journey uses provider sandboxes or official-schema fakes; the register separately records production interoperability.

**Acceptance.**
1. Pause a provider sandbox or official-schema fake  mid-period, restart and reauthorize it, then inspect recovered cursors, rate-limit handling and deduplicated rows.
2. Leave an ambiguous submission and verify an owner-visible case with no false success or duplicate write.

### Migration portability and honest boundaries

#### MIGRATE-001 — Reviewed complete workforce migration and cutover

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Owners preview mappings for people/source IDs, sites/jobs/qualifications, wage histories, availability/leave requests and leave balances per type as of the cutover date, future schedules, open offers/pending changes, historical punches/breaks/approved revisions, tip allocations and payroll-period status. Source originals, supported/unsupported fields and count/hour/cost reconciliation remain inspectable. Imported history is provenance-labeled and cannot create live invitations, notices, approvals or payroll submissions. Cutover explicitly sets clock, schedule, HR and payroll ownership; undo preserves later native edits and dependent work.

**Acceptance.**
1. Preview an authorized incumbent export, map ambiguous employees/time zones and inspect unsupported records.
2. Apply a reviewed batch, reconcile source counts, historical totals and each employee's leave balance (or, where PAYSYNC-004 gives the payroll provider balance authority, list every difference from the provider balance), activate future work deliberately and run a first payroll without resending historical hours.
3. Undo only untouched imports.

#### MIGRATE-002 — Deputy migration

*Tier:* Core · *Cites:* BASE-DATA-001 · *Register:* R-23

**Requirement.** A Deputy buyer can use a documented supported export/API extraction and MIGRATE-001 preview to bring employees, locations/jobs, availability/leave requests and leave balances, future schedules, historical time/breaks and available wage/policy/task-segment data. Missing source fields and manual transfer steps are listed before commitment; no synthetic fixture is called a verified Deputy export. Official-schema source fixtures prove the reproducible migration; the register separately records a real buyer extraction.

**Acceptance.**
1. Use a buyer-official-schema Deputy export/account, map and migrate two locations including corrected time and future shifts, reconcile source hours/costs and leave balances and resolve unsupported fields, then complete the first Lanyard scheduling/payroll period without duplicate historical submission.

#### MIGRATE-003 — When I Work migration

*Tier:* Core · *Register:* R-24

**Requirement.** A When I Work buyer migrates available employees/sites/jobs, availability/leave, reusable/recurring schedules, future assignments, pending swaps/open shifts and historical time through a documented extraction. MIGRATE-001 preserves unsupported items explicitly; calendar subscriptions and employee access are reissued under Lanyard authority after reviewed cutover. Official-schema source fixtures prove the reproducible migration; the register separately records a real buyer extraction.

**Acceptance.**
1. Import an official-schema When I Work source with two sites, recurring work and a pending coverage request; reconcile people/hours and future responsibility, reissue calendar feeds and invitations deliberately, and run a new pay period without replaying the old one.

#### MIGRATE-004 — Homebase migration

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-25

**Requirement.** A Homebase buyer migrates available people/locations, schedules, availability/leave, historical punches/breaks/corrections and payroll status with POS staff mapping and available labor/sales history. Pending offline captures are reconciled during cutover, notifications are reauthorized and MIGRATE-001 exposes any data requiring separate extraction. Official-schema source fixtures prove the reproducible migration; the register separately records a real buyer extraction.

**Acceptance.**
1. Use official-schema Homebase records, reconcile a final old-system offline punch and a corrected period, map Square/Toast identifiers and compare historical totals.
2. Activate the first new schedule and payroll period without duplicate punches or notices.

#### MIGRATE-005 — 7shifts restaurant migration

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Register:* R-26

**Requirement.** A 7shifts restaurant buyer migrates available locations/roles, employees, schedules/availability/leave, historical time/breaks, wage records, POS mapping and tip pool inputs/allocations. Historical tip and labor totals reconcile to source exports; restricted/unavailable source fields have named buyer-reviewed transfer steps rather than guessed reconstructions. Official-schema source fixtures prove the reproducible migration; the register separately records a real buyer extraction.

**Acceptance.**
1. Migrate a official-schema 7shifts restaurant export/account containing multiple roles, corrected time and tip history.
2. Reconcile employee, labor and tip totals, map POS/payroll and run the first new service/tip-pool/payroll period without reapplying historical distributions.

#### MIGRATE-006 — Connecteam workforce migration

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Register:* R-27

**Requirement.** A Connecteam buyer migrates the workforce scheduling/time portion: staff/jobs/sites/qualifications, schedule/tasks, availability/leave, clock settings, punches/breaks, approvals/locks and payroll mappings where extractable. Kiosk/device/location permissions are explicitly re-enrolled. Unrelated HR/operations modules are linked to their proper product/service and their source gaps are disclosed. Official-schema source fixtures prove the reproducible migration; the register separately records a real buyer extraction.

**Acceptance.**
1. Migrate a official-schema Connecteam workforce export with locked time, kiosk workers and a pending shift.
2. Reconcile approved hours and job mapping, enroll devices afresh, preserve locked history and complete a new approval/transfer period.

#### MIGRATE-007 — Legion workforce migration

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Register:* R-28

**Requirement.** A Legion buyer migrates available employees/locations, preferences, staffing constraints, schedules, historical work, labor budgets and demand/forecast inputs with source/version provenance. Optimization outputs remain historical until reviewed; source model internals that cannot export are explicitly rebuilt from authorized inputs without claiming equivalent learned weights. Official-schema source fixtures prove the reproducible migration; the register separately records a real buyer extraction.

**Acceptance.**
1. Use a official-schema Legion extraction, reconcile two locations' schedules/actual hours and available demand history, rebuild reviewed constraints and compare an initial forecast/optimized schedule before a deliberate payroll and scheduling cutover.

#### PRIVACY-001 — Retention legal holds and employee data rights

*Tier:* Core · *Cites:* BASE-DATA-002, BASE-DATA-006, BASE-MAIL-001

**Requirement.** Workforce record-class duties distinguish federal payroll (three years), federal wage computation (two), Chicago fair-workweek (three), Chicago paid leave (five) and applicable California hours/wage/sick-leave records (three), plus longer employment-duration and other applicable duties. Each preset retains its source, effective date, applicability and anchor. The longest obligation controls; unresolved applicability grants no deletion authority. Capture-specific periods, journal notes/files, logbooks, report sources and immutable retained copies remain covered. An owner authorization is neither employee consent nor legal sign-off. Seed custody and anchor details are in the [privacy rules](docs/contract/MECHANISMS.md#privacy-001); RL-1 and RL-5 record the retained-workforce boundary.

**Acceptance.**
1. Exercise the approved record-class retention matrix with independently expected dates, overlapping obligations, unknown applicability and two independent holds.
2. Releasing one hold must not permit disposition while another applies.

#### PRIVACY-002 — Employee access export and correction requests

*Tier:* Core · *From:* PRIVACY-001 · *Cites:* BASE-DATA-002, BASE-DATA-006, BASE-ROLE-001, BASE-DATA-001

**Requirement.** Verified employee-scoped requests produce attributable access, export and correction responses without silently rewriting retained evidence. Ordinary exports contain the employee's own payroll and current visible notes and name omissions; private notes/prior versions are excluded from that ordinary projection. A statutory request for additional material requires separately reviewed fulfillment, not blanket refusal based on visibility. Unsupported fulfillment and external copies remain explicit. This follows RL-1 and RL-5.

**Acceptance.**
1. Export an employee with a private and an employee-visible JOURNAL-001 note and find only the employee-visible one.
2. Fulfill a verified employee-scoped access request, record a correction without silently rewriting retained evidence.
3. Name external copies and unsupported fulfillment explicitly.

#### PRIVACY-003 — Explicit workforce erasure and restore fences

*Tier:* Core · *From:* PRIVACY-001 · *Cites:* BASE-DATA-002, BASE-DATA-006, BASE-INPUT-003, BASE-DATA-001

**Requirement.** Eligible workforce disposition separately rechecks each retention duty and independent hold and removes covered local derivatives, attachments, saved results and source originals without claiming held facts erased. Releasing one hold triggers no deletion. Explicit journal erasure cannot be edited back; capture consent withdrawal affects later captures without erasing required records. Restore fences prevent eligible erased content from returning through a destination or later journal. Downloads, disconnected archives, messages and provider copies require explicit external handling and cannot be recalled. ERASE-001 remains the separate unused-identity door.

**Acceptance.**
1. Request a former employee's data, apply a legal hold to paid history, export authorized records and erase eligible location, attachment and import data.
2. Inspect surviving held records and deletion results, then restore an older archive with the later fence without resurrecting erased facts.
3. Refuse erasure of required or held facts, and erase eligible covered local derivatives only after separate reviewed authorization.
4. Restore an older archive with the later fence and verify erased content remains absent.

#### BOUNDARY-001 — Product ownership and US service boundaries

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-DATA-006, BASE-ACCESSIBILITY-001

**Requirement.** Lanyard owns hourly staffing, attendance, labor cost, tip allocation and approved-hour reconciliation. Payroll providers own gross-to-net payroll, W-2/1099 forms, withholding, tax filing, ACA filing, ACH/wage disbursement, earned-wage access and off-cycle payment execution; POS providers own card sales, refunds and settlement. Willow owns hiring, onboarding paperwork, broader HR records and employment documents through HR-001. Lanyard supports employer-reviewed US rules and retained evidence rather than guaranteeing universal legal compliance; policy counsel and the payroll provider confirm applicability. Punch photos (CLOCK-005) are core; facial-recognition matching, fingerprint or other biometric templates and dedicated clock hardware are optional partner work. Production provider apps, agreements, fees and native distribution are engineering deliverables for the promised connectors and mobile apps, never scope exclusions. Payroll sibling: [Envelope](https://github.com/just-every/run-envelope).

**Acceptance.**
1. Walk a US buyer from schedule, actual hours and tip approval through provider reconciliation and payment status; inspect source/authority labels at each step.
2. Confirm HR changes hand off to Willow, a provider failure remains unresolved and no Lanyard action claims tax filing or paid wages from a file/HTTP receipt.

### Agent surface

**Specialist: workforce coordinator.** It carries a service week from staffing demand and coverage through recorded work and reconciled payroll inputs.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call.

**How Lanyard computes each class.**
- **standard:** reversible internal schedule drafts, availability edits, report preparation and forecast assumptions; facts name affected shifts, people or records.
- **external:** an offer/notice/message, source disclosure, public feed or provider transfer leaves the workforce business; facts name recipients and known/new/public counterparty from current business/provider records.
- **money:** an actual payroll transfer or a change to what the employer pays, including a paid rate, allocation or payroll adjustment; facts include USD amount and provider/employee counterparty. An estimate alone is standard.
- **commitment:** schedule publication, authoritative time/leave/payroll sign-off or an exception others rely on; facts bind the exact source revision and affected people/value.
- **accounts:** creation of a sending, payroll or other outside-provider account/resource; facts name the provider.
- **gated:** a provider requires its person-only consent, verification or hosted card/terms step; facts name provider and step. A brokered company-credential route remains subject to the company policy.
- **access:** workforce membership, scoped levels, audit/leave grants, device enrollment or agent grants change; facts name people and widening/narrowing direction.
- **security:** protective clock/network settings or provider/workforce credential handling; facts name the setting.
- **destructive:** an eligible purge or irreversible workforce/source erasure cannot be undone in Lanyard; facts name affected items. A reversible draft edit stays standard.
- **sensitive:** a record contains regulated health, identity, bank, card or payroll numbers, including a qualifying leave/image source; facts name record count and data kind. Ordinary shift times and estimate-only aggregate costs alone do not add it.
- **live:** changing an enabled clock, reminder, automatic-time or scheduling-assumption rule changes running workforce behavior; facts name the affected service and site.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `lanyard.people.manage` | Staff lifecycle and payroll identities | PEOPLE-001 | access | not implemented |
| `lanyard.move.preview_import` | Reviewed Staff CSV move-in | MOVE-001 | standard | not implemented |
| `lanyard.roster.decide_leave` | Availability and explicit leave decisions | ROSTER-001 | standard | not implemented |
| `lanyard.roster.publish` | Conflict-checked revision publication | ROSTER-002 | standard or commitment (+ money, external) | not implemented |
| `lanyard.roster.confirm_shift` | Personal published schedule confirmation | ROSTER-003 | standard | not implemented |
| `lanyard.time.decide` | Exact time approval and linked corrections | TIME-002 | standard or commitment (+ money, external) | not implemented |
| `lanyard.payroll.export` | Reviewed once-only payroll files and signed adjustments | PAYROLL-001 | standard or commitment (+ money, external) | not implemented |
| `lanyard.payroll.acknowledge` | Explicit manual provider acknowledgment | PAYROLL-002 | standard | not implemented |
| `lanyard.agent.grant` | Delegated workforce actions and reduced preparation context | AGENT-001 | access (+ security) | not implemented |
| `lanyard.audit.read_activity` | Durable decisions and transactional history | AUDIT-001 | standard | not implemented |
| `lanyard.team.organize` | Multi-location roles and delegated management | TEAM-001 | access | not implemented |
| `lanyard.people.configure_jobs` | Jobs qualifications preferences and effective pay rates | PEOPLE-002 | standard | not implemented |
| `lanyard.contact.read` | Emergency contacts on the shift and employee card | CONTACT-001 | standard (+ sensitive, money, commitment) | not implemented |
| `lanyard.access.manage_levels` | Custom access levels | ACCESS-003 | access | not implemented |
| `lanyard.journal.manage` | Employee notes and manager journal | JOURNAL-001 | standard (+ sensitive, money, commitment) | not implemented |
| `lanyard.schedule.edit` | Editable visual schedules and publication review | SCHEDULE-001 | standard | not implemented |
| `lanyard.schedule.apply_template` | Reusable templates recurring shifts and duplication | SCHEDULE-002 | standard | not implemented |
| `lanyard.schedule.coordinate_sites` | Cross-site coverage and double-booking prevention | SCHEDULE-003 | standard | not implemented |
| `lanyard.schedule.handover` | Manage shift instructions, checklists and blocker handovers | SCHEDULE-004 | standard | not implemented |
| `lanyard.leave.manage_pto` | PTO balances and staffing-aware time off | LEAVE-001 | standard | not implemented |
| `lanyard.avail.set_pattern` | Recurring availability preferences and approval | AVAIL-001 | standard | not implemented |
| `lanyard.leave.configure_blackout` | Time-off blackout dates limits and team leave calendar | LEAVE-002 | standard | not implemented |
| `lanyard.leave.apply_sick_policy` | Paid sick and safe leave jurisdiction presets | LEAVE-003 | standard (+ sensitive, money, commitment) | not implemented |
| `lanyard.minor.review_evidence` | Minor work-hour limits and permits | MINOR-001 | standard | not implemented |
| `lanyard.schedule.post` | Printable and posted schedules | SCHEDULE-005 | standard | not implemented |
| `lanyard.schedule.compare_history` | Schedule change history and revision compare | SCHEDULE-006 | standard | not implemented |
| `lanyard.cover.swap` | Employee shift swaps with final approval | COVER-001 | standard | not implemented |
| `lanyard.cover.pickup` | Open shifts offers and pickup | COVER-002 | standard | not implemented |
| `lanyard.cover.replace_callout` | Call-out replacement and verified coverage | COVER-003 | standard | not implemented |
| `lanyard.cover.configure_offers` | Offer order and access-to-hours priority | COVER-004 | standard | not implemented |
| `lanyard.roster.read_team` | Team schedule visibility for staff | ROSTER-004 | standard | not implemented |
| `lanyard.notice.send` | Delivered schedule notices and acknowledgment | NOTICE-001 | standard or external (+ commitment) | not implemented |
| `lanyard.notice.schedule_followup` | Reminders escalation and payroll follow-up | NOTICE-002 | standard or external (+ commitment) | not implemented |
| `lanyard.notice.deliver_followup` | Reminder delivery under employee contact settings | NOTICE-003 | standard or external (+ commitment) | not implemented |
| `lanyard.chat.send` | Team messaging and operational handover | CHAT-001 | standard or external (+ commitment) | not implemented |
| `lanyard.feedback.submit` | Post-shift employee feedback | FEEDBACK-001 | standard | not implemented |
| `lanyard.log.manage` | Manager logbook and shift handover log | LOG-001 | standard | not implemented |
| `lanyard.clock.read_attendance` | Live attendance and late or no-show alerts | CLOCK-004 | standard | not implemented |
| `lanyard.clock.answer_questions` | Clock-in and clock-out questions and attestations | CLOCK-006 | standard | not implemented |
| `lanyard.clock.transfer_job` | Mid-shift job and site transfers | CLOCK-008 | standard | not implemented |
| `lanyard.break.time` | Timed meals breaks and exceptions | BREAK-001 | standard | not implemented |
| `lanyard.break.configure_deduction` | Automatic meal deductions with employee attestation | BREAK-002 | standard | not implemented |
| `lanyard.time.resolve_exception` | Missed punches employee review and exception resolution | TIME-003 | standard | not implemented |
| `lanyard.time.lock_period` | Payroll period locks and controlled reopening | TIME-004 | standard or commitment (+ money, external) | not implemented |
| `lanyard.time.configure_rounding` | Punch rounding and snap-to-schedule | TIME-005 | standard | not implemented |
| `lanyard.time.configure_window` | Early clock-in window and unscheduled punches | TIME-006 | standard | not implemented |
| `lanyard.time.resolve_provisional` | Forgotten clock-out reminder cap and provisional close | TIME-007 | standard | not implemented |
| `lanyard.time.approve_many` | Bulk timesheet approval with pinned revisions | TIME-008 | standard or commitment (+ money, external) | not implemented |
| `lanyard.time.read_review` | Timesheet approval review with schedule variance | TIME-009 | standard | not implemented |
| `lanyard.policy.configure_overtime` | US overtime meal and rest policy rules | POLICY-001 | standard or live (+ money, commitment) | not implemented |
| `lanyard.policy.review_fair_workweek` | Predictive scheduling and fair-workweek changes | POLICY-002 | standard or live (+ money, commitment) | not implemented |
| `lanyard.payrule.configure_differential` | Shift differentials | PAYRULE-001 | standard | not implemented |
| `lanyard.payrule.configure_holiday` | Holiday calendar and holiday premiums | PAYRULE-002 | standard | not implemented |
| `lanyard.payrule.review_reporting_premium` | Reporting-time call-in split-shift and spread-of-hours premiums | PAYRULE-003 | standard | not implemented |
| `lanyard.cost.read_variance` | Scheduled versus actual labor cost and budgets | COST-001 | standard | not implemented |
| `lanyard.cost.read_overtime_risk` | In-week overtime risk alerts from actual hours | COST-002 | standard | not implemented |
| `lanyard.aca.measure_service` | ACA hours measurement for variable-hour employees | ACA-001 | standard | not implemented |
| `lanyard.tips.allocate` | Tips pooling and reviewed payroll allocation | TIPS-001 | standard | not implemented |
| `lanyard.tips.read_makeup` | Tip credit and minimum-wage make-up checks | TIPS-002 | standard | not implemented |
| `lanyard.report.run` | Operational reports exports and scheduled delivery | REPORT-001 | standard | not implemented |
| `lanyard.report.preserve_audit` | Compliance and audit record reports | REPORT-002 | standard | not implemented |
| `lanyard.report.read_interval` | Sales per labor hour and labor percentage by interval | REPORT-003 | standard | not implemented |
| `lanyard.dash.read` | Manager daily operations dashboard | DASH-001 | standard | not implemented |
| `lanyard.earn.read_own` | Employee hours and estimated earnings | EARN-001 | standard | not implemented |
| `lanyard.pay.classify` | Payroll-ready classified hours and pay codes | PAY-001 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.configure_template` | Configurable payroll export templates | PAY-002 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_paylocity` | Paylocity import preset | PAY-003 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_paycor` | Paycor import preset | PAY-004 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_rippling` | Rippling import preset | PAY-005 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_heartland` | Heartland Payroll import preset | PAY-006 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_square` | Square Payroll hours preset | PAY-007 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_toast` | Toast Payroll hours preset | PAY-008 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.schedule_period` | Pay schedules and workweeks that cross pay periods | PAY-009 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_paychex` | Paychex Flex payroll import file preset | PAY-010 | standard or commitment (+ money, external) | not implemented |
| `lanyard.pay.export_iif` | QuickBooks Desktop Payroll IIF time export | PAY-011 | standard or commitment (+ money, external) | not implemented |
| `lanyard.sync.submit` | Approved transfer and provider-applied reconciliation | SYNC-001 | standard or money · commitment · external (+ gated) | not implemented |
| `lanyard.sales.enter` | Manual and CSV sales and metric entry | SALES-001 | standard | not implemented |
| `lanyard.demand.forecast` | Multi-location demand forecasting | DEMAND-001 | standard (+ live, commitment) | not implemented |
| `lanyard.opt.optimize` | Budget preference and fairness-aware optimized schedules | OPT-001 | standard (+ live, commitment) | not implemented |
| `lanyard.fair.measure` | Named fairness measures | FAIR-001 | standard | not implemented |
| `lanyard.ai.extract_schedule` | Reviewed natural-language and image schedule preparation | AI-001 | standard · external (+ sensitive, commitment) | not implemented |
| `lanyard.auto.configure_time_rule` | Policy-limited schedule-aware time approvals | AUTO-001 | standard or live (+ money, commitment) | not implemented |
| `lanyard.privacy.configure_retention` | Retention legal holds and employee data rights | PRIVACY-001 | sensitive (+ destructive) | not implemented |
| `lanyard.coverage.coordinate` | Carry an absence or demand swing to verified coverage | COVERAGE-001 | standard or external (+ commitment) | not implemented |
| `lanyard.tradeoff.compare` | Explain cost fairness and service alternatives | TRADEOFF-001 | standard (+ live, commitment) | not implemented |
| `lanyard.cutoff.reconcile` | Resolve payroll exceptions before the cutoff | CUTOFF-001 | standard or money · commitment · external (+ gated) | not implemented |
| `lanyard.learn.propose` | Learn from forecast errors and unresolved outcomes | LEARN-001 | standard (+ live, commitment) | not implemented |
| `lanyard.team.administer_leave` | Scoped private leave administration | TEAM-002 | access | not implemented |
| `lanyard.team.grant_auditor` | Named read-only audit grants | TEAM-003 | access | not implemented |
| `lanyard.schedule.allocate_areas` | Reconciled job and area segments | SCHEDULE-007 | standard | not implemented |
| `lanyard.leave.use_nyc_supplement` | Separate NYC supplemental unpaid leave | LEAVE-004 | standard (+ sensitive, money, commitment) | not implemented |
| `lanyard.leave.use_prenatal` | Separate New York prenatal bank | LEAVE-005 | standard (+ sensitive, money, commitment) | not implemented |
| `lanyard.leave.donate_oregon` | Voluntary Oregon bank donations | LEAVE-006 | standard (+ sensitive, money, commitment) | not implemented |
| `lanyard.policy.configure_breaks` | Maintained meal rest and weekly-rest rules | POLICY-003 | standard or live (+ money, commitment) | not implemented |
| `lanyard.policy.adopt_alternate` | Reviewed alternative workweek evidence | POLICY-004 | standard or live (+ money, commitment) | not implemented |
| `lanyard.privacy.fulfill_request` | Employee access export and correction requests | PRIVACY-002 | sensitive (+ destructive) | not implemented |
| `lanyard.privacy.erase_eligible` | Explicit workforce erasure and restore fences | PRIVACY-003 | sensitive (+ destructive) | not implemented |
| `lanyard.connections.authorize` | Create/authorize a provider resource with the company credential route | SYNC-001, PEOPLE-003 | accounts (+ gated, security) | not implemented |
| `lanyard.custody.dispose` | Explicit eligible workforce disposition | PRIVACY-003 | destructive · sensitive | not implemented |
| `lanyard.credentials.rotate` | Rotate provider/workforce credentials | AGENT-001 | security (+ access) | not implemented |
| `lanyard.access.configure_identity` | Configure workforce SSO and required factors | ACCESS-002 | security · access (+ gated) | not implemented |
| `lanyard.people.invite_mobile` | Invite a phone-only worker through the verified text route | PEOPLE-003 | access · external (+ accounts, gated) | not implemented |
| `lanyard.people.erase_unused` | Erase an eligible unused workforce identity | ERASE-001 | destructive · access (+ sensitive) | not implemented |
| `lanyard.clock.manage_kiosk` | Enroll and revoke a site kiosk | CLOCK-001 | access · security (+ live) | not implemented |
| `lanyard.clock.recover_captures` | Inspect and resolve rejected captures without inventing worked time | CLOCK-002 | standard (+ sensitive, commitment) | not implemented |
| `lanyard.clock.configure_location` | Configure a site fence and inspect disputed punch evidence | CLOCK-003 | security (+ live, sensitive) | not implemented |
| `lanyard.clock.configure_photos` | Configure site capture and read a permitted punch still | CLOCK-005 | security (+ live, sensitive) | not implemented |
| `lanyard.clock.configure_network` | Manage approved clock networks and enrolled browsers | CLOCK-007 | security · access (+ live) | not implemented |
| `lanyard.calendar.issue_feed` | Issue or revoke the employee's private calendar feed | CAL-001 | security (+ external) | not implemented |
| `lanyard.people.set_language` | Set the employee language preference | LANG-001 | standard | not implemented |
| `lanyard.connections.recover` | Inspect and retry a connector case without blind payroll replay | OPS-001 | standard (+ money, external, accounts, gated, security) | not implemented |

**Resources.** `lanyard://people/{id}`, `lanyard://weeks/{week}`, `lanyard://shifts/{id}`, `lanyard://time/{id}`, `lanyard://payroll/{id}`, `lanyard://leave/{id}`, `lanyard://reports/{id}`, `lanyard://forecasts/{id}`, `lanyard://offers/{id}` and `lanyard://journal/{id}`. The preparation-context projection remains distinct from separately granted private record reads.

**Events.** Workforce person/shift/time/leave/offer/report/payroll/forecast changes, plus the inherited policy, review and approval events. **Prompts.** Prepare the service week (SCHEDULE-001, DEMAND-001, OPT-001), fill a call-out (COVERAGE-001), explain alternatives (TRADEOFF-001), clear cutoff exceptions (CUTOFF-001), and compare service outcomes (LEARN-001).

**Not tools, and why.**
- ACCESS-001: A device capture, native sign-in or a person's interactive client screen; records and related workforce decisions are mapped tools.
- TIME-001: A device capture, native sign-in or a person's interactive client screen; records and related workforce decisions are mapped tools.
- ARCHIVE-001: An installation fact or documented CLI door.
- PUBLIC-001: An installation fact or documented CLI door.
- BASE-001: An installation fact or documented CLI door.
- PEOPLE-003: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- ACCESS-002: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- CAL-001: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- MOBILE-001: A device capture, native sign-in or a person's interactive client screen; records and related workforce decisions are mapped tools.
- MOBILE-002: A device capture, native sign-in or a person's interactive client screen; records and related workforce decisions are mapped tools.
- CLOCK-001: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- CLOCK-002: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- CLOCK-003: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- CLOCK-005: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- CLOCK-007: only the physical capture, personal sign-in, external subscription or rendered client leg is outside tools; its administrative workforce action is mapped above.
- GUSTO-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- ADP-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- PAYCHEX-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- QB-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- PAYSYNC-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- PAYSYNC-002: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- PAYSYNC-003: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- PAYSYNC-004: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- POS-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- POS-002: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- POS-003: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- POS-004: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- HR-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- LINK-001: The integration transport exposes the same workforce actions; it is not another business action.
- MIGRATE-001: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- MIGRATE-002: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- MIGRATE-003: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- MIGRATE-004: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- MIGRATE-005: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- MIGRATE-006: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- MIGRATE-007: The connector or move-in door owns the provider/source protocol; its workforce actions remain available through the mapped jobs.
- BOUNDARY-001: An installation fact or documented CLI door.

**Limits.** The capacity sheet in the workforce mechanism guide records request, capture/file and byte limits. Business-volume thresholds and provider/model spend caps are the company's policy.

**Handoffs.** It listens for payroll/HR employee, balance and rate changes, POS sales/tips and staff responses; it emits coverage, approved-work and source-reconciliation events for payroll and HR specialists. Provider payment and tax filing remain the payroll provider's jobs.

#### SURFACE-001 — Workforce registry and public-door parity

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The declared workforce jobs and non-tool reasons above are the registry's seed map. Its workforce fixtures exercise the same source-bound actions used by the schedule, time and payroll screens.

**Acceptance.**
1. Discover the workforce tools and match every Core clause to the table or stated non-tool reason, including all split parts.
2. For a roster change, time correction and payroll draft, compare the UI and MCP record result and workforce event; read the resulting shift/time/payroll resource.

#### SURFACE-002 — Workforce resources and scoped source facts

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-005, BASE-AGENT-010

**Requirement.** Workforce resources distinguish a preparation projection, the sponsoring employee's records, separately granted wage/leave-purpose fields and scoped audit packets. A published schedule is not proof of worked time; a payroll receipt is not proof of wages paid.

**Acceptance.**
1. Read the same populated shift, time, leave and audit packet as a worker, site manager and separately granted auditor and reconcile each workforce projection to its product screen.
2. Read source revisions for a corrected shift, time and signed payroll adjustment and follow their resource links without confusing superseded work with current facts.

#### SURFACE-003 — Outside contact and provider steps

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Workforce outreach, schedule-source disclosure and provider connections classify the actual destination, audience and provider step.

**Acceptance.**
1. Prepare an internal shift note and an outside offer or model disclosure; the first is standard, the second adds external with exact recipients and known/new/public counterparty. Moving a source into an outside-visible destination adds external too.
2. Create a provider account/resource and see accounts with the provider; a person-only provider consent/verification/hosted checkout response adds gated with its exact step, while the provider's brokered company-credential route uses the company policy.

#### SURFACE-004 — Pay and authoritative workforce decisions

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-012

**Requirement.** Payroll and schedule decisions classify their binding effect and actual money movement from retained workforce sources.

**Acceptance.**
1. Prepare a reversible internal schedule/payroll draft as standard, publish a shift or sign off approved time as commitment, and read the exact affected revision and people.
2. Transfer payroll or change an effective payable rate/allocation and see money with USD amount and counterparty, plus external and commitment where the call both sends and binds the business; a cost estimate alone has no money class.
3. Use one corrected time source twice and reconcile one signed adjustment and its retained source under both company policies.

#### SURFACE-005 — Workforce access custody and protection classes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Workforce authority and custody calls compute classes from their actual field and disposition effects.

**Acceptance.**
1. Grant then narrow a site/auditor/device scope and see access with affected people and direction; rotate a workforce credential or protective network rule and see security with the setting.
2. Read a qualifying regulated payroll/leave/image source and see sensitive with its data kind and record count; an ordinary shift or aggregate estimate does not acquire that class merely from its label.
3. Purge eligible local source material and see destructive with its item count and sensitive when the actual material qualifies; a reversible draft edit remains standard. Held payroll facts remain retained under the seed's disposition rules.

#### SURFACE-006 — Running workforce rules and events

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-010

**Requirement.** Workforce assumptions and enabled operating rules distinguish a reversible preparation change from a live behavior change.

**Acceptance.**
1. Edit a draft forecast assumption and see standard; enable or change the rule used by a running clock, reminder or automatic-time service and see live with its site/service.
2. Follow an offer through staff response, exact assignment decision and actual punch; reconcile emitted events to the workforce records and the still-open exception when no punch arrives.

#### SURFACE-007 — A stranger coordinates a seeded workforce week

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-013

**Requirement.** Given only the installation URL, a stranger workforce specialist completes a two-site service week with a call-out, changed rate, sick-time use, late punch and signed payroll correction. It runs once under all-autonomous company policy and once under held company policy, with the same source and payroll reconciliation.

**Acceptance.**
1. Prepare and publish the two-site week from demand and availability; handle a call-out, outside offer and employee response, and verify coverage only from actual clock-in.
2. Capture actual work through the employee/device doors, reconcile a sick-time use and late punch, prepare classified payroll and transfer the exact reviewed sources through a provider sandbox or official-schema fake.
3. Under all-autonomous policy, every permitted agent step follows its computed classes without a policy wait or policy refusal; under held policy the returned workforce decision links take the signed-in test person to the exact saved revisions.
4. Correct already-exported time and reconcile its one signed difference to provider readback, with unknown payment status remaining unknown; compare both weeks' resulting sources and event/overview totals.
5. Follow a provider-only gated handoff and the required employee's own factual consent without attributing either person's act to the agent.

## Push further

### Workforce specialists

#### COVERAGE-001 — Carry an absence or demand swing to verified coverage

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001, BASE-MAIL-001

**Requirement.** With manager-authorized contact and staffing policies, the coverage agent reads the affected shift, demand delta, qualifications, availability, leave, cross-site actual/approved hours, fatigue/rest limits, rates and prior responses. It ranks qualified non-overtime replacements, explains exceptions, collects employee responses and expires losing offers. Outside offers carry external; a changed assignment carries commitment, as decided by the company's policy. It carries the approved change through schedule notices and payroll preparation, then checks acknowledgment and actual clock-in; only evidence closes coverage. Revocation stops further outreach and stale data triggers fresh review.

**Acceptance.**
1. Report a call-out and demand increase across two sites; inspect ranked source-backed options and policy refusals, collect replies, decide one exact diff under the held company policy and observe closed offers, delivered/acknowledged changes and payroll draft.
2. Miss the replacement's clock-in and require reopened coverage escalation; revoke agent authority and prove outreach stops.

#### TRADEOFF-001 — Explain cost fairness and service alternatives

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001, BASE-MAIL-001

**Requirement.** The planning agent compares candidate schedules using POS demand, service requirements, effective wage/policy data, employee preferences and the FAIR-001 fairness measures. It shows USD cost, overtime, missed preferences, FAIR-001 values, coverage/service risk and uncertainty for each alternative with source facts. Managers choose objectives; an agent exception decision carries commitment, decided by the company's policy; protected traits are excluded from ranking and the agent cannot waive required qualifications or breaks. The source-backed scheduled overtime estimate, scoped comparison projection, small-cell withholding and explicit unknowns follow the [comparison calculations](docs/contract/MECHANISMS.md#tradeoff-001).

**Acceptance.**
1. Ask why a cheaper roster gives worse coverage or a wider closing-shift spread; inspect alternatives, calculation inputs and missing data, raise the fairness objective and see the resulting diff lower the FAIR-001 undesirable-shift spread with its cost difference shown.
2. Under the held company policy, no proposal publishes without the named person's decision and an impossible constraint stays visible.
3. Issue an unscoped key and a key scoped to one cafe: the unscoped key and the other cafe are refused or not found; the scoped read shows alternatives, FAIR-001 values and USD totals without rates, per-person cents, requested minutes or payroll IDs; a two-person cost difference is labelled withheld for a small group; an incomplete workweek and a missing rate stay unknown; the read appears in owner activity; revoke and immediately retry is refused; under the held company policy, agent fairness preparation and publication await the named decision.

#### CUTOFF-001 — Resolve payroll exceptions before the cutoff

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001

**Requirement.** The payroll agent monitors actual punches, breaks, approved revisions, mapping failures and provider acceptance/application against the pay-period cutoff. It explains discrepancies in plain language, requests factual corrections from employees and follows up with accountable managers until resolved. Workers provide their own factual confirmations. Agent time decisions carry commitment; payroll submission/off-cycle action also carries money and external, with disposition decided by company policy. Missing facts and uncertain outcomes remain explicit.

**Acceptance.**
1. Approach payroll cutoff with a missed punch, break exception, unmapped employee and partial provider rejection.
2. Follow agent requests through employee confirmation, commitment and money-class decisions under the held company policy, inspect provider readback and remaining unknowns, then handle a later correction without rewriting paid history.

#### LEARN-001 — Learn from forecast errors and unresolved outcomes

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-ROLE-001, BASE-AUDIT-001, BASE-MAIL-001

**Requirement.** The agent compares forecast demand, published staffing, actual attendance, sales/service outcomes, FAIR-001 measures and unresolved exceptions, attributing known error sources and retaining uncertainty. It proposes revised demand assumptions, offer timing and objective weights (including FAIR-001 fairness weights) with a measured comparison and versioned explanation. A learning-assumption change carries standard, adding live when it changes active scheduling behavior; the company's policy decides whether it applies or waits. Protected traits, unobserved work and unresolved payroll are never imputed as success, and reverting cannot alter historical records. Agent reads of FAIR-001 values or comparison costs use the separately granted TRADEOFF-001 comparison scope, cafe limit, redaction, small-cell, unknown and audit rules. The [retained learn from forecast errors and unresolved outcomes details](docs/contract/MECHANISMS.md#learn-001) define source fields, calculations and revision behavior.

**Acceptance.**
1. After several comparable service periods, inspect forecast-versus-actual errors including a no-show and stale POS interval, review a proposed assumption change and its holdout comparison, approve or decline it and revert if needed.
2. Unobserved outcomes remain unknown in learning and reporting.
3. staff and other-cafe managers are refused every forecast and learning read and command.
4. An agent key without the comparison-read grant is refused.
5. With the forecast grant, the key reads its cafe's forecast and records an evidence-bound proposal; applying, declining or reverting carries standard (+ live for active behavior), decided by the company's policy.
6. Each decision shows in the audit with its actor.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Manager SSO against real Google Workspace, Microsoft Entra ID and Okta tenants, including workforce-role mapping. | ACCESS-002 | not run | | |
| R-2 | A real buyer-authorized schedule photo, its source permission and extraction receipt; synthetic images do not establish this receipt. | AI-001 | not run | | |
| R-3 | Buyer-authorized production google and outlook calendar subscriptions receipt, including required vendor account/partner access and actual interoperability. | CAL-001 | not run | | |
| R-4 | Buyer-authorized production paylocity import preset receipt, including required vendor account/partner access and actual interoperability. | PAY-003 | not run | | |
| R-5 | Buyer-authorized production paycor import preset receipt, including required vendor account/partner access and actual interoperability. | PAY-004 | not run | | |
| R-6 | Buyer-authorized production rippling import preset receipt, including required vendor account/partner access and actual interoperability. | PAY-005 | not run | | |
| R-7 | Buyer-authorized production heartland payroll import preset receipt, including required vendor account/partner access and actual interoperability. | PAY-006 | not run | | |
| R-8 | Buyer-authorized production square payroll hours preset receipt, including required vendor account/partner access and actual interoperability. | PAY-007 | not run | | |
| R-9 | Buyer-authorized production toast payroll hours preset receipt, including required vendor account/partner access and actual interoperability. | PAY-008 | not run | | |
| R-10 | Buyer-authorized production paychex flex payroll import file preset receipt, including required vendor account/partner access and actual interoperability. | PAY-010 | not run | | |
| R-11 | Buyer-authorized production quickbooks desktop payroll iif time export receipt, including required vendor account/partner access and actual interoperability. | PAY-011 | not run | | |
| R-12 | Buyer-authorized production approved transfer and provider-applied reconciliation receipt, including required vendor account/partner access and actual interoperability. | SYNC-001 | not run | | |
| R-13 | Buyer-authorized production live gusto payroll connection receipt, including required vendor account/partner access and actual interoperability. | GUSTO-001 | not run | | |
| R-14 | Buyer-authorized production distinct adp run and workforce now connectors receipt, including required vendor account/partner access and actual interoperability. | ADP-001 | not run | | |
| R-15 | Buyer-authorized production live paychex flex payroll connection receipt, including required vendor account/partner access and actual interoperability. | PAYCHEX-001 | not run | | |
| R-16 | Buyer-authorized production quickbooks online payroll live time connection receipt, including required vendor account/partner access and actual interoperability. | QB-001 | not run | | |
| R-17 | Buyer-authorized production square sales staff and tip inputs receipt, including required vendor account/partner access and actual interoperability. | POS-001 | not run | | |
| R-18 | Buyer-authorized production toast restaurant sales and labor connection receipt, including required vendor account/partner access and actual interoperability. | POS-002 | not run | | |
| R-19 | Buyer-authorized production clover sales terminals and employee mapping receipt, including required vendor account/partner access and actual interoperability. | POS-003 | not run | | |
| R-20 | Buyer-authorized production shopify pos and lightspeed sales adapters receipt, including required vendor account/partner access and actual interoperability. | POS-004 | not run | | |
| R-21 | Buyer-authorized production willow and bamboohr roster and leave authority receipt, including required vendor account/partner access and actual interoperability. | HR-001 | not run | | |
| R-22 | Buyer-authorized production accountable connector operations and recovery receipt, including required vendor account/partner access and actual interoperability. | OPS-001 | not run | | |
| R-23 | Buyer-authorized real Deputy extraction with its source permission and complete cutover reconciliation. | MIGRATE-002 | not run | | |
| R-24 | Buyer-authorized real When I Work extraction with its source permission and complete cutover reconciliation. | MIGRATE-003 | not run | | |
| R-25 | Buyer-authorized real Homebase extraction with its source permission and complete cutover reconciliation. | MIGRATE-004 | not run | | |
| R-26 | Buyer-authorized real 7shifts restaurant extraction with its source permission and complete cutover reconciliation. | MIGRATE-005 | not run | | |
| R-27 | Buyer-authorized real Connecteam workforce extraction with its source permission and complete cutover reconciliation. | MIGRATE-006 | not run | | |
| R-28 | Buyer-authorized real Legion workforce extraction with its source permission and complete cutover reconciliation. | MIGRATE-007 | not run | | |
| R-29 | Supported iOS/Android store approval and distribution receipts. | MOBILE-001, MOBILE-002 | not run | | |
| R-30 | Physical supported-device location and native capture proof. | CLOCK-003, CLOCK-001, MOBILE-001 | not run | | |
| R-31 | Independent human screen-reader pass at desktop and phone sizes. | PUBLIC-001, MOBILE-001, MOBILE-002 | not run | | |
| R-32 | Dated VPAT for the workforce operator and public surfaces. | PUBLIC-001, MOBILE-001, MOBILE-002 | not run | | |
| R-33 | Real Claude, ChatGPT, Codex and Copilot client interoperability receipts. | AGENT-001 | not run | | |

## Boundaries

- Payroll providers retain wage payment, withholding, tax/ACA filing and authoritative pay statements; file export and provider acceptance establish neither wages paid nor legal compliance.
- Willow retains broader HR documents and lifecycle. Facial recognition, biometric templates and dedicated hardware remain optional partner work.
- Real production interoperability and field receipts are visible in the register; seeded fixtures never establish a buyer's consent or actual vendor certification.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | A full crew, paid right. | COVERAGE-001, PAY-001, SYNC-001 |
| 2 | Builds and fills the schedule. | SCHEDULE-001, COVER-002 |
| 3 | Covers call-outs and swaps. | COVER-001, COVER-003, COVERAGE-001 |
| 4 | Clocks time and breaks. | TIME-001, BREAK-001 |
| 5 | Watches labor cost. | COST-001, COST-002 |
| 6 | Sends approved hours to payroll. | SYNC-001, GUSTO-001 |
| 7 | 100% free and open source. MIT licensed. | BASE-001 |
| 8 | One week, three cafes, 64 people. | TEAM-001, SCHEDULE-003 |
| 9 | Built from what Saturday will sell: Square forecast, last week and nobody over 40. | POS-001, DEMAND-001, OPT-001, SCHEDULE-002 |
| 10 | Each day's cost against budget. | COST-001, DASH-001 |
| 11 | Out in English and Spanish, by app or text. | NOTICE-001, LANG-001, MOBILE-001 |
| 12 | Each person confirms their shifts. | ROSTER-003 |
| 13 | PIN and photo at the kiosk. | CLOCK-001, CLOCK-005 |
| 14 | Meals timed against California rules with a late-meal premium. | BREAK-001, POLICY-003 |
| 15 | Phone location at punch only, inside the geofence. | CLOCK-003 |
| 16 | Staff swap and pick up shifts from phones after skills, hours and overtime checks. | COVER-001, COVER-002, PEOPLE-002, COST-002 |
| 17 | Coverage agent finds qualified people without overtime and asks in their own language. | COVERAGE-001, NOTICE-001, LANG-001 |
| 18 | Coverage closes only at a clock-in. | COVER-003, CLOCK-004 |
| 19 | Call-out changes reach payroll drafts and paid sick leave balances. | COVERAGE-001, LEAVE-003, PAY-001 |
| 20 | Extra hours that cost no overtime, under budget at all three cafes. | COST-001, COST-002, TEAM-001 |
| 21 | Square card tips split over actual hours; everyone sees their own share. | POS-001, TIPS-001, EARN-001 |
| 22 | Payroll agent clears six exceptions before noon cutoff. | CUTOFF-001 |
| 23 | 64 approved timesheets sent to Gusto and matched line for line. | GUSTO-001, SYNC-001 |
| 24 | Moved off Deputy in a weekend: people, cafes, availability, sick balances, future shifts and three and a half years of timesheets. | MIGRATE-001, MIGRATE-002 |
| 25 | Migration previewed and checked before anything changes; historical hours reconcile. | MIGRATE-001, MIGRATE-002 |
| 26 | Gusto keeps hires and pay rates, matches payroll IDs and starts a text invitation. | GUSTO-001, PAYSYNC-001, PAYSYNC-002, PAYSYNC-003, PEOPLE-003 |
| 27 | Run Lanyard on your computer from the published install command. | BASE-001 |
| 28 | Opened on time. Paid right on Friday. | COVERAGE-001, SYNC-001, GUSTO-001 |

## Status

Judged from the code and tests at commit `2b4aa42d25122df7ca5e209893d8182fb367eb07` (28 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 8 | 8 | 0 | 16 |
| Target and push further | 48 | 40 | 40 | 128 |
| All | 56 | 48 | 40 | 144 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `ACCESS-001` | Native sessions and server-side authority | published | done | `tests/lanyard.test.mjs` — "native access, owner-only grants, staff isolation, CSRF and immediate revocation"; `tests/lanyard.test.mjs` — "staff cannot change the sign-in email to another person’s staff identity"; `tests/lanyard.test.mjs` — "availability, approved leave, conflicts, exact roster publication and personal confirmation"; `tests/lanyard.test.mjs` — "TIME-008: a manager filters a 60-person week to clean timesheets and approves the shown revisions at once; changed, own, foreign-cafe and unfiltered items are skipped with reasons"; `tests/lanyard.test.mjs` — "AUDIT-001 and PAYROLL-001: each roster-to-payroll decision keeps actor, role, subject and time; a stale concurrent export leaves no orphan event or claim; payroll claims once with immutable downloads and signed correction delta" |  |
| `PEOPLE-001` | Staff lifecycle and payroll identities | published | partial | `tests/lanyard.test.mjs` — "native access, owner-only grants, staff isolation, CSRF and immediate revocation"; `tests/lanyard.test.mjs` — "staff CSV dry run, exact reviewed apply, original journal, undo and native edit preservation; AUDIT-001 import actions keep actor, role, subject and time" | Missing a workforce lifecycle journey that rejects duplicate email/payroll identities and then reads the person's retained shifts/hours after deactivation. The cited native-access and import journeys show sign-in, deactivation and edited imported staff, but do not perform this complete lifecycle. |
| `MOVE-001` | Reviewed Staff CSV move-in | published | done | `tests/lanyard.test.mjs` — "staff CSV dry run, exact reviewed apply, original journal, undo and native edit preservation; AUDIT-001 import actions keep actor, role, subject and time" |  |
| `ROSTER-001` | Availability and explicit leave decisions | published | partial | `tests/lanyard.test.mjs` — "availability, approved leave, conflicts, exact roster publication and personal confirmation" | Missing a leave-decision journey that attempts the published-shift conflict and reads the decision actor and retained absence. The cited availability/leave journey shows approval and a roster conflict after leave, not the inverse leave conflict after publication. |
| `ROSTER-002` | Conflict-checked revision publication | published | partial | `tests/lanyard.test.mjs` — "availability, approved leave, conflicts, exact roster publication and personal confirmation"; `tests/lanyard.test.mjs` — "SCHEDULE-006: after a week is published, a moved shift, an approved swap and a canceled shift each keep a history the manager and the affected employees read with who, when, why and the notice state; the first and latest revisions compare by person and site; the change log exports" | Missing a roster-publication journey under both company policies. The cited publication/history journeys show native manager decisions and superseded records; the agent commitment-class decision is not implemented. |
| `ROSTER-003` | Personal published schedule confirmation | published | partial | `tests/lanyard.test.mjs` — "availability, approved leave, conflicts, exact roster publication and personal confirmation"; `tests/lanyard.test.mjs` — "SCHEDULE-006: after a week is published, a moved shift, an approved swap and a canceled shift each keep a history the manager and the affected employees read with who, when, why and the notice state; the first and latest revisions compare by person and site; the change log exports" | Missing a personal-confirmation journey that tries both a foreign and superseded shift confirmation and reads the refusal without changing the assignment. The cited publication/history journeys confirm a personal current shift and read later history, but never try those two refusals. |
| `TIME-001` | Identity-bound phone capture and replay | published | done | `tests/lanyard.test.mjs` — "CLOCK-002: ordered clock retries bind identity, retain conflicting captures for scoped review, respect revocation and use capture-date rounding" |  |
| `TIME-002` | Exact time approval and linked corrections | published | partial | `tests/lanyard.test.mjs` — "TIME-003: a missed clock-out opens an exception the employee corrects with an attestation, another manager approves and a manager resolves with a reason the employee reads; a manager edit makes a pinned bulk approval skip it; employee confirmation and requests leave the unconfirmed state"; `tests/lanyard.test.mjs` — "AUDIT-001 and PAYROLL-001: each roster-to-payroll decision keeps actor, role, subject and time; a stale concurrent export leaves no orphan event or claim; payroll claims once with immutable downloads and signed correction delta" | Missing a correction journey that attempts payroll while its source has a pending correction and checks that no obsolete source exports. The cited correction/roster-to-payroll journeys show retained originals, reasoned approval and signed differences after approval; they do not attempt that dangerous pending interval. |
| `PAYROLL-001` | Reviewed once-only payroll files and signed adjustments | published | done | `tests/lanyard.test.mjs` — "AUDIT-001 and PAYROLL-001: each roster-to-payroll decision keeps actor, role, subject and time; a stale concurrent export leaves no orphan event or claim; payroll claims once with immutable downloads and signed correction delta" |  |
| `PAYROLL-002` | Explicit manual provider acknowledgment | published | partial | `tests/lanyard.test.mjs` — "AUDIT-001 and PAYROLL-001: each roster-to-payroll decision keeps actor, role, subject and time; a stale concurrent export leaves no orphan event or claim; payroll claims once with immutable downloads and signed correction delta" | Missing an acknowledgment journey that reloads and checks the saved provider reference, decision actor/time, draft refusal and stale-revision refusal. The roster-to-payroll journey records one reference and checks its audit actor/time, but does not read that saved reference or attempt the two refusals. |
| `AGENT-001` | Delegated workforce actions and reduced preparation context | published | partial | `tests/lanyard.test.mjs` — "agent prepares drafts but cannot approve through any human or agent door; key revocation is immediate" | The cited preparation-key journey proves reduced context, human decisions and revocation. Missing: a company-policy journey for the same workforce decisions through both doors, including the all-autonomous policy; the current hard-coded preparation restriction does not prove it. |
| `ARCHIVE-001` | Complete installation archive with authority exclusions | published | done | `tests/archive.test.mjs` — "ARCHIVE-001, AUDIT-001, LOG-001, SCHEDULE-004, PAY-009, PAYRULE-002, PAYRULE-003, CLOCK-005, CLOCK-003, PRIVACY-001, LEAVE-003 and TRADEOFF-001: public CLI archive round trip carries staff, schedules, corrected payroll and import history, excludes authority, refuses damaged or populated stores, keeps activity across restart and restore, and respects erasure" |  |
| `ERASE-001` | Unused identity erasure and restore fence | published | done | `tests/lanyard.test.mjs` — "unused identity erasure removes personal values and fences recreation; used identities remain retained"; `tests/archive.test.mjs` — "ARCHIVE-001, AUDIT-001, LOG-001, SCHEDULE-004, PAY-009, PAYRULE-002, PAYRULE-003, CLOCK-005, CLOCK-003, PRIVACY-001, LEAVE-003 and TRADEOFF-001: public CLI archive round trip carries staff, schedules, corrected payroll and import history, excludes authority, refuses damaged or populated stores, keeps activity across restart and restore, and respects erasure" |  |
| `AUDIT-001` | Durable decisions and transactional history | published | done | `tests/lanyard.test.mjs` — "AUDIT-001 and PAYROLL-001: each roster-to-payroll decision keeps actor, role, subject and time; a stale concurrent export leaves no orphan event or claim; payroll claims once with immutable downloads and signed correction delta"; `tests/lanyard.test.mjs` — "staff CSV dry run, exact reviewed apply, original journal, undo and native edit preservation; AUDIT-001 import actions keep actor, role, subject and time"; `tests/archive.test.mjs` — "ARCHIVE-001, AUDIT-001, LOG-001, SCHEDULE-004, PAY-009, PAYRULE-002, PAYRULE-003, CLOCK-005, CLOCK-003, PRIVACY-001, LEAVE-003 and TRADEOFF-001: public CLI archive round trip carries staff, schedules, corrected payroll and import history, excludes authority, refuses damaged or populated stores, keeps activity across restart and restore, and respects erasure" |  |
| `PUBLIC-001` | Public run site and installed Lobby | published | done | `tests/lanyard.test.mjs` — "PUBLIC-001: installed Lobby follows the durable owner claim before first-run confirmation while private product data stays session-protected"; `tests/site/site.test.mjs` — "PUBLIC-001: the run site leads to installation and readable owner guides at 1440 and 390" |  |
| `BASE-001` | Maintained installation and operations commands | published | partial | `tests/installation-journey.mjs` — "top-level installation command journey"; `tests/hosted-installation-journey.mjs` — "hostedInstallation" | Missing an exact-candidate workforce installation journey covering the documented commands, isolated reset and retained-owner archive. The named installation and hosted journeys describe this flow, but Verify does not invoke those installation journeys on this candidate; prior hosted receipts cannot prove this SHA. |
| `TEAM-001` | Multi-location roles and delegated management | target | partial | `tests/organization-journey.mjs` (organizationApi): owner-only hierarchy, shared employee eligibility, invalid relationships, stale revisions, retained history, publication refusal outside eligibility and restart. (organizationAccessApi): editable defaults, independent draft, time and payroll permissions, explicit business locations, department refusals, scoped bulk approval skips, live revocation, native-manager refusal of organization level edits, grants and revocations with unchanged assignments and audit, retained owner revocations and permitted local administration, unchanged refused writes, wage-redacted interval totals and payroll download authority. (organizationBrowser), registered by the named TEAM-001 Settings test in `tests/lanyard.test.mjs`: native Settings, cross-site drafts, time approval, payroll export and interval reports; changed screens captured at 1440 and 390.  `tests/audit-report-journey.mjs` (auditDelegation, inside auditApi): named bounded API grants, current scope, independent wage review, attributed reads and downloads, operational refusal, expiry and active-session revocation. | Owner-only organization Settings persist businesses, locations, departments and multi-location employee eligibility with retained revisions. Editable per-location role defaults, explicit site assignments, business and department checks, cross-site drafts, separate time approval and hours-only payroll authority, scoped payroll downloads and wage-redacted interval reports are implemented. Remaining: native-manager scope replacement, full role coverage of administrative and read doors, department-scoped reports and complete role-flow proof. Location timezones are retained as metadata; scheduling still uses the installation timezone (SCHEDULE-003). Adopted conservative policy pending ct: only the owner initializes defaults and administers organization-scoped levels; defaults grant nothing until configured; each business-level assignment explicitly names one location. Owner-only native restoration remains. POLICY-002 requires delegated policy administration and consequence reviews limited to permitted sites under TEAM-001 and ACCESS-003; private wage access requires its separate permission. The native owner-only fair-workweek review remains interim, and this delegated duty remains unproved. **Gap — TEAM-001 and ACCESS-003:** Owner-issued named read-only API audit grants now check business, site, employee, jurisdiction, class, period, purpose and end date, with separate wage review, live scope, revocation and attributed reads and downloads. Dedicated grant administration screens, grantors beyond the owner, private policy and leave source classes, and complete delegated duty coverage remain unproved. Auditor assignments replace operational authority, including after expiry or revocation; they are intended for a dedicated named audit identity. |
| `TEAM-002` | Scoped private leave administration | target | missing | `tests/organization-journey.mjs` (organizationApi): owner-only hierarchy, shared employee eligibility, invalid relationships, stale revisions, retained history, publication refusal outside eligibility and restart. (organizationAccessApi): editable defaults, independent draft, time and payroll permissions, explicit business locations, department refusals, scoped bulk approval skips, live revocation, native-manager refusal of organization level edits, grants and revocations with unchanged assignments and audit, retained owner revocations and permitted local administration, unchanged refused writes, wage-redacted interval totals and payroll download authority. (organizationBrowser), registered by the named TEAM-001 Settings test in `tests/lanyard.test.mjs`: native Settings, cross-site drafts, time approval, payroll export and interval reports; changed screens captured at 1440 and 390.  `tests/audit-report-journey.mjs` (auditDelegation, inside auditApi): named bounded API grants, current scope, independent wage review, attributed reads and downloads, operational refusal, expiry and active-session revocation. | Missing a complete delegated private-bank and purpose journey; current sick-leave journeys exercise owner-only administration. |
| `TEAM-003` | Named read-only audit grants | target | partial | `tests/organization-journey.mjs` (organizationApi): owner-only hierarchy, shared employee eligibility, invalid relationships, stale revisions, retained history, publication refusal outside eligibility and restart. (organizationAccessApi): editable defaults, independent draft, time and payroll permissions, explicit business locations, department refusals, scoped bulk approval skips, live revocation, native-manager refusal of organization level edits, grants and revocations with unchanged assignments and audit, retained owner revocations and permitted local administration, unchanged refused writes, wage-redacted interval totals and payroll download authority. (organizationBrowser), registered by the named TEAM-001 Settings test in `tests/lanyard.test.mjs`: native Settings, cross-site drafts, time approval, payroll export and interval reports; changed screens captured at 1440 and 390.  `tests/audit-report-journey.mjs` (auditDelegation, inside auditApi): named bounded API grants, current scope, independent wage review, attributed reads and downloads, operational refusal, expiry and active-session revocation. | Owner-issued bounded API delivery is shown by auditDelegation. Missing: dedicated grant screens, other grantors, private policy and leave classes, and the complete delegated class journey. |
| `PEOPLE-002` | Jobs qualifications preferences and effective pay rates | target | done | `tests/lanyard.test.mjs` — "PEOPLE-002: qualifications, expiring certificates, preferences, effective job rates, retained costs and inherited template/swap/pickup checks through HTTP"; `tests/lanyard.test.mjs` — "PEOPLE-002: retained rate costs in schedule/grid, interval reports and time review at 1440 and 390" |  |
| `PEOPLE-003` | Phone-number staff accounts and text invitations | target | missing |  | Staff records require a unique email; no SMS invitation, phone verification or text-code sign-in exists. |
| `CONTACT-001` | Emergency contacts on the shift and employee card | target | done | `tests/lanyard.test.mjs` — "CONTACT-001: staff keep their own emergency contacts; the cafe manager opens a no-show alert for that person and calls from the audited card; another cafe’s manager and a coworker are refused and both attempts are audited" |  |
| `ACCESS-002` | Manager single sign-on and required second factor | target | partial | `src/modules/operator-auth/identity/oidc/presets.mjs`; `src/modules/operator-auth/identity/index.mjs` | Shared OIDC provider presets exist in the auth module; Lanyard neither configures nor tests manager single sign-on, and no role-required second factor exists. |
| `ACCESS-003` | Custom access levels | target | partial | `tests/organization-journey.mjs` (organizationApi): owner-only hierarchy, shared employee eligibility, invalid relationships, stale revisions, retained history, publication refusal outside eligibility and restart. (organizationAccessApi): editable defaults, independent draft, time and payroll permissions, explicit business locations, department refusals, scoped bulk approval skips, live revocation, native-manager refusal of organization level edits, grants and revocations with unchanged assignments and audit, retained owner revocations and permitted local administration, unchanged refused writes, wage-redacted interval totals and payroll download authority. (organizationBrowser), registered by the named TEAM-001 Settings test in `tests/lanyard.test.mjs`: native Settings, cross-site drafts, time approval, payroll export and interval reports; changed screens captured at 1440 and 390. Existing ACCESS-003 draft, swap, ceiling, contact, restoration and audit proof: `tests/access-chat-kiosk-journey.mjs` (accessApi, surfaceBrowser).  `tests/audit-report-journey.mjs` (auditDelegation, inside auditApi): named bounded API grants, current scope, independent wage review, attributed reads and downloads, operational refusal, expiry and active-session revocation. | Custom assignments, including revoked unarchived assignments, continue to replace native manager authority. Implemented roster, swap, leave, time and hours-only payroll commands now check explicit sites and each target's department membership; business levels can be assigned only at registered locations of that business. Generated payroll sources are checked before persistence; file reads recheck current export and wage permissions. Editable TEAM-001 role defaults start without permissions. Scoped draft, approval, payroll and wage-redacted whole-site interval report doors are available through Access. Remaining: full catalog coverage including people, integrations, tip management, payroll submission, delegated contact reads, department reports, other read doors. Unknown administrative doors and unsupported reads remain refused; preparation keys retain separate scopes. Managers still administer ordinary levels and grants only at their own cafe and for its people; only the owner first converts a native manager or restores native authority, archiving every grant with permission history. Adopted conservative policy pending ct: only the owner initializes defaults and administers business or department levels, role defaults deny until explicitly configured, and business-level assignments name one location each. POLICY-002 requires delegated policy administration and consequence reviews limited to permitted sites under TEAM-001 and ACCESS-003; private wage access requires its separate permission. The native owner-only fair-workweek review remains interim, and this delegated duty remains unproved. **Gap — TEAM-001 and ACCESS-003:** Owner-issued named read-only API audit grants now check business, site, employee, jurisdiction, class, period, purpose and end date, with separate wage review, live scope, revocation and attributed reads and downloads. Dedicated grant administration screens, grantors beyond the owner, private policy and leave source classes, and complete delegated duty coverage remain unproved. Auditor assignments replace operational authority, including after expiry or revocation; they are intended for a dedicated named audit identity. |
| `JOURNAL-001` | Employee notes and manager journal | target | done | `tests/lanyard.test.mjs` — "JOURNAL-001: a cafe manager keeps a private note with an attachment and a shared note on an employee; another cafe’s manager, the employee and an agent read only what each may; an edit keeps its version" |  |
| `SCHEDULE-001` | Editable visual schedules and publication review | target | done | `tests/lanyard.test.mjs` — "SCHEDULE-001: live review is read-only, persists conflicts and budgets, counts roles/sites/gaps and preserves duplicate diff rows"; `tests/lanyard.test.mjs` — "SCHEDULE-001: visual service-week editing, resize, copy, bulk assignment, undo and reviewed publish work at 1440 and 390" |  |
| `SCHEDULE-002` | Reusable templates recurring shifts and duplication | target | done | `tests/lanyard.test.mjs` — "SCHEDULE-002: a saved week is applied to a holiday week at the same wall times, a recurring shift skips its exception date, conflicts name the person now on leave, one occurrence is edited and published while earlier weeks stay unchanged"; `tests/lanyard.test.mjs` — "SCHEDULE-002 and COVER-002: position-only templates add to an empty week privately, retain draft slots, publish without assigned shifts and fill once; assigned edits preserve positions and archive superseded draft rows"; `tests/lanyard.test.mjs` — "SCHEDULE-002 and COVER-002: a manager saves, applies, reviews and publishes a position-only week, then fills an employee pickup at 1440 and 390" |  |
| `SCHEDULE-003` | Cross-site coverage and double-booking prevention | target | partial | `src/lanyard/domain/roster.ts`; `src/lanyard/domain/settings.ts` | Global overlaps and a single venue timezone exist; sites, multiple local calendars, travel/rest and cross-site cost/coverage controls do not. |
| `SCHEDULE-004` | Shift instructions checklists and blocker handovers | target | done | `tests/lanyard.test.mjs` — "SCHEDULE-004: native shift handover keeps revisioned notes/checklists and immutable blockers; reassignment, offers, cancellation and supersession fence instructions while authors retain their own responses"; `tests/lanyard.test.mjs` — "SCHEDULE-004 / SCHEDULE-007: blocker files, immutable job-area reconciliation, labor costs and once-only split payroll with signed corrections through native HTTP"; `tests/lanyard.test.mjs` — "SCHEDULE-004 / SCHEDULE-007: managers publish counter/kitchen handovers, staff complete tasks with blocker files and managers reconcile labor and export payroll at 1440 and 390" |  |
| `SCHEDULE-007` | Reconciled job and area segments | target | done | `tests/lanyard.test.mjs` — "SCHEDULE-004 / SCHEDULE-007: blocker files, immutable job-area reconciliation, labor costs and once-only split payroll with signed corrections through native HTTP"; `tests/lanyard.test.mjs` — "SCHEDULE-004 / SCHEDULE-007: managers publish counter/kitchen handovers, staff complete tasks with blocker files and managers reconcile labor and export payroll at 1440 and 390" |  |
| `LEAVE-001` | PTO balances and staffing-aware time off | target | partial | `src/lanyard/domain/people.ts`; `tests/lanyard.test.mjs` | Dated leave request/approval exists; balances, accruals, policy and payroll/HR mapping are absent. |
| `AVAIL-001` | Recurring availability preferences and approval | target | done | `tests/lanyard.test.mjs` — "AVAIL-001: a staff weekly pattern waits for approval, lists the published shift it collides with, governs only from its first day, flags unavailable blocks, exception dates and the weekly maximum, and ranks a preferred teammate first for cover"; `tests/lanyard.test.mjs` — "AVAIL-001: staff saving and managers approving a lower weekly maximum see the affected published shift at 1440 and 390" |  |
| `LEAVE-002` | Time-off blackout dates limits and team leave calendar | target | done | `tests/lanyard.test.mjs` — "LEAVE-002: a holiday blackout refuses requests, a two-server limit routes the third approval to an override with a reason, and the team leave calendar and allowed dates show it to managers and staff" |  |
| `LEAVE-003` | Paid sick and safe leave jurisdiction presets | target | done | `tests/sick-journey.mjs` — "sickApi"; `tests/sick-journey.mjs` — "sickBrowser"; `tests/sick-journey.mjs` — "sickEmployerCoverage"; `tests/sick-journey.mjs` — "sickReasons"; `tests/sick-eligibility-journey.mjs` — "sickEligibilityJourney"; `tests/sick-eligibility-journey.mjs` — "sickQualifyingJourney"; `tests/archive.test.mjs` — "public CLI archive round trip" |  |
| `LEAVE-004` | Separate NYC supplemental unpaid leave | target | done | `tests/sick-journey.mjs` — "sickSupplement" (invoked by sickApi); `tests/archive.test.mjs` — "public CLI archive round trip" |  |
| `LEAVE-005` | Separate New York prenatal bank | target | done | `tests/sick-journey.mjs` — "sickPrenatal" (invoked by sickApi); `tests/archive.test.mjs` — "public CLI archive round trip" |  |
| `LEAVE-006` | Voluntary Oregon bank donations | target | done | `tests/sick-journey.mjs` — "sickDonations"; `tests/sick-journey.mjs` — "sickBrowser"; `tests/archive.test.mjs` — "public CLI archive round trip" |  |
| `MINOR-001` | Minor work-hour limits and permits | target | partial | `tests/minors-journey.mjs` (minorApi): school-day, school-week and evening refusal across publication, offers, swaps, cover and clock; separate 17-year-old state treatment; actual and planned interval deduplication, pending and current correction handling, retained manual-work warnings, Colorado rolling-24-hour refusal, California non-school 00:30 boundary, unknown full-week and next-day calendar refusal, and expired-permit refusal; private birth and permit versions and coworker, manager and agent refusals. `tests/minors-journey.mjs` (minorBrowser): owner records, named scheduler conflicts and coworker privacy at 1440/390. `tests/minors-journey.mjs` (minorAuthorizations, invoked by minorApi): missing and wrong-workplace permit refusal and current review acceptance in California, New York, Illinois, Washington and Oregon; permit-specific hour limits; expired consent, complete late supervision and refusal of underage or deactivated supervisors; Washington class-release boundaries and six-hour and 28-hour special variance caps; New York late-work parent and next-school-day consent; review invalidation, private history, clock-in refusal after revocation and retained worked time at clock-out. `tests/minors-journey.mjs` (minorAuthorizations and minorWorkplaces): both review orders for daily, weekly and clock-window limits; New York wrong-workplace and missing-parent refusal; manual worked sites, away-shift closure, refused transfers and individually checked retained segments. | Complete maintained state-rule coverage remains unproved: school-plus-work limits beyond Illinois, additional next-day, school-release, supervision, consent and variance variants, and authority-specific permit conditions. Owner-only document reviews retain employer assertions, not issuing-authority verification or live adult presence. RL-104 resolves evidence semantics without claiming verified authority, live supervision or completion. |
| `SCHEDULE-005` | Printable and posted schedules | target | done | `tests/lanyard.test.mjs` — "SCHEDULE-005: a manager prints cafe and employee PDFs stamped with the revision, opens the wall display, and a later change moves the wall and marks both copies superseded; pay and leave reasons never print"; `tests/lanyard.test.mjs` — "SCHEDULE-004 / SCHEDULE-007: blocker files, immutable job-area reconciliation, labor costs and once-only split payroll with signed corrections through native HTTP" |  |
| `SCHEDULE-006` | Schedule change history and revision compare | target | done | `tests/lanyard.test.mjs` — "SCHEDULE-006: after a week is published, a moved shift, an approved swap and a canceled shift each keep a history the manager and the affected employees read with who, when, why and the notice state; the first and latest revisions compare by person and site; the change log exports"; `tests/lanyard.test.mjs` — "SCHEDULE-006: repeated approved swaps retain every assignment, decision reason and acknowledgment for original and later assignees in history and CSV"; `tests/lanyard.test.mjs` — "SCHEDULE-006: managers and original assignees read both swaps and all acknowledgments at 1440 and 390" |  |
| `COVER-001` | Employee shift swaps with final approval | target | done | `tests/lanyard.test.mjs` — "COVER-001: staff propose a two-person exchange, the coworker consents and a cafe manager approves; ineligible, unavailable, stale and competing swaps are refused and the original assignee keeps the shift until approval" |  |
| `COVER-002` | Open shifts offers and pickup | target | done | `tests/lanyard.test.mjs` — "COVER-002: a manager posts an open shift that eligible staff see with their rate and request; approving one assigns it once and closes the rest; approved pickup and a pool; a template position-only row posts as an open shift"; `tests/lanyard.test.mjs` — "SCHEDULE-002 and COVER-002: position-only templates add to an empty week privately, retain draft slots, publish without assigned shifts and fill once; assigned edits preserve positions and archive superseded draft rows"; `tests/lanyard.test.mjs` — "SCHEDULE-002 and COVER-002: a manager saves, applies, reviews and publishes a position-only week, then fills an employee pickup at 1440 and 390" |  |
| `COVER-003` | Call-out replacement and verified coverage | target | done | `tests/coverage.test.mjs` — "COVER-003 / SCHEDULE-001: preferred in-app offers expire; exact approvals retain assignments and history through a scoped no-show reoffer until a real clock verifies coverage" |  |
| `COVER-004` | Offer order and access-to-hours priority | target | done | `tests/lanyard.test.mjs` — "COVER-004: a two-tier open shift by part-time priority: tier two waits, tier one declines and expires, tier two accepts and is approved; the offer log keeps times and answers; seniority and custom rankings; tiered call-out replacements; at an access-to-hours cafe a new hire is flagged until existing part-time staff are offered the hours" |  |
| `ROSTER-004` | Team schedule visibility for staff | target | done | `tests/lanyard.test.mjs` — "ROSTER-004: staff see their cafe’s published team by name, position and times only; a manager narrows a cafe to own position and hides a person" |  |
| `NOTICE-001` | Delivered schedule notices and acknowledgment | target | missing |  | No schedule notification outbox, push/SMS providers, delivery receipts, recipient language or contact-preference workflow. Native access invitations are separate. |
| `NOTICE-002` | Reminders escalation and payroll follow-up | target | done | `tests/lanyard.test.mjs` — "durable in-Lanyard reminders survive cron replay and restart, withdraw on resolution and escalate once"; `tests/lanyard.test.mjs` — "reminder inbox and manager settings work on Schedule and Time at 1440 and 390"; `tests/lanyard.test.mjs` — "reminders follow a changed revision, a missed meal, a closed offer and owner-only escalation" |  |
| `NOTICE-003` | Reminder delivery under employee contact settings | target | missing |  | Depends on NOTICE-001 contact preferences; NOTICE-002 reminders are in Lanyard only. |
| `CHAT-001` | Team messaging and operational handover | target | partial | `tests/access-chat-kiosk-journey.mjs` (chatApi): announcement and shift handover, direct and group privacy, text search, idempotent acknowledgment, authenticated attachment, immediate transfer and deactivation and formal COVER-001 approval; `tests/access-chat-kiosk-journey.mjs` (surfaceBrowser): staff acknowledgment and search at 1440/390. `tests/access-chat-kiosk-journey.mjs` (chatApi): unlisted-owner refusal without writes, revoked-manager chat refusal and restoration, returning-member history and superseded-row handover readership. `tests/chat-membership-journey.mjs` (chatMembershipApi, chatMembershipBrowser): reviewed removal, stale and unauthorized refusal without writes, immediate content and command fences, restart and return, retained authorized history, voluntary self-departure, refusal of another member identifier or stale revision, and native removal and departure forms at 1440 and 390. `tests/chat-membership-journey.mjs` (chatMembershipApi) additionally proves last-listed-native-owner refusal without record, command, version or event writes, departure with another listed native owner, ownerless-group self-departure without takeover, exact receipt revisions, native-owner-only receipt reads without thread readership, and receipt exclusion from departure responses and non-owner activity. The same journey preserves removal after restart, deactivation, reactivation and cafe return. (chatMembershipBrowser) proves last-owner refusal and ordinary member departure at 1440 and 390, including the account tooltip. | Operational direct, group, site and shift threads, announcements, attachments, acknowledgment and search and current membership checks are built. Interim policy (ct-approved 22 Oct 2026 at c42e190): direct and group readers are the listed members, checked live each time as active and currently at the thread's cafe; members are fixed at creation except for explicit reviewed removal or voluntary departure, and a still-listed member who returns regains the thread's history. Site and announcement threads are cafe records readable by current cafe members, including earlier history. Announcements are written by the owner and unconverted cafe managers. Shift threads are read by the current assignee of the linked shift record (swaps carry the thread; a superseded revision keeps its last assignee) and by unconverted cafe managers. A transfer immediately removes access at the old cafe. In the app and API the owner reads no direct or group thread unless listed; thread content still travels in the owner's ARCHIVE-001 installation archive. No external notifications are sent. Private HR and payroll facts have no automatic share door, and free text cannot be certified free of them. Nothing is deleted automatically: retention, legal holds and erasure of messages and attachments ship under PRIVACY-001. Membership policy approved with riders by ct on 26 October 2026: only the native installation owner who is currently listed, active and eligible at the group’s cafe may explicitly remove another group member. A current native listed group member may explicitly leave only themselves without owner approval, subject to last-owner protection. Both operations require an explicit reason and the exact current thread revision, recheck live authority and eligibility when committed, and retain an owner-private receipt containing actor, target, reason, revision, time and before and after membership. The receipt grants no thread-content access and contains no copied message content or attachments. Ordinary members, removed people, managers and agents gain no receipt-reading authority from participation or authorship. Stale or unauthorized attempts change no membership. Removal and departure immediately deny subsequent history, search, attachment, sending and acknowledgment requests through existing sessions and survive restart, reactivation and return to the cafe. Unrelated authorized work remains accessible. Future queued notifications and content exports must recheck current eligibility; previously delivered or downloaded external copies cannot be recalled. The owner’s installation archive remains governed separately by ARCHIVE-001 and grants no native thread access. Neither operation adds members, grants history or restores removed membership. A still-listed member returning to the cafe retains the existing history policy; a removed or departed member does not rejoin automatically. Refuse an operation that removes the last listed native owner. Existing ownerless groups gain no replacement owner, automatic member or unlisted-owner takeover authority; eligible non-owner members may leave. This is approval of product defaults, not implementation, provider or legal proof. CHAT-001 remains partial. Implementation detail: a departing native owner must leave another listed active native installation owner; that authority is rechecked in the membership transaction. The owner-private receipt door returns membership facts only, independently of thread readership. Named Gaps: complete group member management, including reviewed additions, rejoining and historical readership; safe final-owner exit and ownerless-group recovery; site and shift thread breadth across cafes; eligibility enforcement for future notifications and content exports; and PRIVACY-001 message and attachment retention, legal holds, erasure and external-copy handling. Private HR and payroll facts remain outside broad team threads; absence of an automatic share door does not certify free text free of those facts. All original CHAT-001 acceptance points remain required. |
| `CAL-001` | Google and Outlook calendar subscriptions | target | missing |  | No calendar feeds or Google/Outlook subscription workflow. |
| `FEEDBACK-001` | Post-shift employee feedback | target | done | `tests/lanyard.test.mjs` — "FEEDBACK-001: after clock-out a low rating with a safety flag, an anonymous comment and a skip reach the cafe manager, who resolves the flag with a reply the employee sees; the trend shows and the author stays hidden from pay, ranking and agents" |  |
| `LOG-001` | Manager logbook and shift handover log | target | done | `tests/logbook.test.mjs` — "LOG-001: a cafe manager writes a closing entry and an incident with five 10 MB attachments, enforcing bounds and reader access, mentioning the opening manager and linking the shift and person; the opening manager reads and acknowledges it; a search by category and month finds the incident and it exports; another cafe’s manager and staff see nothing; a correction keeps the original" |  |
| `MOBILE-001` | Employee and manager mobile apps | target | partial | `src/lanyard/ui/index.ts`; `src/lanyard/ui/shared.ts`; `src/lanyard/ui/commands.ts` | Responsive English web and page clock retry exist; native apps, push, Spanish, full employee self-service and accessibility/device acceptance are absent or unproven. |
| `MOBILE-002` | Manager mobile approvals and live attendance | target | partial | `src/lanyard/ui/time.ts`; `src/lanyard/ui/shared.ts` | Responsive manager time and leave forms exist; no native manager app, live attendance board, push deep links, punch photos or bulk approval. |
| `LANG-001` | Spanish staff experience and notices | target | missing |  | All screens and messages are English only; no language preference, Spanish text or translation check. |
| `CLOCK-001` | Shared kiosk clocks and device authority | target | partial | `tests/access-chat-kiosk-journey.mjs` (kioskApi): isolated PIN/session verification, native-session termination on shared-device handoff, Spanish preference, consent refusal, private photo byte custody, an explicit camera/consent-failure exception and TIME-008 bulk-approval refusal, timed meal, retained receipts and idempotency, Worker restart, consecutive users, device revocation and guessing lock; `tests/access-chat-kiosk-journey.mjs` (surfaceBrowser): kiosk identity and sign-out at 1440/390. `tests/access-chat-kiosk-journey.mjs` (kioskOffline): encrypted page/Worker restart, ordered replay, no duplicate time, revocation before employee retry, count-only owner recovery and reasoned resolution without applying time; (kioskSegmentApi): qualified Counter/Kitchen segments at their retained rates, split payroll and PIN/deactivation revocation. Hardware and the remaining variants are not proved. `tests/access-chat-kiosk-journey.mjs` (kioskApi): the sixth verification for one person in the 15-minute window is refused across devices without any session, business or security-counter write. | Owner-enrolled devices, personal PIN verification, own-only state, English/Spanish clock controls, consented photo receipts and device revocation are built. Encrypted page/Worker restart, ordered replay, revocation-before-retry/count-only owner recovery, captured/payable TIME-005 rounding and CLOCK-008 job-rate/payroll segments are proved by the named journeys. Interim product defaults (ct-approved 22 Oct 2026 at c42e190; not legal mandates): the owner alone enrolls and revokes devices until CLOCK-001's separate kiosk-administration authority ships. Personal PINs are six digits, stored keyed with the installation secret. Employee sessions last five minutes. Five consecutive failed verifications lock the device, which the owner recovers by revoking and re-enrolling it. Five failures for one person within 15 minutes refuse that person. Device credentials last one year. Photos need the employer's consent at enrollment and the employee's consent on each punch. A refused, failed or declined photo records a named exception. Photos are readable only by the employee and the owner, and travel only in the owner's ARCHIVE-001 installation archive. Nothing is deleted automatically. This does not rule out erasure: owner-set retention and authorized erasure of eligible photos, keeping punch facts and exceptions, ship under CLOCK-005 and PRIVACY-001. No claim is made that the consents satisfy any statute (local legal sign-off required). Remaining for CLOCK-001: separate manager kiosk authority, offline job-transfer variants, physical tablet/camera proof, and full error-message language coverage. Approver photo display and photo retention or erasure stay with CLOCK-005, TIME-009 and PRIVACY-001. |
| `CLOCK-002` | Durable offline capture and reconnect reconciliation | target | done | `tests/lanyard.test.mjs` — "CLOCK-002: ordered clock retries bind identity, retain conflicting captures for scoped review, respect revocation and use capture-date rounding"; `tests/lanyard.test.mjs` — "CLOCK-002: encrypted offline phone capture survives client restart and reconciles exactly once" |  |
| `CLOCK-003` | Geofenced mobile clocking with privacy controls | target | partial | `tests/geofence-journey.mjs` (geofenceApi): native site policy, enrolled device, explicit consent, inside and outside evidence, poor accuracy and denied permission, immutable owner review, private readers, missing evidence, stale-observation refusal, retained policy bounds, holds, explicit expired-coordinate erasure, restart, rejected-capture redaction and revocation including prior retries. (geofenceBrowser): captured location and accuracy beside time, named bulk skip and icon tooltip at 1440 and 390; browser location permission, inside and outside observations, poor accuracy, denied and declined consent without coordinates, and no location request on page load. `tests/archive.test.mjs` (public CLI archive round trip): location restore and independent coordinate-erasure fence, retaining punch facts. | Dedicated site settings and retention controls and separately scoped supervisor review remain unproved. The current API and browser journeys show event-only consent and coordinate-free exceptions under RL-102; physical-device evidence is in the register. |
| `CLOCK-004` | Live attendance and late or no-show alerts | target | done | `tests/lanyard.test.mjs` — "CLOCK-004: a running service shift with an on-time, late, absent and offline employee shows on the live board from received punches; the absent one turns late then no-show, a manager records handling it and finds cover, and only the cover’s clock-in closes the alert" |  |
| `CLOCK-005` | Punch photo verification | target | partial | `tests/photos-journey.mjs` (photoApi): kiosk/second-site native in/out custody, optional break collection refusal, owner review; separate phone/browser and site-wide settings, enrollment-consent fence, spoofed-device and revoked-credential refusal, work-site selection; camera/consent exception, TIME-008 skip, coworker/manager/key refusals, notice, holds and expired/former-employee erasure. `tests/photos-journey.mjs` (photoBrowser): policy/enrollment forms, native/kiosk software-camera stills, camera permission denial and bulk skip, work-site policy, owner approval images and icon tooltips at 1440/390. `tests/clock-offline-journey.mjs` (offlineJourney) and `tests/access-chat-kiosk-journey.mjs` (kioskOffline): photo-required encrypted page/Worker restart, clock/meal replay, revocation and count-only image-free recovery. `tests/archive.test.mjs` (public CLI archive round trip): native/kiosk photo byte restore, held erasure refusal, photo-only old-archive fence and later restore preserving punches without erased images. | ct confirmation of owner-only review, owner-classified device fallback and explicit held retention/erasure remains pending. Scoped manager/manager-mobile photo readers and physical phone/tablet/camera acceptance remain open; software-camera journeys do not establish hardware proof. No automatic deletion or widened readers shipped. |
| `CLOCK-006` | Clock-in and clock-out questions and attestations | target | done | `tests/lanyard.test.mjs` — "CLOCK-006: an owner’s break, injury, cash-tip and fit-for-duty questions are asked in English and Spanish; a missed break opens a break exception, an injury a private safety follow-up for that cafe’s managers, the tip declaration is listed for managers, and an edited question keeps earlier answers under their old wording" |  |
| `CLOCK-007` | Browser time clock on approved networks | target | done | `tests/lanyard.test.mjs` — "CLOCK-007: a cafe’s web clock accepts punches from its approved IP range or an enrolled browser, records only the network, refuses or flags other networks as configured, and a range change applies on the next punch" |  |
| `CLOCK-008` | Mid-shift job and site transfers | target | done | `tests/lanyard.test.mjs` — "CLOCK-008: a phone job change splits the punch into qualified job segments with retained rates, refuses unqualified jobs and ineligible or off-network cafes, exports split payroll with signed per-job corrections and counts every segment toward weekly overtime through native HTTP"; `tests/lanyard.test.mjs` — "CLOCK-008: staff change job from the phone clock and managers approve the job segments with rates and pay codes and export split payroll at 1440 and 390" |  |
| `BREAK-001` | Timed meals breaks and exceptions | target | done | `tests/lanyard.test.mjs` — "BREAK-001: timed rest and meal breaks pass the cafe policy; a short meal and rest open exceptions with premiums and an attestation, a waiver covers a short shift, a pinned timesheet that gains a missed meal is skipped by name, and a reasoned correction reconciles net and premium hours in payroll" |  |
| `BREAK-002` | Automatic meal deductions with employee attestation | target | done | `tests/lanyard.test.mjs` — "BREAK-002: a 30-minute automatic meal deduction is confirmed at clock-out, reversed with an exception when the meal is reported missed, and flagged when left unconfirmed"; `tests/lanyard.test.mjs` — "POLICY-001: reviewed policy settings, California deduction refusal, template warnings, swap rest and locked payroll fences" |  |
| `TIME-003` | Missed punches employee review and exception resolution | target | done | `tests/lanyard.test.mjs` — "TIME-003: a missed clock-out opens an exception the employee corrects with an attestation, another manager approves and a manager resolves with a reason the employee reads; a manager edit makes a pinned bulk approval skip it; employee confirmation and requests leave the unconfirmed state" |  |
| `TIME-004` | Payroll period locks and controlled reopening | target | done | `tests/lanyard.test.mjs` — "TIME-004: the owner defines a pay period, employees and a manager sign off and it locks; an ordinary manager cannot edit or reopen it; the owner reopens with a reason and fresh signoff, a reopened period holds its prepared payroll, and after the provider run closes it a correction is a linked adjustment that leaves the locked record unchanged" |  |
| `TIME-005` | Punch rounding and snap-to-schedule | target | done | `tests/lanyard.test.mjs` — "TIME-005: quarter-hour rounding at one cafe and a 7-minute snap at another pay rounded time beside captured punches, report net minutes, refuse a round-down rule and never alter approved history" |  |
| `TIME-006` | Early clock-in window and unscheduled punches | target | done | `tests/lanyard.test.mjs` — "TIME-006 and TIME-008: an early clock-in is refused with its opening time or flagged, a clock-in without a shift is refused, flagged pending approval or allowed for a listed position, and flagged time is skipped by bulk approval until a manager approves it" |  |
| `TIME-007` | Forgotten clock-out reminder cap and provisional close | target | done | `tests/lanyard.test.mjs` — "TIME-007: a forgotten 9-to-5 clock-out is reminded at 5:15 and provisionally closed at 5:00, held from payroll and bulk approval until the employee corrects it; an unscheduled punch stops at the 12-hour cap"; `tests/lanyard.test.mjs` — "TIME-007: provisional job-segment labor stops at the scheduled end, stays reviewable and is replaced once on confirmation at 1440 and 390" |  |
| `TIME-008` | Bulk timesheet approval with pinned revisions | target | done | `tests/lanyard.test.mjs` — "TIME-008: a manager filters a 60-person week to clean timesheets and approves the shown revisions at once; changed, own, foreign-cafe and unfiltered items are skipped with reasons"; `tests/lanyard.test.mjs` — "BREAK-001: timed rest and meal breaks pass the cafe policy; a short meal and rest open exceptions with premiums and an attestation, a waiver covers a short shift, a pinned timesheet that gains a missed meal is skipped by name, and a reasoned correction reconciles net and premium hours in payroll" |  |
| `TIME-009` | Timesheet approval review with schedule variance | target | partial | `tests/lanyard.test.mjs` — "TIME-009: the approval review shows scheduled, captured and payable times, variance, breaks, network, job, cost and the running week; filtering to exceptions lists the early, missed-meal and off-network rows; an edit keeps the captured facts and a send-back returns to the employee"; `tests/lanyard.test.mjs` — "TIME-009: policy meals, waiver thresholds, full paid-rest counts and unknown manual breaks reconcile beside automatic deductions through native HTTP"; `tests/lanyard.test.mjs` — "TIME-009: managers compare taken and required meals and paid rests and filter exceptions at 1440 and 390"; `tests/lanyard.test.mjs` — "CLOCK-005: kiosk and native stills, private approval review, camera exceptions, bulk skips, holds and explicit expired-photo erasure"; `tests/lanyard.test.mjs` — "CLOCK-005: photo policy, notice, consented camera capture and private approval at 1440 and 390"; `tests/lanyard.test.mjs` — "CLOCK-003: event-only location consent, accuracy, private review, bulk refusal, retention and device revocation through native commands"; `tests/lanyard.test.mjs` — "CLOCK-003: owner sees captured location and bulk exception at 1440 and 390" | Missing the complete scoped-approver review journey with punch photos and geofenced coordinates. The cited review and break journeys show variance, network locations, meals, rests, edits and send-back; the same cited suite also runs owner-only photo/geofence review. Separately scoped supervisor/approver readers and their complete row parity remain owed under CLOCK-003, CLOCK-005 and TEAM-001/ACCESS-003. |
| `POLICY-001` | US overtime meal and rest policy rules | target | partial | `tests/policy-journey.mjs` (policyClassifications, policyBoundaries, policyBrowser: maintained basic scenarios, rule traces, deductions, templates, swaps and 1440 and 390 warnings); `tests/policy-timing-journey.mjs` (policyTimingVariants: recorded meal boundaries and historical versions); `tests/policy-consecutive-journey.mjs` (policyConsecutiveApi: midnight, cafes, workweek context, qualifying meals, release adoption and unknown-meal payroll refusal); `tests/policy-release-journey.mjs` (policyReleaseReview: before-and-after preview, changed-source refusal, retained approval and locked-period fence); `tests/policy-earnings-journey.mjs` (policyEarningsApi, policyEarningsBrowser: retained own pay, double time, period boundaries, hidden estimates and 1440 and 390 end states); `tests/policy-cost-journey.mjs` (policyCostApi, policyCostBrowser: projected actuals, substitutes, pickups, swaps, source scope and 1440 and 390 end states); `tests/policy-settings-journey.mjs` (policySettingsBrowser: catalog, sources, stale preview, applicability, custom rules and account tooltip through Settings at 1440 and 390); `tests/policy-coverage-journey.mjs` (policyCoverageApi: separate reviewed applicability, cross-cafe conflicts, unresolved earnings and risk refusal); `tests/policy-alternate-journey.mjs` (policyAlternateApi, policyAlternateClassificationApi: retained California election, participation, reviewed adoption, elected and extra days, unresolved shortening and private evidence); `tests/policy-regional-journey.mjs` (policyRegionalConfigurationApi, policyRegionalClassificationApi: Alaska approved flex and Nevada mutual schedules, participation and unsupported deviations); `tests/policy-alternate-settings-journey.mjs` (policyAlternateSettingsBrowser: alternate schedules and California employer-day application at 1440 and 390); `tests/policy-workday-journey.mjs` (policyWorkdayApi, policyWorkdayBoundaryApi, policyWorkdayAllocationApi, policyWorkdayDstApi: reviewed employer days, retained closed history, prior-week context, exact approved allocations and pinned daylight-saving boundaries); `tests/policy-rest-days-journey.mjs` (policyRestDaysApi: split service, daily premium cap, recorded rests, untimed sources, prior-week context and unresolved boundary rests, once-only premium ownership across adjacent workweeks and restart); `tests/policy-washington-journey.mjs` (policyWashingtonApi, policyWashingtonBrowser: reviewed normal workdays, additional meal boundaries, unknown eligibility, historical rules, stale approval, private evidence and Settings at 1440 and 390) | Versioned overtime and break timing, New York industry and overnight windows, combined adjacent and short-gap work periods, California employer workdays and daily split-service rests, Colorado consecutive-hours review, digest-bound open-period recalculation, reviewed worker applicability and supported California, Alaska and Nevada alternate schedules, Washington additional-meal review against an explicitly evidenced normal workday, native Settings, private EARN-001 estimates and COST-002 integration are implemented. Remaining native work: complete maintained timing and statutory premiums, practical rest placement, covered-industry and waiver variants, unsupported alternate-schedule deviations, Nevada consecutive 24-hour daily treatment, meal premium allocation across employer-day boundaries (weekly review estimates now assign a known workday premium once to the workweek containing its first positive retained payable venue date; cross-day meal violations still require allocation review), complete statutory payroll classification and closed-period adjustments. TEAM-001 payroll roles remain a named dependency: configuration and detailed classified-estimate review are owner-only interim doors; delegated-role sentences remain unproved and unclaimed. Unknown applicability, conflicting anchors, unsupported schedule deviations and unknown Colorado meal deductions withhold wage and break-premium amounts and refuse classified output. `tests/policy-regional-journey.mjs` (policyRegionalClassificationApi) proves that unresolved alternate treatment withholds both amounts. No automatic payroll mutation or outbound action occurs. |
| `POLICY-003` | Maintained meal rest and weekly-rest rules | target | partial | `tests/policy-journey.mjs` (policyClassifications, policyBoundaries, policyBrowser: maintained basic scenarios, rule traces, deductions, templates, swaps and 1440 and 390 warnings); `tests/policy-timing-journey.mjs` (policyTimingVariants: recorded meal boundaries and historical versions); `tests/policy-consecutive-journey.mjs` (policyConsecutiveApi: midnight, cafes, workweek context, qualifying meals, release adoption and unknown-meal payroll refusal); `tests/policy-release-journey.mjs` (policyReleaseReview: before-and-after preview, changed-source refusal, retained approval and locked-period fence); `tests/policy-earnings-journey.mjs` (policyEarningsApi, policyEarningsBrowser: retained own pay, double time, period boundaries, hidden estimates and 1440 and 390 end states); `tests/policy-cost-journey.mjs` (policyCostApi, policyCostBrowser: projected actuals, substitutes, pickups, swaps, source scope and 1440 and 390 end states); `tests/policy-settings-journey.mjs` (policySettingsBrowser: catalog, sources, stale preview, applicability, custom rules and account tooltip through Settings at 1440 and 390); `tests/policy-coverage-journey.mjs` (policyCoverageApi: separate reviewed applicability, cross-cafe conflicts, unresolved earnings and risk refusal); `tests/policy-alternate-journey.mjs` (policyAlternateApi, policyAlternateClassificationApi: retained California election, participation, reviewed adoption, elected and extra days, unresolved shortening and private evidence); `tests/policy-regional-journey.mjs` (policyRegionalConfigurationApi, policyRegionalClassificationApi: Alaska approved flex and Nevada mutual schedules, participation and unsupported deviations); `tests/policy-alternate-settings-journey.mjs` (policyAlternateSettingsBrowser: alternate schedules and California employer-day application at 1440 and 390); `tests/policy-workday-journey.mjs` (policyWorkdayApi, policyWorkdayBoundaryApi, policyWorkdayAllocationApi, policyWorkdayDstApi: reviewed employer days, retained closed history, prior-week context, exact approved allocations and pinned daylight-saving boundaries); `tests/policy-rest-days-journey.mjs` (policyRestDaysApi: split service, daily premium cap, recorded rests, untimed sources, prior-week context and unresolved boundary rests, once-only premium ownership across adjacent workweeks and restart); `tests/policy-washington-journey.mjs` (policyWashingtonApi, policyWashingtonBrowser: reviewed normal workdays, additional meal boundaries, unknown eligibility, historical rules, stale approval, private evidence and Settings at 1440 and 390) | Cited policy journeys cover selected catalogs and employer minimum-rest checks. Missing complete maintained meal/rest and weekly-rest applicability and all source variants. |
| `POLICY-004` | Reviewed alternative workweek evidence | target | partial | `tests/policy-journey.mjs` (policyClassifications, policyBoundaries, policyBrowser: maintained basic scenarios, rule traces, deductions, templates, swaps and 1440 and 390 warnings); `tests/policy-timing-journey.mjs` (policyTimingVariants: recorded meal boundaries and historical versions); `tests/policy-consecutive-journey.mjs` (policyConsecutiveApi: midnight, cafes, workweek context, qualifying meals, release adoption and unknown-meal payroll refusal); `tests/policy-release-journey.mjs` (policyReleaseReview: before-and-after preview, changed-source refusal, retained approval and locked-period fence); `tests/policy-earnings-journey.mjs` (policyEarningsApi, policyEarningsBrowser: retained own pay, double time, period boundaries, hidden estimates and 1440 and 390 end states); `tests/policy-cost-journey.mjs` (policyCostApi, policyCostBrowser: projected actuals, substitutes, pickups, swaps, source scope and 1440 and 390 end states); `tests/policy-settings-journey.mjs` (policySettingsBrowser: catalog, sources, stale preview, applicability, custom rules and account tooltip through Settings at 1440 and 390); `tests/policy-coverage-journey.mjs` (policyCoverageApi: separate reviewed applicability, cross-cafe conflicts, unresolved earnings and risk refusal); `tests/policy-alternate-journey.mjs` (policyAlternateApi, policyAlternateClassificationApi: retained California election, participation, reviewed adoption, elected and extra days, unresolved shortening and private evidence); `tests/policy-regional-journey.mjs` (policyRegionalConfigurationApi, policyRegionalClassificationApi: Alaska approved flex and Nevada mutual schedules, participation and unsupported deviations); `tests/policy-alternate-settings-journey.mjs` (policyAlternateSettingsBrowser: alternate schedules and California employer-day application at 1440 and 390); `tests/policy-workday-journey.mjs` (policyWorkdayApi, policyWorkdayBoundaryApi, policyWorkdayAllocationApi, policyWorkdayDstApi: reviewed employer days, retained closed history, prior-week context, exact approved allocations and pinned daylight-saving boundaries); `tests/policy-rest-days-journey.mjs` (policyRestDaysApi: split service, daily premium cap, recorded rests, untimed sources, prior-week context and unresolved boundary rests, once-only premium ownership across adjacent workweeks and restart); `tests/policy-washington-journey.mjs` (policyWashingtonApi, policyWashingtonBrowser: reviewed normal workdays, additional meal boundaries, unknown eligibility, historical rules, stale approval, private evidence and Settings at 1440 and 390) | Cited alternative/settings journeys show selected elections. Missing complete statutory applicability and maintained variants; no completion is inferred from employer assertions. |
| `POLICY-002` | Predictive scheduling and fair-workweek changes | target | partial | `tests/fairwork-journey.mjs` (fairworkApi), registered in `tests/lanyard.test.mjs` as “POLICY-002: attributable source-versioned coverage and retained consequence previews refuse unauthorized and stale decisions atomically”: core industry and size coverage, retained versions, exact shift and posting references, covered and below-threshold previews, exact actor, time, reason, site and retained employer facts for every write; one subject-bound audit event per accepted operation; complete unchanged state on role, origin, stale, exception and revoked-session refusals; concurrent revision atomicity, restart continuity and no outbound or schedule, time, premium, payroll or notice effects. These assertions prove the interim native owner boundary, not delegated or statutory completion. (fairworkBrowser), registered as “POLICY-002: owner reviews coverage and change consequences in Settings”: native Settings review at 1440, consent and premium consequence labels, unmaintained city and account tooltip; the same screen journey accepts explicit viewport widths for candidate proof at 1440 and 390. Existing access offers and posting history: `src/lanyard/domain/offerorder.ts`; `src/lanyard/domain/postings.ts`; `src/lanyard/domain/history.ts`. | **Gap — POLICY-002:** NYC, Chicago, Philadelphia, San Francisco, Los Angeles, Evanston, Berkeley and Emeryville presets; complete coverage and employee exclusions, good-faith estimates, schedule-wide advance notice, maintained exception catalogs, employee consent requests and exact-revision responses, change-door enforcement, statutory rest pay, complete preset-specific access-to-hours timing and records, approved premiums reaching payroll and required retention. The three implemented core presets and retained previews do not establish full statutory coverage or legal compliance. **Gap — TEAM-001 and ACCESS-003:** delegated policy administration and site-scoped consequence reviews, enforced by POLICY-002. **Gap — PRIVACY-001:** applicable employment-record retention, holds and employee-rights treatment for these records. Payroll-provider acceptance remains part of the named POLICY-002 payroll journey, never a scope exclusion. |
| `PAYRULE-001` | Shift differentials | target | partial | `tests/differentials-journey.mjs` (differentialApi): night/weekend midnight segments, stacking, codes/cost, effective updates, retained counter/kitchen rates, signed per-area corrections and one claim; own estimate and no coworker/agent wage access. `tests/differentials-journey.mjs` (differentialBrowser): owner setup, mapped payroll, own estimate and icon tooltips at 1440/390. | Provider-confirmed regular-rate treatment and differential overtime classification remain unproved; current lines are additional straight-time inputs only. |
| `PAYRULE-002` | Holiday calendar and holiday premiums | target | done | `tests/lanyard.test.mjs` — "PAYRULE-002: federal and site holidays, eligibility, retained area premiums, earnings, non-work service and once-only signed payroll corrections"; `tests/lanyard.test.mjs` — "PAYRULE-002: owners configure holidays, inspect eligibility, approve non-work pay and view area payroll, schedule costs and employee estimates at 1440 and 390" |  |
| `PAYRULE-003` | Reporting-time call-in split-shift and spread-of-hours premiums | target | done | `tests/lanyard.test.mjs` — "PAYRULE-003: CA reporting and split, NY call-in and spread inputs retain source/area rates, reasoned disputes, own estimates and once-only signed payroll corrections"; `tests/lanyard.test.mjs` — "PAYRULE-003: owners configure and review premium facts, managers dispute and approve inputs, payroll exports and staff read estimates at 1440 and 390" |  |
| `COST-001` | Scheduled versus actual labor cost and budgets | target | partial | `tests/cost-journey.mjs` (costApi, registered as “COST-001: native worked and approved cost retain rate history overtime burden and correction variance with budget warnings” in `tests/lanyard.test.mjs`): multi-role effective-date rates, scheduled versus recorded and approved hours, weighted overtime estimate, configured burdens, unworked call-out exclusion, pending and approved correction variance, retained rates after retroactive edits, missing-rate unknowns and restart; template and copy budget warnings before publication. costBrowser in the same file (“COST-001: managers inspect worked costs and template warnings and owners configure burdens at 1440 and 390”): worked and job breakdowns, revision-bound burden Settings, template warning and icon tooltips. Existing SALES-001 and DASH-001 HTTP journeys in `tests/lanyard.test.mjs` retain entered-sales ratios and cafe scope. costApi additionally asserts separate daily and weekly job caps under native site authority, stale-cap refusal, template, copy and recurrence warnings, exact approved PTO, leave and non-work holiday amounts and burdens, source revision corrections, duplicate-reference incompleteness and private-input exclusion from manager reads; costBrowser asserts cap and owner paid non-work totals in the existing Schedule card at both widths. | Native estimates include retained rates, overtime, holiday and differential amounts, reviewed premiums, burdens and correction variance without unworked call-outs. Separate daily and weekly job caps warn in draft review and the Schedule; public command configuration is built, with a Settings editor pending. The owner sees approved employer PTO, paid leave and non-work holiday costs and burdens separately from worked hours, with revisioned corrections and duplicate-reference incompleteness. Existing owner-only payroll-source access is preserved. Remaining: approved tip pools, complete statutory premium costs under POLICY-001, paid non-work allocation into day and job budgets, accountable overrun follow-up, TEAM-001 business and site role scopes and provider-applied payroll reconciliation. The held Gusto key does not supply the owner’s demo-company console link or applied-payroll readback. |
| `COST-002` | In-week overtime risk alerts from actual hours | target | done | `tests/lanyard.test.mjs` — "COST-002: a 38-hour week with three extra hours clocked by Thursday alerts the cafe manager at 41 projected hours with the premium and a substitute; a pickup and a swap that add overtime show it before approval, and approving a substitute clears the alert"; `tests/lanyard.test.mjs` — "COST-002: policy daily and double-time risk prices actual and remaining work, substitutes and receiving pickup and swap employees"; `tests/lanyard.test.mjs` — "COST-002: policy estimates, cited inputs, tooltips and substitute end state at 1440 and 390" |  |
| `ACA-001` | ACA hours measurement for variable-hour employees | target | done | `tests/lanyard.test.mjs` — "ACA-001: a year of approved service for three variable-hour people, monthly and look-back status, paid leave, scoped projections and a traced filer export"; `tests/lanyard.test.mjs` — "ACA-001: owners configure plans and paid service, inspect source-backed status, download the filer file and see scheduler warnings at 1440 and 390" |  |
| `TIPS-001` | Tips pooling and reviewed payroll allocation | target | partial | `src/lanyard/domain/questions.ts`; `src/lanyard/domain/time.ts`; `src/lanyard/ui/questions.ts`; `tests/lanyard.test.mjs` | Employee cash-tip declarations are retained on punches and timesheets and listed per person and day for managers. POS tip intake, pool rules, allocation review and correction, approved employee earnings lines and mapped payroll/provider reconciliation are absent. |
| `TIPS-002` | Tip credit and minimum-wage make-up checks | target | partial | `tests/lanyard.test.mjs` — "TIPS-002: a tipped server’s low-tip week raises a make-up pay input and the normal week none, side work on a non-tipped job is reported, a new minimum wage checks only later weeks, and tip-credit setups in California and the six other barring states are refused through native HTTP"; `tests/lanyard.test.mjs` — "TIPS-002: the owner is refused a California tip credit, sets one up for a Texas cafe and reads each week’s make-up pay input and non-tipped duty time with the cafe manager at 1440 and 390" | Missing a low/high tip-allocation journey that feeds the TIPS-001 approved pool into the make-up check. The cited tip-credit journeys use CLOCK-006 cash declarations, show shortfall/no-shortfall, side work, effective minimum wages and barred-state refusals; approved pool allocation remains owed. |
| `REPORT-001` | Operational reports exports and scheduled delivery | target | partial | `tests/reports-journey.mjs` (reportsApi, registered as “REPORT-001: filtered native reports and CSV reconcile approved revisions across two sites and retain incomplete offline sources without leaking wages” in `tests/lanyard.test.mjs`): explicit two-site approved totals, native overtime, period and site and job and person filters, approved revision replacement and restart, CSV and formula safety, site-manager wage and owner-input fences, deactivation refusal, no-shows and late arrivals, timed-break deduplication, separate declared and approved tip totals, native export source references and unresolved offline incompleteness. | Native HTTP report reads and audited CSV downloads now cover published schedules, attendance including overnight no-shows, timed breaks and exceptions, approved worked and overtime totals, daily labor estimates against budgets and manual sales, declared tips and owner-only approved PTO inputs and native payroll export records. Site, job, person and inclusive period filters retain source revisions; reported offline captures and missing data stay incomplete. Existing owner-only paid-leave and payroll authority is preserved. Remaining: app report screens, approved tip-pool sources, recipient-scoped scheduled SendGrid digests and revocable links, complete role scopes under TEAM-001 and real POS and provider-applied payroll reconciliation. Manual sales and employer acknowledgements do not prove provider reconciliation; unseen disconnected-device captures remain unknowable. |
| `REPORT-002` | Compliance and audit record reports | target | partial | `src/lanyard/domain/audit-report.ts`; `src/lanyard/ui/audit-report.ts`; `tests/audit-report-journey.mjs` (auditApi, registered in `tests/lanyard.test.mjs` as REPORT-002 audit records): explicit source sets and revisions, rounding minutes, break premiums, make-up inputs, retained minor exceptions and private-leave sources, preview boundaries, redaction, live-reader refusals, unchanged sources and audited CSV; append-only manager edits and changed employee resubmissions with notes and restart, unchanged rounded confirmations, stale and wrong-state refusals, owner whole-workweek context across cafes and date boundaries, manager exclusions, Chicago and California quarter-range source reconciliation; (auditBrowser, registered as REPORT-002 native audit filters): native filtering, desktop assertions, account tooltip and report proof at 1440 and 390; retainAuditProof in `tests/audit-report-journey.mjs`: owner authorization, exact reviewed revision, digests, correction isolation and restart; `tests/archive.test.mjs` (public CLI archive round trip): original retained JSON and CSV survive supported restore.  `tests/audit-report-journey.mjs` (auditDelegation and auditRetentionMatrix, inside auditApi): bounded named-reader JSON and CSV, exact records and exclusions, separate wage authority, scoped refusal, operational and form-error denial, attributed API reads and the existing scoped reader screen, expiry, revocation, six independently expected review dates, longest overlap, unresolved applicability and independent source and copy holds. `tests/audit-report-journey.mjs` (auditLargeQuarter, invoked by the public CLI archive round trip): complete two-site quarter JSON and original CSV in bounded parts, atomic refusal without orphaned parts, every source duty, authorized reads, correction isolation, restart and supported archive restore. auditMinorChecks and auditScheduleChanges, inside auditApi: retained approval-time minor outcomes including no recorded exceptions, unchanged historical checks after private document correction, fresh corrected evaluations, named-reader exclusions and revocation, cancellation source lineage and confirmations without borrowed reasons or unrelated employees. | **Gap — REPORT-002:** The owner-authorized immutable-copy workflow exists, but complete auditor delivery and preset-required retention enforcement remain unproved. Owner-issued named API grants prove supported classes with explicit scopes and separate wage review; delegated grant administration and private-source classes remain open. The existing audit screen serves permitted records without operational state. Retention review minimums and independent holds are implemented, while disposition remains unsupported. Complete Chicago and California quarter proof, delivered notice and consent, enforced predictive-scheduling outcomes and payroll transfer, complete minor-check coverage beyond recorded approval-time outcomes, legacy minor sources without snapshots, complete sick-leave eligibility and legacy in-place edits made before history capture remain open. Complete selected quarters are preserved in bounded authenticated parts without shortening the period. Legacy schedule cancellations without retained predecessor lineage remain incomplete. Untagged source jurisdictions remain unassigned. Private leave and policy previews retain their existing owner boundary. |
| `REPORT-003` | Sales per labor hour and labor percentage by interval | target | done | `tests/lanyard.test.mjs` — "REPORT-003: a day of hourly sales with scheduled and actual hours at two cafes gives labor percentage and sales per labor hour by interval and position matching hand figures; a dinner target flags the exceeded intervals; hours without sales are incomplete; each cafe reads only its own" |  |
| `DASH-001` | Manager daily operations dashboard | target | done | `tests/lanyard.test.mjs` — "DASH-001: a live Thursday with a late arrival, an open shift, three pending approvals, an overtime risk and a missed punch shows on the cafe manager’s dashboard with counts and links, labor against forecast sales and budget and the pay-period cutoff; another cafe’s manager sees only their cafe; resolving items clears them" |  |
| `EARN-001` | Employee hours and estimated earnings | target | done | `tests/lanyard.test.mjs` — "EARN-001: an employee reconciles their week’s scheduled, regular, overtime and pending hours and estimate to approved records; turning estimates off hides the amount; no coworker data"; `tests/lanyard.test.mjs` — "EARN-001: daily policy overtime, double time and retained rates reach only the employee estimate across period boundaries"; `tests/lanyard.test.mjs` — "EARN-001: policy estimate categories, hidden amounts and account tooltip at 1440 and 390" |  |
| `PAY-001` | Payroll-ready classified hours and pay codes | target | partial | `tests/paytemplates-journey.mjs` (classificationApi): regular, overtime, double time, approved PTO and tips in one reviewed export, explicit W-2 and supported 1099 treatment, unmapped-code refusal and signed code corrections; (classifiedSegmentsApi): pinned work areas and clock-transfer jobs retain each rate reference and reconcile signed per-job differences under one timesheet claim; (earningInputsApi): employer-approved non-work sources and TIPS-002 make-up mapping with signed corrections; (templatesApi): exact mappings, native authority, unchanged downloads and competing claims. Registered by the named PAY-001 tests in `tests/lanyard.test.mjs`. `tests/paytemplates-journey.mjs` (templatesApi, contractorOvertime and legacyClassification): unapproved versus approved template, explicit unclassified legacy mapping, regular-only contractor refusal of an employee overtime input, and refused unsupported historical conversion; (classificationApi): 780 contractor minutes and USD 260.00 exactly, signed employee corrections and later template revision preserving the closed period and prior bytes; (templatesBrowser): visible approval and classification denial reasons, exact approved output and icon tooltips at 1440 and 390. | Mixed-rate overtime, provider-confirmed differential regular-rate treatment, conversion of earlier hours-only exports or legacy overtime premiums, and multi-site tip make-up allocation remain open. Unsupported conversion and allocation are refused with explicit reconciliation or allocation reasons, not silently omitted. Contractor classification review and conversion is owner-reviewed and never inferred. Wider contractor forms and state treatments expected by Gusto, Rippling and QuickBooks Payroll buyers remain open: 1099-NEC, 1099-MISC, corrections, federal and state filing, withholding, state-specific reporting and worker-status conversion. The approved native 1099 slice is regular worked time only and performs no tax calculation or legal classification. Owner-mapped templates retain versioned approval, explicit employee workflow and source mappings; changing one leaves closed periods and exported bytes unchanged. TEAM-001 and ACCESS-003 retain independent payroll authority; PAYRULE-001 and POLICY-001 retain unfinished regular-rate and statutory-policy duties. |
| `PAY-002` | Configurable payroll export templates | target | done | `tests/lanyard.test.mjs` — "PAY-001 and PAY-002: explicit employee workflows and mapped grouped files retain signed sources, exact revisions and once-only claims"; `tests/lanyard.test.mjs` — "PAY-002: reviewed mapped bytes export from Payroll at 1440 and 390"; `tests/lanyard.test.mjs` — "PAY-002: XLSX downloads retain literal identifiers, exact approved numbers, binary hashes and immutable signed corrections"; `tests/lanyard.test.mjs` — "PAY-002: TSV and custom-delimited files retain configured column order, dates, UTC times, payable precision and immutable downloads" |  |
| `PAY-003` | Paylocity import preset | target | missing |  | No Paylocity preset or layout validation. |
| `PAY-004` | Paycor import preset | target | missing |  | No Paycor preset or specification validation. |
| `PAY-005` | Rippling import preset | target | missing |  | No Rippling preset or template validation. |
| `PAY-006` | Heartland Payroll import preset | target | missing |  | No Heartland preset or specification validation. |
| `PAY-007` | Square Payroll hours preset | target | missing |  | No Square Payroll preset or field validation. |
| `PAY-008` | Toast Payroll hours preset | target | missing |  | No Toast Payroll preset or field validation. |
| `PAY-009` | Pay schedules and workweeks that cross pay periods | target | done | `tests/lanyard.test.mjs` — "PAY-009: independent pay groups recur on all four schedules; a whole Sunday workweek crossing the fifteenth carries traced once-only overtime to the second locked period and EARN-001 shows scheduled dates"; `tests/lanyard.test.mjs` — "PAY-009: the payroll administrator defines and opens a pay schedule, reviews the cross-period overtime adjustment and the employee reads the scheduled period and pay date at 1440 and 390" |  |
| `PAY-010` | Paychex Flex payroll import file preset | target | missing |  | No Paychex Flex import preset or layout validation; only one fixed hours CSV exists. |
| `PAY-011` | QuickBooks Desktop Payroll IIF time export | target | partial | `tests/payiif-journey.mjs` (iifApi, registered as “PAY-011: reviewed IIF activities reconcile regular overtime and PTO with mapping refusal and once-only exports” in `tests/lanyard.test.mjs`): policy-classified regular, overtime and PTO activity export, unmapped payroll-item refusal without a batch, reparsed minute reconciliation, retained hashes, repeated downloads, restart and competing-claim refusal; iifBrowser in the same file (“PAY-011: owner configures Desktop mappings and reviews and downloads IIF at 1440 and 390”): native preset configuration, exact file review and download, responsive end states and icon tooltips. | The export-only Desktop preset and IIF writer are built on PAY-002. Buyer-authorized QuickBooks Desktop Payroll Enhanced company-file import, mapped payroll items on weekly timesheets and imported-total reconciliation remain an unproved manual machine check. Intuit’s older Timer reference marks PITEM unused; the written payroll-item and transfer fields do not prove the installed Desktop applies them. Negative time corrections and unsupported non-work earnings require separate reconciliation. |
| `SYNC-001` | Approved transfer and provider-applied reconciliation | target | partial | `src/lanyard/domain/payroll.ts`; `tests/lanyard.test.mjs` | Once-only file claims and manual references exist; live submission, durable connector attempts, provider readback and applied-state reconciliation do not. |
| `GUSTO-001` | Live Gusto payroll connection | target | missing |  | No Gusto authorization, mapping, transfer or reconciliation connector. |
| `ADP-001` | Distinct ADP RUN and Workforce Now connectors | target | missing |  | Neither ADP RUN nor Workforce Now has a production connector or provider acceptance journey. |
| `PAYCHEX-001` | Live Paychex Flex payroll connection | target | missing |  | No Paychex Flex authorization, transfer, mapping, worker sync or readback; generic CSV is not this integration. |
| `QB-001` | QuickBooks Online Payroll live time connection | target | missing |  | No QuickBooks Online Payroll connector, time-activity transfer, plan/tier matrix or readback. |
| `PAYSYNC-001` | Payroll-provider field authority | target | missing |  | No payroll-provider connection, field-authority map, inbound sync or conflict handling. |
| `PAYSYNC-002` | Payroll new-hire matching invitation and termination | target | missing |  | No provider employee read, matching queue, new-hire invite rule or termination-driven access and shift handling. |
| `PAYSYNC-003` | Payroll pay-rate and job sync into labor cost | target | missing |  | No inbound compensation sync, effective-dated rates or cost recalculation. |
| `PAYSYNC-004` | Payroll-held leave balances | target | missing |  | No provider leave-balance read, pending deduction view or post-transfer balance reconciliation. |
| `POS-001` | Square sales staff and tip inputs | target | missing |  | No Square authorization, sales/staff/tip synchronization or labor-to-sales report. |
| `POS-002` | Toast restaurant sales and labor connection | target | missing |  | No Toast production access, restaurant mapping, sales/time synchronization or reconciliation. |
| `POS-003` | Clover sales terminals and employee mapping | target | missing |  | No Clover authorization, terminal-clock, sales or staff/tip integration. |
| `POS-004` | Shopify POS and Lightspeed sales adapters | target | missing |  | No Shopify POS or Lightspeed adapters. |
| `SALES-001` | Manual and CSV sales and metric entry | target | done | `tests/lanyard.test.mjs` — "SALES-001: two weeks of hourly sales by CSV and one day by hand, labelled Manual; a duplicate upload is refused at preview; a correction keeps the earlier value; labor percentage and sales per labor hour follow, on the cafe’s week and its dashboard; other cafes and staff read none" |  |
| `HR-001` | Willow and BambooHR roster and leave authority | target | missing |  | No Willow or BambooHR connection, field-authority mapping or leave/lifecycle synchronization. |
| `DEMAND-001` | Multi-location demand forecasting | target | partial | `src/lanyard/domain/demand.ts`; `src/lanyard/domain/demand-compare.ts`; `src/lanyard/domain/intervals.ts`; `src/lanyard/ui/demand.ts`; `src/lanyard/ui/intervals.ts`; `tests/demand-journey.mjs`; `tests/lanyard.test.mjs` — two cafes' hourly history uploaded through SALES-001 (manual labels), an event-day forecast with mean, one-standard-deviation range, confidence and role demand, saved versions bound to reviewed inputs, a reasoned hour override, a corrected day updating the current forecast while the saved version stays, a stale or thinly sampled cafe forecast explicitly incomplete with staffing withheld, forecast hours beside scheduled and actual hours in the interval report, actual sales and worked-hour comparison with override effect, owner and home-cafe manager scope, and no schedule or worked-time writes: “DEMAND-001: hourly forecasts from entered sales carry event uplift, uncertainty, staleness, reasoned overrides and actual error, and add forecast hours to the interval report without writing schedules” (demandApi, demandOutcomes); forecast, incomplete and interval screens at 1440 and 390: “DEMAND-001: the forecast, incomplete and interval screens work at 1440 and 390” (demandBrowser). `src/lanyard/agent-demand.ts`; `src/lanyard/comparison-scope.ts`; `tests/demand-journey.mjs` (demandApi, demandOutcomes, registered in the named hourly-forecast test in `tests/lanyard.test.mjs`) additionally assert scoped forecast versions, role demand and observed delta, unscoped and other-cafe refusal, staff refusal, agent save/override refusal, read audit and immediate revocation. | History from a connected POS (POS-001 to POS-004, accounts not held) and a stale connector are not proved: sandbox proof pending. Staleness is proved on manual SALES-001 entries only, and monthly seasonality is not modelled beyond weekday, growth and events. TEAM-001 inherits scheduler and read-only analyst reads before those roles ship. |
| `OPT-001` | Budget preference and fairness-aware optimized schedules | target | partial | `src/lanyard/domain/fairness-optimizer.ts`; `src/lanyard/domain/planning-inputs.ts`; `src/lanyard/domain/forecast.ts`; `src/lanyard/ui/fairness-compare.ts`; `src/lanyard/ui/tradeoff.ts`; `tests/planning-fixture.mjs`; `tests/fairness-optimization-journey.mjs` — fairnessOptimizationApi (inside the named eight-week source-backed preference test in `tests/lanyard.test.mjs`) proves hand-calculated role demand gaps, missing forecast days remaining unknown, exported saved-version/budget revisions, budget-bounded fairness moves, infeasible-budget refusal without draft writes, stale demand/budget refusal, native cafe scope and no raw budget forecasts in agent context; fairnessOptimizationBrowser (inside the named manager preference-gap 1440/390 journey in the same test file) inspects the demand gaps and budget alongside the comparison and prepares/publishes only through human review. Existing qualification, availability, weekly-maximum and feedback-independence assertions remain in fairnessOptimizationApi. | Local search for existing published slots, saved-manual-demand staffing gaps and an employer-budget bound on the scheduled wage/holiday estimate are built. Demand-derived schedule generation and auto-fill, service optimization, rest and statutory-policy constraints, complete cross-site optimization and connected POS demand remain absent or unproved. |
| `FAIR-001` | Named fairness measures | target | done | `tests/lanyard.test.mjs` — "FAIR-001: eight-week source-backed preference gaps, preferred-block shifts, configurable inputs, unknown evidence, cafe authority and feedback independence through native HTTP"; `tests/lanyard.test.mjs` — "FAIR-001: a manager inspects preference gaps, downloads inputs, changes the window and sees unknown weeks at 1440 and 390"; `tests/lanyard.test.mjs` — "TRADEOFF-001: fixed-slot alternatives explain cost, fairness, coverage and unknown inputs without publishing or waiving hard constraints"; `tests/lanyard.test.mjs` — "TRADEOFF-001: a manager inspects explained alternatives, downloads facts and explicitly publishes the selected draft at 1440 and 390" |  |
| `AI-001` | Reviewed natural-language and image schedule preparation | target | partial | `tests/ai-schedule-journey.mjs` (aiScheduleApi, registered as “AI-001: consented extraction resolves ambiguous names and repeated local times before exact native draft publication” in `tests/lanyard.test.mjs`): consent before the model send, structured confidence and source fields, corrected employee mapping and explicit repeated-time occurrence, native validation and stale refusal, separate exact-revision publication and unchanged approved time; aiScheduleScopeApi (“AI-001: owner-scoped sources and model sends refuse other roles and erasure purges local material through restart”): role, origin and source fences, scoped provider context and local erasure. aiScheduleBrowser in the same file (“AI-001: owner corrects extracted fields inspects sources and approves a draft at 1440 and 390”) exercises the native correction and approval UI and shared icon tooltips.  aiLive in `tests/ai-schedule-journey.mjs` ran through the held-key injector on 26 October 2026: one gpt-5-nano request, 1,685 input and 392 output tokens, synthetic schedule image plus requested start change, source references, corrected review and native publication; provider response identifier retained in fleet run sx-lanyard-c-i871. | The cited native extraction journeys prove permission-scoped source disclosure and reviewed drafts with synthetic images. Missing: delegated manager access, company-policy decisions on the language/image workflow, complete privacy dispositions and provider-copy handling. The buyer-photo receipt is R-2, not a completion gate; RL-101 grants no completion. |
| `AUTO-001` | Policy-limited schedule-aware time approvals | target | done | `tests/lanyard.test.mjs` — "AUTO-001: the owner previews and authorizes a cafe rule that approves only clean schedule-matching punched time; exception-bearing, off-schedule, unattested, edited and managers’ time stays for a person; a stale preview is refused; a paused rule approves nothing and payroll carries only approved time"; `tests/lanyard.test.mjs` — "AUTO-001: Sunday workweeks keep 40-hour captured time eligible, hold 41 hours for human review and start a fresh Sunday independently of the prior week"; `tests/lanyard.test.mjs` — "AUTO-001: owner preview, authorization and next-workweek approval preserve the overtime hold on Payroll at 1440 and 390" |  |
| `LINK-001` | Scoped APIs webhooks and workflow automation | target | partial | `src/lanyard/http.ts`; `src/lanyard/credentials.ts`; `docs/AGENTS-API.md`; `tests/lanyard.test.mjs` | Preparation HTTP API and revocable keys exist; versioned partner scopes, signed event webhooks and Zapier/Make connectors are absent. |
| `OPS-001` | Accountable connector operations and recovery | target | missing |  | No product connector registry, durable sync queues, health or recovery workflow. |
| `MIGRATE-001` | Reviewed complete workforce migration and cutover | target | partial | `src/lanyard/movein/index.ts`; `src/lanyard/movein/csv.ts`; `tests/lanyard.test.mjs` | Only documented inactive Staff CSV import/journal/undo exists; full workforce history, vendor mappings, reconciliation and operational cutover do not. |
| `MIGRATE-002` | Deputy migration | target | missing |  | No Deputy extractor/adapter or real-source migration journey. |
| `MIGRATE-003` | When I Work migration | target | missing |  | No When I Work adapter, recurrence/coverage migration or verified cutover. |
| `MIGRATE-004` | Homebase migration | target | missing |  | No Homebase adapter or verified offline-punch/POS cutover. |
| `MIGRATE-005` | 7shifts restaurant migration | target | missing |  | No 7shifts extraction, restaurant/tip mapping or real-source migration acceptance. |
| `MIGRATE-006` | Connecteam workforce migration | target | missing |  | No Connecteam adapter, lock/clock-settings import or workforce cutover. |
| `MIGRATE-007` | Legion workforce migration | target | missing |  | No Legion extraction, constraint/demand migration or verified reconciliation. |
| `PRIVACY-001` | Retention legal holds and employee data rights | target | partial | `tests/lanyard.test.mjs` (PRIVACY-001 / PRIVACY-002 / PRIVACY-003: authorized former employee export, held history and explicit journal dispositions preserve employment facts): authorized scoped export, private-note exclusion, held-history refusal, journal attachment and version erasure, restricted payroll preservation and restart. `tests/privacy-journey.mjs` (privacyBrowser): erased journal text, absent file and edit controls and account tooltip at 1440 and 390. `tests/archive.test.mjs` (public CLI archive round trip): later note-erasure fence refuses an old archive; later restore retains held history and no erased note or file. `tests/photos-journey.mjs` (photoApi) and `tests/geofence-journey.mjs` (geofenceApi): employee privacy holds and longer review periods fence existing erasure doors.  `tests/audit-report-journey.mjs` (auditRetentionMatrix, inside auditApi): maintained minimum review dates, overlapping duties, unresolved applicability, independent holds and retained-copy inheritance; `tests/archive.test.mjs` (public CLI archive round trip): retained duties and independent copy holds after restore. | ct product workflow approval is conditional on its two source riders, now implemented and asserted in `tests/access-chat-kiosk-journey.mjs` (chatApi and kioskApi). `tests/lanyard.test.mjs` (PRIVACY-001 authorized former employee export) additionally asserts refusal without reviewed authorization, independent note and attachment holds, and absent erased text and files in saved results. Chat and logbook dispositions, import-original and connector dispositions, complete employee export coverage, and statutory minimums remain open. The public CLI archive round trip in `tests/archive.test.mjs` directly inspects restored notes, saved results and files for erased content. No automatic deletion or broader readers. **Gap — PRIVACY-001:** Six maintained minimum review presets, explicit reviewed anchors, longest overlapping duties and independent source and retained-copy holds are implemented. Complete statutory applicability and source-class coverage, required-period enforcement, complete employee-request handling; reviewed eligible disposition across local sources, retained copies and saved results; and corresponding restore fences remain unproved for this workflow. Legal applicability and provider or disconnected-copy handling require explicit review and receipts. Indefinite technical storage proves neither lawful indefinite retention nor completed employee-rights fulfillment. |
| `PRIVACY-002` | Employee access export and correction requests | target | partial | `tests/lanyard.test.mjs` (PRIVACY-001 / PRIVACY-002 / PRIVACY-003: authorized former employee export, held history and explicit journal dispositions preserve employment facts): authorized scoped export, private-note exclusion, held-history refusal, journal attachment and version erasure, restricted payroll preservation and restart. `tests/privacy-journey.mjs` (privacyBrowser): erased journal text, absent file and edit controls and account tooltip at 1440 and 390. `tests/archive.test.mjs` (public CLI archive round trip): later note-erasure fence refuses an old archive; later restore retains held history and no erased note or file. `tests/photos-journey.mjs` (photoApi) and `tests/geofence-journey.mjs` (geofenceApi): employee privacy holds and longer review periods fence existing erasure doors.  `tests/audit-report-journey.mjs` (auditRetentionMatrix, inside auditApi): maintained minimum review dates, overlapping duties, unresolved applicability, independent holds and retained-copy inheritance; `tests/archive.test.mjs` (public CLI archive round trip): retained duties and independent copy holds after restore. | Existing owner export covers payroll and employee-visible notes. Missing complete employee/source-class access and correction fulfillment and separately reviewed statutory requests. |
| `PRIVACY-003` | Explicit workforce erasure and restore fences | target | partial | `tests/lanyard.test.mjs` (PRIVACY-001 / PRIVACY-002 / PRIVACY-003: authorized former employee export, held history and explicit journal dispositions preserve employment facts): authorized scoped export, private-note exclusion, held-history refusal, journal attachment and version erasure, restricted payroll preservation and restart. `tests/privacy-journey.mjs` (privacyBrowser): erased journal text, absent file and edit controls and account tooltip at 1440 and 390. `tests/archive.test.mjs` (public CLI archive round trip): later note-erasure fence refuses an old archive; later restore retains held history and no erased note or file. `tests/photos-journey.mjs` (photoApi) and `tests/geofence-journey.mjs` (geofenceApi): employee privacy holds and longer review periods fence existing erasure doors.  `tests/audit-report-journey.mjs` (auditRetentionMatrix, inside auditApi): maintained minimum review dates, overlapping duties, unresolved applicability, independent holds and retained-copy inheritance; `tests/archive.test.mjs` (public CLI archive round trip): retained duties and independent copy holds after restore. | Existing journal/photo/location erasure and archive journeys cover selected doors. Missing logbook/chat/import/connector dispositions, complete retained-copy and saved-result coverage and corresponding restore fences. |
| `BOUNDARY-001` | Product ownership and US service boundaries | target | partial | `src/lanyard/domain/payroll.ts`; `src/lanyard/archive-policy.mjs`; `tests/lanyard.test.mjs` | Hours-only file export and manually labeled reference exist; named service handoffs and integrated authority/status journeys are absent. |
| `COVERAGE-001` | Carry an absence or demand swing to verified coverage | push-further | partial | `src/lanyard/domain/cover.ts`; `src/lanyard/domain/people.ts`; `src/lanyard/domain/roster.ts`; `src/lanyard/credentials.ts`; `tests/lanyard.test.mjs` | A call-out offers its shift to every same-position teammate who is available, not on another shift or time off and within 40 weekly and 8 daily hours, records each accept or decline, and lets a manager approve one accepted cover that moves the shift and closes the other offers; the cell shows the cover's clock-in. Demand swings, multi-site sources, notifications, cost checks, missed-clock-in escalation and agent-run outreach do not exist. |
| `TRADEOFF-001` | Explain cost fairness and service alternatives | push-further | partial | `src/lanyard/domain/tradeoff.ts`; `src/lanyard/domain/tradeoff-overtime.ts`; `src/lanyard/domain/fairness-optimizer.ts`; `src/lanyard/ui/tradeoff.ts`; `tests/tradeoff-journey.mjs`; `tests/lanyard.test.mjs`; `src/lanyard/comparison-read.ts`; `src/lanyard/credentials.ts`; `src/lanyard/ui/admin.ts`; `tests/comparison-scope-journey.mjs`; `tests/archive.test.mjs` | Fixed-slot low/high fairness alternatives explain retained USD cost, assignment and named FAIR-001 differences, unchanged scheduled coverage and existing unfilled work, with explicit missing connected-demand/service-outcome/statutory-policy inputs. Source-backed scheduled weekly overtime and separate half-rate premium estimates now compare both alternatives, preserving unknown workweeks and missing rates. The owner-consented, named-cafe `comparison.read` slice is implemented: default keys gain no scope; the separate bearer read exposes allowlisted assignments, fairness counts and aggregate USD cells with distinct `small-cell` and unknown states, rechecks live authority, records owner activity and grants no fairness preparation or publication commands. `tests/lanyard.test.mjs` executes the named TRADEOFF-001 scope HTTP and 1440/390 consent/activity/revocation journeys in `tests/comparison-scope-journey.mjs`; `tests/archive.test.mjs` exercises scoped-key exclusion through public CLI export/import. Full demand/service/policy comparison remains open. Remaining: connected POS demand, demand-derived alternatives and service-outcome risk, actual/daily/statutory overtime and policy cost, and manager-approved exceptions. The native manual-demand gap explanation is not yet included in the scoped comparison projection; scoped forecast/role/delta reads use DEMAND-001's separate bearer door. |
| `CUTOFF-001` | Resolve payroll exceptions before the cutoff | push-further | partial | `src/lanyard/domain/time.ts`; `src/lanyard/domain/payroll.ts`; `src/lanyard/http.ts`; `tests/lanyard.test.mjs` | Corrections, preparation-only agent API and manual payroll references exist; deadline monitoring, plain-language analysis, chasing and provider reconciliation are absent. |
| `LEARN-001` | Learn from forecast errors and unresolved outcomes | push-further | partial | `src/lanyard/domain/learn-propose.ts`; `src/lanyard/domain/learning.ts`; `src/lanyard/domain/demand-compare.ts`; `src/lanyard/ui/learning.ts`; `tests/learn-demand-journey.mjs`; `tests/learning-journey.mjs`; `tests/lanyard.test.mjs` — comparable days with forecast-versus-actual error and a no-show cause left unobserved, a day without entered sales and days without forecasts counted unknown, the held-out comparison, proposal bound to its digest, refusal after the assumptions changed, reasoned decline, approval applying once, revert restoring the assumption with saved forecasts and sales unchanged, owner and home-cafe manager scope and no schedule writes: “LEARN-001: comparable demand forecasts propose a held-out growth change that a manager approves, declines or reverts without altering history or schedules” (learnApi); the earlier retained daily error report: “LEARN-001: retained pre-service manual forecasts reconcile to corrected daily and complete hourly sales; missing outcomes and no-show signals stay unknown under native cafe scope without policy or schedule writes”; review, approve and revert on the demand screen at 1440 and 390: “LEARN-001: a manager reviews the held-out comparison and approves then reverts a proposal at 1440 and 390” (learnBrowser). `src/lanyard/agent-demand.ts`; `src/lanyard/comparison-scope.ts`; `src/lanyard/domain/storage.ts`; `tests/learn-demand-journey.mjs` (learnApi, registered in the named comparable-demand test in `tests/lanyard.test.mjs`) additionally assert every forecast/learning read and learning-command refusal for staff and other-cafe managers; unscoped/scoped agent reads, exact-digest proposal, unchanged assumptions, denial of approve/decline/revert, key revocation, owner self-propose/approve, and persisted learn.propose/decide/revert audit actors, roles and retained reasons. The scope consent and forecast/learning read activity are shown at 1440/390 by learnBrowser in the same file. | Proposals cover the demand growth assumption only: offer-timing and objective-weight (including FAIR-001) proposals, FAIR-001 and service-outcome error attribution, and a stale connected-POS interval (POS-001 to POS-004, sandbox proof pending) are not built or proved; agent reads of FAIR-001 values continue to use TRADEOFF-001's comparison.read. Scoped forecast reads and agent-recorded growth proposals are built; TEAM-001 inherits scheduler and read-only analyst access before those roles ship. |
| `SURFACE-001` | Workforce registry and public-door parity | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
| `SURFACE-002` | Workforce resources and scoped source facts | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
| `SURFACE-003` | Outside contact and provider steps | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
| `SURFACE-004` | Pay and authoritative workforce decisions | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
| `SURFACE-005` | Workforce access custody and protection classes | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
| `SURFACE-006` | Running workforce rules and events | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
| `SURFACE-007` | A stranger coordinates a seeded workforce week | target | missing |  | No workforce MCP registry, company-policy matrix or specialist conformance journey proves this delta. |
