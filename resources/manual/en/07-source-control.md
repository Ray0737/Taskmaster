# Source control

The Source Control view is a small git client for your project.

## Changes

- **Changes** lists edited, new and deleted files with a letter: M modified, A added, U new (untracked), D deleted, R renamed, ! conflict. The Explorer shows the same letters, and a dot on folders that contain changes.
- Click a file to see its diff against the last commit.
- Hover a row for **Stage**, **Unstage** and **Discard Changes**. Discard asks first and cannot be undone. The icons in the section headers stage or unstage everything.

## Committing

Type a message and press **Commit** (or Ctrl+Enter). The button is enabled when something is staged and the message is not empty. Multi-line messages are kept as typed.

## Branches

The branch button (here and in the status bar) lists local branches with the current one ticked, and **Create branch…** makes a new one. Git refuses to switch when your changes would be overwritten; nothing is lost.

## Sync

**Sync** shows how many commits you are ahead (↑) and behind (↓). It pulls with rebase (keeping your uncommitted changes aside), then pushes. A branch that has never been pushed is pushed and starts tracking. If the pull hits conflicts you get the message "Conflicts — resolve in terminal" with **Open terminal**; resolve them with normal git commands (`git status`, edit files, `git add`, `git rebase --continue`).

## Pull requests

On a `tm/…` branch the **Open pull request** button opens GitHub's page for that branch (the branch must be pushed).

## Not included

There is no merge-conflict editor and no in-app pull request review in this version; use the terminal and GitHub for those.
