# Agents

The right-hand panel talks to a coding agent that runs on your computer, inside your project folder.

## Supported agents

Taskmaster looks for these programs on your PATH when it starts and when you press **Rescan** (Settings → Agents):

- **Claude Code** — full support: live text, tool rows, diffs, cost, remembered conversations.
- **Codex CLI, Gemini CLI, Aider, opencode** — basic support: one answer per message as plain text, no conversation memory, no tool rows.

If none is found the panel explains how to install Claude Code.

## The header

- **Agent**: which program to use.
- **Mode** (Claude Code): **Read-only** (the agent may look but not change anything), **Edit** (it may edit files; most shell commands are blocked because nobody can approve them in the app), **Full** (it may run any command; shown with a red warning). The default is **Edit**; change the default in Settings → Agents.
- **Task**: which task the agent works on, or "No task" for a plain chat that still knows your role and your teammates' work.
- **Context**: shows exactly what the agent is told about your role, task, file scope, teammates and recent notes.

## Chatting

Type in the box at the bottom. Enter sends, Shift+Enter starts a new line. While the agent works the button becomes **Stop**, which ends it and everything it started.

The conversation shows your messages, the agent's answers (Markdown, with a copy button on code blocks) and one line per tool call (for example "Edit src/App.tsx"). Click a line to see its input and output; click the file name to open the file, or, for an edit, its diff against the last commit.

The footer shows tokens and, for Claude Code, the cost of the last answer.

Conversations continue where they stopped, per project and per task, even after you restart the app. **New chat** starts fresh.

## Messages from Taskmaster

- **Blocked by the current mode** — the agent wanted to do something the mode does not allow (usually run a command). Switch to Edit or Full and ask again.
- **Outside task scope** — the agent edited a file that is not in the task's scope. Look at the change; nothing is blocked.
- **The agent is not signed in** — press **Open terminal to sign in** and finish the login there.
- **The agent stopped with an error** — the last lines of its error are shown with **Retry**.

## Your own Claude settings

Claude Code runs with your normal configuration, including your own hooks and plugins. They can add text to answers or slow startup, exactly as in a terminal.
