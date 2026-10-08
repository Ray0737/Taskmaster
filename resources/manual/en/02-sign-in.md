# Sign in

Taskmaster does not have its own accounts. It uses what is already on your computer: Git, and the GitHub login that Git Credential Manager (installed with Git for Windows) or the GitHub CLI (`gh`) already keeps.

## What you need

- **Git** (required). If it is missing the Welcome screen links to the download page.
- **Git identity** (required): your name and email. If they are not set yet, type them on the Welcome screen and press **Save**. They are stored with `git config --global`.
- **GitHub** (optional): needed to pick repositories, create repositories, invite teammates and show your picture.

## Connecting GitHub

If you are already signed in with `gh` or Git Credential Manager, Taskmaster finds the login by itself and shows "Signed in as @you". Otherwise press **Connect GitHub**: the Git Credential Manager login window opens in your browser. After you approve, the row turns green.

The token stays in memory only. It is never written to disk and never shown. **Settings → Account** shows who you are and has a **Reconnect** button.

## Git-only mode

Without a GitHub login everything about git still works: opening folders, cloning by URL, committing, branches, Sync. These features are off, and the app tells you why when you reach them:

- choosing a repository from your GitHub list when cloning
- creating the GitHub repository for a new project
- inviting teammates from the Team view (you add them by login and ask them to accept access on GitHub yourself)

The status bar shows **GitHub: offline mode**. Click it to connect later.
