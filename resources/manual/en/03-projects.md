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

## Languages and running a file

The editor colors Python, C, C++, C#, Java, Go, JavaScript, TypeScript, JSX and TSX, JSON, HTML, CSS, Markdown, shell and many more by file extension. Arduino sketches (`.ino`) are shown as C++ and .NET project files (`.csproj`, `.xaml`) as XML. JavaScript and TypeScript suggest completions inside the file and flag syntax errors; there are no error squiggles for imports, because the editor does not read `node_modules`.

Press the play button above the code, or **Run File** (Ctrl+F5), to run the current file in the terminal with the tools on your computer: `python`, `node`, `npx tsx` (TypeScript and TSX), `gcc` and `g++` (compiled into the temp folder), `dotnet run`, `java` and `go run`. The tool must be installed and on your PATH. Unsaved changes are saved first. Arduino sketches cannot be run yet.

## Find in files

The **Search** view in the left bar (Ctrl+Shift+F, or **Find in Files**) searches every text file in the project while you type. Three buttons next to the box match case, match whole words, or read the text as a regular expression. Results are grouped by file; click one to open the file with the match selected. Build and dependency folders (`node_modules`, `dist`, `out`, `.git` and similar), binary files and files over 1 MB are skipped, and a very long list is cut short with a note.

## Formatting

**Format Document** (Shift+Alt+F) tidies the current file. It works for JavaScript, TypeScript, JSON, CSS and HTML. Turn on **Format on save** in Settings, Editor to format those files every time you save. Other languages say they have no formatter.
