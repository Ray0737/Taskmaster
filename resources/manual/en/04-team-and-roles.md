# Team and roles

Taskmaster keeps your team's roles, tasks, notes and presence in the same git repository, on a separate branch called `taskmaster/context`. The branch never mixes with your code branches and your working folder is never touched by it.

## Enable Taskmaster

Open the Team (or Tasks) view. If the project has no team data you see **Enable Taskmaster** (also as a bar above the editor). You need:

- a remote called `origin` (for a new project: tick "Create a GitHub repository", or push it with Source Control → Sync first)
- at least one commit

You become the **lead** and the first member. Teammates who open the same repository later join automatically the first time they open it.

## Members

The Team view lists everyone with a role and what they are doing: **working on "task"**, **idle** or **offline**. You count as online while your app has sent a heartbeat in the last 3 minutes.

**Add member** (the person icon): type a GitHub login, or pick from the repository's collaborators. If you are signed in to GitHub, Taskmaster sends the repository invitation for you; otherwise it only adds the person to the team and you must give them access on GitHub yourself.

## Roles

Roles tell each agent what its person is responsible for. The presets are **Front end**, **Back end**, **DB / MCP** and **Custom**. Under **Roles** the lead can edit the prompt of each role (click outside the box to save) and add roles of their own. Everyone else sees the same text read-only.

Each member has one role, chosen by the lead in the member's row. A task can have its own role too, and the agent uses the task's role while working on that task.

## Who can change what

Taskmaster trusts your team: anyone with write access to the repository can edit team data. If two people change the same task at the same moment, the last one to sync wins for that task. See "Sync and offline".

The **Skills** list in the Team view holds Claude Code skills your team shares. Anyone can add, edit or delete one. Each teammate chooses whether their agent loads them with **Use team skills in the agent** in Settings → Agents, because a skill is an instruction written by a teammate. A skill runs as `/team:name`.

To reuse skills published on GitHub, press **Import from GitHub** in the Skills list, paste a repo or folder link, tick the skills and import. The whole skill folder is copied, scripts and reference files included, and it shows where it came from. Imported skills are read-only here; delete one and import it again to update it. Only import from sources you trust: an imported skill can contain scripts that an agent may run.

Each member's row shows what they are doing, including **agent running** while their agent is answering, and the branch they are on. The status refreshes about once a minute and reads offline after three minutes without an update.
