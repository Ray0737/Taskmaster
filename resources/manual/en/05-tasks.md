# Tasks

A task is one piece of work for one person, with a brief, a role and an optional scope of files.

## Creating and editing

Press **+** in the Tasks view, type a title, and the task opens as a tab. There you set:

- **Brief**: Markdown text for the person and their agent (**Preview** shows the result)
- **Role** and **Assignee**
- **Status**: To do, Doing, Review, Done
- **Scope (file globs)**: for example `src/ui/**`. Type a glob and press Enter. The agent is warned (not blocked) when it edits a file outside the scope. Empty means anywhere.
- **Delete task**: removes the task and its notes for the whole team after you confirm. Branches and commits stay as they are.

Changes save by themselves a moment after you stop typing.

## The Tasks view

**Mine** / **All** switches whose tasks you see, and the role filter narrows them. Tasks are grouped as Doing, To do, Review and Done (Done starts collapsed). A badge on the Tasks icon counts your open tasks.

## Starting a task

Press **Start task** (in the task tab, or **Start Task…** in the command palette). Taskmaster then:

1. creates the branch `tm/<your-login>/<task-id>` from the project's default branch (or switches to it if it exists). If you have uncommitted changes it asks you to **Stash them** or **Commit them** first, or you can cancel; nothing is lost either way.
2. sets the task to **Doing** and assigns it to you if it had no assignee.
3. binds the agent panel to the task and marks you as working on it.

## Finishing

When the agent ends its answer with a short `<tm-note>` summary, Taskmaster saves it as a note on the task and moves the task to **Review**. If the agent did not write one, a box above the chat input offers to save the last answer as a note. You can also add notes by hand in the task tab and press **Mark as review** or **Mark as done** yourself.

**Open pull request** (in the task tab and in Source Control on a `tm/…` branch) opens GitHub's pull request page for the branch. Press Sync first so the branch is on GitHub.

Notes from the whole team are visible to every agent: the newest five are included in what each agent is told, so a back-end note about a new endpoint reaches the front-end agent.

## Screenshots

Open a task and press **Ctrl+V** after copying an image (a screen capture, for example). It appears under **Screenshots**; click it to enlarge, or use the cross to remove it. Screenshots are shared with the team like notes (up to 10 per task, 4 MB each, png, jpg, webp or gif). When an agent runs with that task selected, it is told where the screenshots are and can open them, so "here is what is wrong, fix it" works with a picture.

## Selecting several tasks

In the task list, `Ctrl+click` (or `Space`) adds or removes a task from the selection and `Shift+click` selects everything between the last click and this one. A bar appears with **Set status**, **Assign to me** and **Delete** for all selected tasks. A plain click opens one task and clears the selection.
