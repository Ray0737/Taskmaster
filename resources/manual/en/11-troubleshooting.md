# Troubleshooting

Find the symptom, then the fix.

## Setup

| Symptom | Fix |
|---|---|
| Welcome says Git was not found | Install Git for Windows, then press **Re-check**. |
| Cannot continue past Welcome | Git and your Git identity (name and email) are required; GitHub and agents are optional. |
| The status bar says "GitHub: offline mode" | Click it and sign in, or open **Settings → Account → Reconnect**. Without GitHub, git still works. |
| Clone or push says authentication failed | Press **Connect GitHub** (Settings → Account → Reconnect) and try again. |

## Projects and git

| Symptom | Fix |
|---|---|
| "Not a git repository" when opening a folder | Choose **Initialize**, or open the repository's root folder instead of a subfolder. |
| Sync says the remote has new commits | Press **Sync** again; it pulls first. |
| "Conflicts: resolve in terminal" | Press **Open terminal**, run `git status`, fix the listed files, `git add` them and `git rebase --continue`. |
| Switching branch is refused | Git protects your uncommitted edits. Commit or stash them, then switch. |
| A file on disk changed while I had it open | A bar offers **Reload**, **Keep Mine** or **Compare**. |
| A file I had open was deleted | Its tab is struck through and read-only; close it. |
| The terminal does not open | The terminal component could not start. Open **Help → Open Logs Folder** and look at `main.log`; reinstalling the app usually fixes it. |

## Team

| Symptom | Fix |
|---|---|
| **Enable Taskmaster** says there is no remote | Create the GitHub repository (Source Control → Sync after adding a remote, or New project with "Create a GitHub repository"), then enable. |
| It says to make a first commit | Commit something, then enable. |
| Team views are empty or old | The status bar item tells why: offline, paused or conflict. Click it to sync now. |
| "Sync conflict" in red | Click the item and **Reset to remote**. Only your unsynced team changes are lost. |
| A teammate's changes do not show | They appear after their next push and your next fetch (15 s by default). Press the status bar item to fetch now. |
| I cannot invite a teammate | Without GitHub access Taskmaster cannot invite; add them anyway and give them write access on GitHub. |

## Agents

| Symptom | Fix |
|---|---|
| "No agent connected" | Install Claude Code (or another supported CLI) so it is on your PATH, then **Rescan**. |
| "The agent is not signed in" | Press **Open terminal to sign in** and finish the login. |
| "Blocked by the current mode" | Switch the mode to **Edit** or **Full** and ask again. |
| An error with **Retry** | Read the lines under the message, fix the cause (network, login, path) and press **Retry**. |
| The agent is slow to start | Your own Claude hooks and plugins run as in a terminal; they can add seconds. |
| Codex, Gemini, Aider or opencode show no tool rows | They have basic support only: one plain-text answer per message. |

## The app

| Symptom | Fix |
|---|---|
| A panel shows "… crashed" | Press **Reload view**. The rest of the app keeps working. |
| Something odd happened | **Help → Open Logs Folder** and look at `main.log`. |

## Not in this version

Real-time co-editing of the same file, a merge-conflict editor, in-app pull request review, other operating systems than Windows.
