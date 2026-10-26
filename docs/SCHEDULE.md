# Schedule, call-outs and time off

**Schedule** is a week calendar: people down the side, Monday to Sunday across, grouped by position, with each person's week hours on the right and the cafe's labor cost under the week. Build a week from recorded availability and approved time off. A draft is preparation; publishing the schedule is a separate human decision.

## Set up people for the schedule

In **People**, give each person a **Position** (the schedule's group, such as "Baristas and counter"), an **Hourly rate** in dollars and a **Home cafe** (such as "Ocean Beach"). Positions decide who can cover whom; rates feed labor cost; home cafes fill the cafe picker in the top bar. All three are optional, but labor cost leaves out anyone without a rate and says so under the week.

## Record availability and time off

Staff open **Schedule**, then **My availability and time off**. Use **Add availability** to save when they can start and finish, or **Request time off** to enter the dates and a reason. Managers record anyone's availability in **Availability** → **Record availability**.

**Set a weekly pattern** keeps a recurring week: one line per block, such as `Mon available 07:00-15:00`, `Tue preferred 09:00-17:00` or `Sun unavailable 00:00-24:00`, from a first day (and an optional last day), with one-off dates such as `2026-11-26 unavailable` and preferred and maximum hours a week. When a manager turns on approval in **Availability**, a staff member's new pattern waits for a manager and the old one keeps deciding until then. Saving or approving lists any published shift the new pattern collides with. A shift inside an unavailable block is flagged **Marked unavailable**, a week past someone's maximum hours is flagged, and teammates who prefer a shift come first when someone calls out.

Availability must cover the whole shift. Back-to-back availability windows can cover it together. In **Time off**, a manager or the owner selects **Approve** or **Decline** on another person's request. A pending request is not approved time off; decide requests before publishing.

Managers set **Time-off rules** under the week: **Add blackout dates** (such as a holiday weekend) and **Add a limit** on how many people may be off at once, for a cafe, a position or everyone. Each rule either refuses requests that hit it or sends them to a manager flagged. Approving a request that breaks a rule asks for an **Override reason**, kept with the decision. Staff see the closed and already-full dates above **Request time off**, never who is off. The **Team leave calendar** shows each day's approved and pending time off for the week on screen.

## Build the week

1. Check the venue time zone. New installations start on the zone given at setup (US Pacific unless you chose another); the owner can change it in **People** before the first schedule is published.
2. Use the arrows in the top bar to reach the week, for example the week of Mon Oct 19, 2026. **Schedule** opens on this week, or on next week when only next week has a call-out still waiting for cover. On a phone it opens on the day of that call-out, and its day is marked in the day picker.
3. In **Build this week** (or **Edit this week**), add the person, start, end, unpaid meal minutes, position label and cafe for each shift. Use **Add another shift** as needed. The editor includes all current shifts. Drag a card to another day, resize its duration, or edit the fields directly. Select shifts to copy, remove, assign a person, or bulk-change their day, meal, position and cafe. **Undo last edit** restores the last unsaved edit. The day selector and the same fields work on phones. Review live conflicts, known unfilled/open-shift gaps, headcounts and estimated scheduled cost; prepare the draft, inspect its employee-facing change preview and then publish the exact revision. Reloading retains saved review warnings; unsaved edits stay in the page. Building the week on this screen needs JavaScript; agents send the same shifts to `roster.prepare` (see **Agent access**).
4. Select **Prepare draft**. The draft shows in the calendar with dashed blocks, and any conflicts are named above it.

Enter dates and times in the venue's local time. A shift must start within the selected week. Times that are skipped or repeated when daylight saving time starts or ends are refused; choose a time that happens once.

Preparing the same week again replaces its current draft. It does not publish it or replace the published week yet.

## Forecast and labor budget

In **Sales forecast and labor budget**, enter the cafe's expected sales for each day of the week in whole dollars and, optionally, a labor budget percentage. The footer under the week then shows each day's forecast, scheduled labor cost (paid hours × hourly rate) and labor %, and the week's total against the forecast and budget.

## Resolve conflicts and publish

Publishing checks that every person is active, their availability covers the shift, they have no overlapping approved time off and their shifts do not overlap. You can review a draft with conflicts, but you cannot publish it.

Fix what causes a conflict, prepare the week again if its shifts change, and review the current revision. Select **Publish this revision**. If somebody has changed the draft since you loaded it, reload and review the new revision before publishing. The top bar then shows when the week was published and how many people have confirmed it.

Publishing a replacement week supersedes the earlier published schedule and its shifts. Staff see their own current published shifts.

## Confirm your shifts

Staff open **Schedule**, select one of their published shifts and choose **Confirm shift**. A draft does not ask staff to confirm; publish first.

## Copy and repeat

Under the week, **Copy and repeat** builds a new draft from shifts you already have. **Copy from another week** copies the chosen days of a week into the one on screen. **Save this week as a template** keeps its shifts by weekday and time; **Apply a template** adds them to any week. **Add a recurring shift** repeats a person's shift on chosen weekdays between a first and last day, skipping listed dates; **Add this week's recurring shifts** places that week's occurrences. Shifts keep their wall-clock times across daylight-saving changes. Every result is a draft checked against availability, approved time off and overlaps, and nothing is published or confirmed until you publish.

## Print and post the week

Once a week is published, managers use **Print and post** under the week: choose a cafe, a position or one person and select **Print PDF**. The PDF shows names, positions and shift times with the week's revision (1 for its first publication, 2 for the next), when it was published and when it was printed; it never shows pay, notes or time-off reasons. Each printed copy stays listed with its PDF, and turns **Superseded** once the published week no longer matches it. **Open the wall display** shows one cafe's current week read-only for a screen at the site; it reloads every minute and moves to each new revision.

## Who's working

Staff see **Who's working** under their week: every published shift at their home cafe that week, as each coworker's name, position and start and end time, so they can arrange swaps and handovers. They never see drafts, pay, contact details or another cafe.

In **People**, an owner or manager sets each cafe's **Staff team view**: everyone published at that cafe (the default) or only people in the viewer's own position. Tick **Hide** beside a person to keep them out of every staff team view for safety; staff are not told who is hidden, and the hidden person's own schedule is unchanged.

## When someone calls out

Anyone who cannot make a published shift selects it and chooses **I can't make this shift**, with an optional note. A manager who takes the call can do the same for them with **Record a call-out**.

Lanyard then offers the shift to every teammate in the same position who qualifies: available for the whole shift, no overlapping shift or approved time off, and still within 40 hours that week and 8 hours that day. The shift turns claret in its cell and the manager sees the shortlist anchored beside it: each person's week hours before and after, their answer and message, and who was left out and why (overtime first, then whoever is already on).

Teammates answer the offer at the top of their **Schedule** with **Accept** or **Decline** and an optional message. The manager chooses **Approve** on an accepted answer; the shift moves to that person and every other offer closes. **Wait for** closes the shortlist without deciding. The covered cell keeps the call-out and shows when the cover clocks in: the gap closes only at their clock-in.

Continue with [Clock and timesheets](TIME.md) when the team starts work.

## Prepare from a request or schedule image

Built-in extraction currently belongs to the native owner. Supply
`OPENAI_API_KEY` privately in the installed Worker's environment and optionally
`OPENAI_MODEL` (default `gpt-5-nano`). Keep the key outside source control and
archives. Extraction uses the Responses API with a structured schema and requests
no stored response; provider security-log retention remains outside app erasure.

In **Schedule → Prepare from a request or image**, select one cafe and Monday
week, enter a staffing request and optionally attach an authorized PNG, JPEG or
WebP image of at most 1 MB. Review what will be sent and retained, save explicit
consent, then choose **Extract with OpenAI**. Saving consent sends nothing.

Inspect each field's confidence and source reference. Correct ambiguous names,
local dates and times, choose the exact occurrence of any repeated DST time,
and confirm every retained or excluded row against its sources. Validate the
corrected proposal, prepare its saved review, then review and publish the exact
schedule revision. The normal availability, conflict, budget and policy checks
apply. Extracted output cannot publish or alter approved worked time. There are
no automatic provider retries or substitute models.

The owner may explicitly erase the local image, request, extraction and review.
A content-free consent and erasure record remains, as does any prepared schedule
history. Earlier disconnected archives and provider logs cannot be recalled.
Manager access, complete retention and archive erasure fences remain open under
AI-001 and PRIVACY-001. Synthetic live-provider proof does not establish the
required buyer-authorized schedule-photo acceptance.

## Scheduled and worked labor estimates

Choose one cafe and week to open **Labor cost** below the schedule. Scheduled,
worked and approved-time estimates stay separate. Recorded time and open punches
supply worked hours; an unworked shift contributes no worked cost. A pending
correction replaces its source in the worked estimate while approved cost keeps
the last approval. Approved time keeps its effective-dated job rates after a
later rate edit. **Days and jobs** breaks down the estimate, and **Calculation
inputs** shows retained sources, rate dates and unresolved amounts.

The owner opens **Configure burden estimate** to maintain weekly assumptions in
Settings. A percentage of estimated wages and premiums and an additional amount
per payable hour save automatically against the current forecast revision. Blank
components are excluded. These are employer estimates, not tax calculations.
Existing daily sales forecasts and budget percentages drive warnings before
publication, including a copied or applied template. The report never removes
required worked time to make a budget fit.

Worked estimates include available overtime, retained holiday and differential
inputs and reviewed reporting, split and spread premiums. Declared tips remain
separate from employer labor cost. Approved tip pools, paid non-work costs,
complete statutory premiums, separate job budget caps, wider site-role scopes
and provider-applied reconciliation remain open. **Approved time** never means
paid wages. Entered-sales ratios use worked estimates when worked cost exists;
missing rates or classifications keep amounts unknown.
