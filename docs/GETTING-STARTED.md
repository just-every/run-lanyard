# Getting started

Lanyard runs one location's weekly schedule today: people, availability and time off, published shifts, clocking in by phone, approved timesheets and payroll CSV exports. Start locally, finish your owner account, then add the people who will use it.

## Run Lanyard

In a terminal, install rer, then start Lanyard. These are the same two lines as the site's [Run page](https://run-lanyard.com/run):

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
rer dev just-every/run-lanyard
```

The installer puts rer in your home folder, with its own Node if you have no Node 22 or later. If its last line puts rer on your PATH, run that line before the second command. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-lanyard` does both steps in one line. To start it again later, run `cd run-lanyard && rer dev`. First launch installs pinned dependencies, prepares the local database and starts the app. It can take several minutes. If interrupted, run `rer dev` again; it resumes.

Open the private `RER_OPEN` link printed in the terminal. Review the owner account on **Finish setup**, confirm it is ready, then select **Finish setup**. Keep that link private. `RER_READY` is the ordinary app address.

For a new installation with your own email, run `npx -y @runeditrun/rer install just-every/run-lanyard`, then `rer setup --owner-email you@example.com` and `rer dev` from the checkout. Local messages are silently suppressed. Reopen the private `RER_OPEN` link to sign in locally.

Keep the development server private. Stop it with `rer dev --stop` or Ctrl-C. The repository [README](../README.md) also covers deployment to your own account.

## Set the venue time zone

Setup asks for the venue time zone and offers US Pacific (Los Angeles). To change it later, open **People**, choose yours in **Venue time zone** (for example Eastern (New York) for the East Coast) and select **Save time zone** before you publish your first schedule.

Dates and time entry use the venue time zone on every device. It becomes fixed once the first schedule is published. If you change it before then, prepare existing drafts again.

## Add and invite people

1. Open **People** and, in **Add a person**, enter a person's full name, unique email, position, hourly rate, home cafe and payroll ID.
2. Choose **Staff** or **Manager**, review **Active**, then select **Add person**.
3. Select **Edit** on their row, open **Invite to Lanyard** and select **Send invitation**. Only the owner grants access.
4. Have the person follow the invitation using their own email identity.

For a whole team, use [Move in](MOVE-IN.md). Imported people start inactive; review their details, activate them and send invitations separately.

Local invitations are silently suppressed. To invite people into a real installation, deploy it with your configured mail provider; recipients follow the emailed invitation link.

## Who does what

| Role | Main work |
| --- | --- |
| Owner | Set up the team, grant and revoke access, import staff, manage agent credentials, and manage schedules, time and payroll. |
| Manager | Prepare and publish schedules, set the sales forecast, record and cover call-outs, decide another person's time off, review and approve another person's hours, and export payroll hours. |
| Staff | Record their availability, request time off, see and confirm their own published shifts, call out of a shift, answer cover offers, and clock in and out. |
| Agent | Prepare schedule, timesheet and payroll drafts with a scoped credential. A person publishes, approves or exports. |

A manager cannot approve their own hours. Arrange for the owner or another manager to review them. Time-off requests also need a different person to decide them.

## Your first week

Start with [Schedule, call-outs and time off](SCHEDULE.md), then [Clock and timesheets](TIME.md), then [Payroll exports](PAYROLL.md). Keep a [private backup](BACKUP-RESTORE.md) before moving installations or removing local data.
