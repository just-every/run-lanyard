# Getting started

Lanyard is for a small Australian venue running one weekly roster. Start locally, finish your owner account, then add the people who will use it.

## Run Lanyard

Install Git and Node 22 or newer. In a terminal, install the launcher once and clone Lanyard:

```sh
npx -y @runeditrun/rer cli install
export PATH="$HOME/.local/bin:$PATH"
git clone https://github.com/just-every/run-lanyard.git
cd run-lanyard
rer dev
```

First launch installs pinned dependencies, prepares the local database and starts the app. It can take several minutes. If interrupted, run `rer dev` again; it resumes.

Open the private `RER_OPEN` link printed in the terminal. Review the owner account on **Finish setup**, confirm it is ready, then select **Finish setup**. Keep that link private. `RER_READY` is the ordinary app address.

For a new installation with your own email, run `rer install`, then `rer setup --owner-email you@example.com`, then `rer dev`. Local messages are silently suppressed. Reopen the private `RER_OPEN` link to sign in locally.

Keep the development server private. Stop it with `rer dev --stop` or Ctrl-C. The repository [README](../README.md) also covers deployment to your own account.

## Set the venue timezone

In **People**, choose your venue's timezone and select **Save venue timezone** before publishing the first roster. Australia/Brisbane is the default.

Dates and time entry use this venue timezone on every device. The timezone becomes fixed after the first roster publication. If you change it before then, prepare existing drafts again.

## Add and invite people

1. Open **People** and enter a person's full name, unique email and payroll ID.
2. Choose **Staff** or **Manager**, review **Active**, then select **Add person**.
3. Open **Invite to Lanyard** on their card and select **Send invitation**. Only the owner grants access.
4. Have the person follow the invitation using their own email identity.

For a whole team, use [Move in](MOVE-IN.md). Imported people start inactive; review their details, activate them and send invitations separately.

Local invitations are silently suppressed. To invite people into a real installation, deploy it with your configured mail provider; recipients follow the emailed invitation link.

## Who does what

| Role | Main work |
| --- | --- |
| Owner | Set up the team, grant and revoke access, import staff, manage agent credentials, and manage rosters, time and payroll. |
| Manager | Prepare and publish rosters, decide another person's leave, review and approve another person's hours, and export payroll hours. |
| Staff | Record their availability, request leave, see and confirm their own published shifts, and clock in and out. |
| Agent | Prepare roster, timesheet and payroll drafts with a scoped credential. A person publishes, approves or exports. |

A manager cannot approve their own hours. Arrange for the owner or another manager to review them. Leave requests also need a different person to decide them.

## Your first week

Start with [Roster and leave](ROSTER.md), then [Clock and timesheets](TIME.md), then [Payroll exports](PAYROLL.md). Keep a [private backup](BACKUP-RESTORE.md) before moving installations or removing local data.
