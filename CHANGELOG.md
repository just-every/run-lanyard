# Changelog

## Unreleased

- TIME-009: the approval list shows each waiting timesheet's scheduled, captured and payable times, variance, breaks, network, job, cost and running week; approvers edit with a reason or send time back to the employee.
- COVER-002: managers post open shifts to eligible staff or a pool with approved pickup or manager approval; one approval assigns the shift and closes the other requests; template position-only rows post as open shifts.
- CLOCK-007: owners limit a cafe's clock-in and clock-out to approved IP ranges or enrolled store browsers, refusing or flagging other networks; each punch records only its network address and which approval matched.
- TIME-007: owners set a clock-out reminder and longest punch per cafe; a forgotten clock-out stops counting at the scheduled end (or the cap), is held from approval and payroll, and is confirmed or corrected by the employee or a manager.
- COVER-001: staff offer a shift to an eligible coworker or propose an exchange; the coworker agrees and a manager of the shift's cafe approves, with every check rerun and overtime shown first.
- AVAIL-001: weekly availability patterns with available, preferred and unavailable blocks, effective dates, one-off dates and weekly hours, optional manager approval, and collision lists.
- SCHEDULE-002: managers copy days between weeks, save and apply week templates and add recurring shifts with end dates and skipped dates, each as a rechecked draft.
- BREAK-002: owners turn on an automatic meal deduction per cafe; staff confirm or report the meal at clock-out, and reported or unanswered meals are flagged for approval.
- SCHEDULE-005: managers print the published week as a PDF by cafe, position or person, each copy recorded and marked superseded when the week changes, and open a read-only wall display.
- LEAVE-002: blackout dates and absence limits per cafe or position refuse or flag time-off requests, conflicting approvals need an override reason, and managers see a team leave calendar.
- TIME-006: owner clock-in rules per cafe and position refuse or flag early clock-ins and refuse, flag or allow clock-ins without a shift; flagged time waits for a manager.
- TIME-008: managers filter waiting timesheets by cafe, position, dates and state and approve the shown revisions at once; changed, flagged, foreign or own items are skipped with reasons.
- ROSTER-004: staff see who's working at their cafe (name, position and times of published shifts); managers set each cafe to whole team or own position and hide people for safety.
- Run the hosted demo on rer 0.2.30's native Worker Loader host: refresh every recorded Base copy from `rer-v0.2.30`, take Base's run-demo workflow, and drop the container observer and instance type.
- Carry the woven green Lanyard style through the run site, sign-in, setup and app, with shared tokens and self-hosted Piazzolla and Work Sans.
- Build the marketing homepage, installation page and Markdown owner guides as a static run site; keep publishing disabled by default.
- Reflect the durable owner claim in the installed Lobby before the first-run review.
- Update the pinned rer package to 0.2.21.
