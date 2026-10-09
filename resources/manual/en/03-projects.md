# Projects

A project is a normal git repository in a normal folder. Nothing special is added to it.

## The Home screen

With no folder open the editor area shows **Start** (New project, Open folder, Clone repository) and **Recent**. Hover a recent project to remove it from the list (the folder itself is never touched).

## New project

**New project** asks for a name and a location (**Browse…**). It creates the folder, runs `git init`, writes a README and makes the first commit. Tick **Create a GitHub repository** (and **Private repository**) to create it on GitHub and push it at once; this needs a GitHub login. If GitHub fails, the local project is still created and you see a warning.

Names cannot contain `\ / : * ? " < > |`, cannot end with a dot or space and cannot be Windows-reserved names such as `CON`.

## Open folder

Pick any folder. If it is not the root of a git repository Taskmaster offers to **Initialize** one. If you have unsaved edits in the current project you are asked before they are discarded.

## Clone repository

- **GitHub** tab: search your repositories (including organizations you belong to) and pick one.
- **URL** tab: paste any git URL; the folder name is filled in for you.

Choose **Clone into**, press **Clone**. A progress bar shows the download and **Cancel** stops it. The project opens when it finishes.

## Closing

**File → Close Folder** returns to Home. Taskmaster stops syncing the team while no project is open.

## Markdown preview

Right-click a `.md` file in the Explorer and choose **Open Preview** to read it rendered, with headings, tables and links. The preview follows your edits, saved or not. It is read-only; edit in the file's own tab. Links open in your browser. The same command is in the command palette as "Open Markdown Preview".
