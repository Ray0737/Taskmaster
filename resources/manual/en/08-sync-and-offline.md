# Sync and offline

Two different things are synced: your code (Source Control → Sync) and your team data (automatic). This chapter is about team data.

## Where team data lives

On the branch `taskmaster/context`, in a folder `.taskmaster/`:

- `team.json` — lead, members, roles
- `tasks/<id>.json` — one file per task
- `notes/<task id>/…md` — one file per note, never edited afterwards
- `presence/<login>.json` — who is online, written only by that person

Taskmaster checks this branch out in a separate folder inside the app's data folder (`%APPDATA%\taskmaster\worktrees`), so your project folder and your current branch are never changed by it.

## How it syncs

- About 3 seconds after you change something, it is committed (message `tm: <login> …`) and pushed.
- Every 15 seconds (30 or 60 in **Settings → Sync**) it fetches what teammates did and merges it. The Tasks and Team views update by themselves.
- Your presence is refreshed every minute.

If two people edit the same file at the same time, your version wins on your side and the last push wins for everyone. Notes and presence never clash because only one person writes each file.

## The status bar

The item at the left shows how many people are online. Its icon and tooltip show the state:

- up to date
- syncing
- **offline** — no network or no access. Your changes are kept and pushed as soon as it works again; Taskmaster retries after 15 s, then 30 s, 1 min, 2 min and every 5 min. Click the item to try now.
- **Sync conflict** (red) — the team data could not be merged automatically. Click it and choose **Reset to remote** to throw away your unsynced team changes and take the remote version.
- paused — switched off in Settings → Sync. Tick it off again to resume.

## Repairing by hand

Everything is ordinary git: you can inspect the branch with `git log origin/taskmaster/context` and the files with `git show origin/taskmaster/context:.taskmaster/team.json`. A damaged file is simply ignored by the app.
