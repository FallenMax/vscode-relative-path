# File Path Inserter

Pick any file from a fuzzy finder and insert its path at the cursor — relative, workspace-relative, or absolute.

## Features

- **Three path formats** via separate commands (bind any key you like):
  - `Insert Path: Relative to Current File` — e.g. `../utils/helper.ts`
  - `Insert Path: Relative to Workspace Root` — e.g. `src/utils/helper.ts`
  - `Insert Path: Absolute` — e.g. `/Users/you/project/src/utils/helper.ts`
- **Respects `.gitignore`** — uses VSCode's bundled ripgrep, same filtering as the editor's built-in file search
- **Respects `files.exclude` and `search.exclude`** workspace settings
- **Multi-cursor support** — inserts into all active cursors simultaneously
- Replaces selection if text is selected

## Usage

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for **Insert Path**.

To bind keyboard shortcuts, add entries to your `keybindings.json`:

```json
[
  { "key": "ctrl+shift+i", "command": "insert-path.relative" },
  { "key": "ctrl+shift+alt+i", "command": "insert-path.workspaceRelative" }
]
```

## How it works

File listing is done by spawning the ripgrep binary bundled with VSCode (`vscode.env.appRoot`). This gives identical filtering behaviour to `Ctrl+P` (Quick Open): `.gitignore`, `.ignore`, `files.exclude`, and `search.exclude` are all honoured. No extra binaries are downloaded at install time.
