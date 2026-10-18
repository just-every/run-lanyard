# Schedule, call-outs and time off

**Schedule** is a week calendar: people down the side, Monday to Sunday across, grouped by position, with each person's week hours on the right and the cafe's labor cost under the week. Build a week from recorded availability and approved time off. A draft is preparation; publishing the schedule is a separate human decision.

## Set up people for the schedule

In **People**, give each person a **Position** (the schedule's group, such as "Baristas and counter"), an **Hourly rate** in dollars and a **Home cafe** (such as "Ocean Beach"). Positions decide who can cover whom; rates feed labor cost; home cafes fill the cafe picker in the top bar. All three are optional, but labor cost leaves out anyone without a rate and says so under the week.

## Record availability and time off

Staff open **Schedule**, then **My availability and time off**. Use **Add availability** to save when they can start and finish, or **Request time off** to enter the dates and a reason. Managers record anyone's availability in **Availability** → **Record availability**.

Availability must cover the whole shift. Back-to-back availability windows can cover it together. In **Time off**, a manager or the owner selects **Approve** or **Decline** on another person's request. A pending request is not approved time off; decide requests before publishing.

## Build the week

1. Check the venue time zone. New installations start on the zone given at setup (US Pacific unless you chose another); the owner can change it in **People** before the first schedule is published.
2. Use the arrows in the top bar to reach the week, for example the week of Mon Oct 19, 2026. **Schedule** opens on this week, or on next week when only next week has a call-out still waiting for cover. On a phone it opens on the day of that call-out, and its day is marked in the day picker.
3. In **Build this week** (or **Edit this week**), add the person, start, end, unpaid meal minutes, position label and cafe for each shift. Use **Add another shift** as needed. Leave **Keep this week's shifts** ticked to add to the current week, or clear it to start the week over. To change or drop a shift already in the week, open **Edit or remove this week's shifts**, change its fields or select **Remove**, then prepare the draft. Building the week on this screen needs JavaScript; agents send the same shifts to `roster.prepare` (see **Agent access**).
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

## When someone calls out

Anyone who cannot make a published shift selects it and chooses **I can't make this shift**, with an optional note. A manager who takes the call can do the same for them with **Record a call-out**.

Lanyard then offers the shift to every teammate in the same position who qualifies: available for the whole shift, no overlapping shift or approved time off, and still within 40 hours that week and 8 hours that day. The shift turns claret in its cell and the manager sees the shortlist anchored beside it: each person's week hours before and after, their answer and message, and who was left out and why (overtime first, then whoever is already on).

Teammates answer the offer at the top of their **Schedule** with **Accept** or **Decline** and an optional message. The manager chooses **Approve** on an accepted answer; the shift moves to that person and every other offer closes. **Wait for** closes the shortlist without deciding. The covered cell keeps the call-out and shows when the cover clocks in: the gap closes only at their clock-in.

Continue with [Clock and timesheets](TIME.md) when the team starts work.
