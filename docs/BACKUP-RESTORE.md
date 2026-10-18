# Backup and restore

Keep private archives of your installation before moving it or removing local state. Stop the app before command-line data operations.

## Create a backup

From the installation's checkout root:

```sh
rer dev --stop
rer export --output exports/lanyard.rer
```

Store the archive privately. It contains staff identity details and work records. Restart the app with `rer dev` when the export is complete.

## Restore into an empty installation

Use a fresh clone of the same source revision. Restore before setup or adding staff data:

```sh
npx -y @runeditrun/rer install just-every/run-lanyard
cd run-lanyard
rer import --input /private/path/lanyard.rer --yes
rer setup --owner-email original-owner@example.com
rer dev
```

Use the archived owner's email during setup. Import refuses a populated destination and rejects damaged archives. Do not reset a working installation merely to try a restore; use a separate fresh checkout.

The archive includes owner and staff identities, schedules, hours, payroll files, import originals and journals. Sessions, sign-in links, agent keys, credentials and the development outbox do not travel. Re-enter private configuration, sign in again and create new agent credentials if needed.

## Check the restored installation

Sign in as the original owner. Check **People**, the published schedule, timesheet history and payroll batches. Confirm that an exported batch is still downloadable, and that import jobs and their journals are present. Invite or sign in staff again as needed; an old session is not restored.

## Preserve erasure decisions

An erasure fence in the destination prevents an earlier archive restoring an erased identity. When restoring an old archive after erasure, provide a later archive as the journal:

```sh
rer import --input OLD.rer --journal LATER.rer --yes
```

A destination or later journal holding the erasure fence refuses the earlier archive. An old offline backup cannot know about a later erasure. Protect and retire older copies yourself.

## Remove access

In **People**, select **Edit** on the person's row, clear **Active** and select **Save person**. Deactivation revokes that person's app access immediately while retaining employment records. In **Agent access**, select **Revoke credential** to revoke a preparation key.

**Erase unused staff** applies only to unused, never-invited, manually created people. It replaces identity details and records a restore fence. It does not erase employment history or imported identities. Deactivate people whose records must be retained.

## Remove local data

`rer reset --yes` destroys local data and settings. Export first if you need to keep them. Run it only in the installation you intend to remove, with the app stopped.
