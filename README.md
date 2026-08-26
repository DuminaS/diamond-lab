# Gridiron Lab — moving to VS Code + Claude Code

This folder is a complete, self-contained snapshot of the game plus the full development history,
packaged so a local Claude Code session picks up right where the Cowork session left off. Three
files matter:

- `index.html` — the game itself. Open it directly in any browser and it runs, no server needed.
- `CLAUDE.md` — auto-loaded by Claude Code on startup; a short orientation plus pointers.
- `PROGRESS.md` — the full round-by-round development log: every decision, formula, and bug fix.

## 1. Unzip this into a folder you'll keep

Pick a permanent location, e.g. `~/projects/gridiron-lab/`, and unzip the download there.

## 2. Install VS Code (if you don't have it)

Download from https://code.visualstudio.com and install it. Then open this folder: `File > Open
Folder...` and select the one you just unzipped.

## 3. Install Claude Code

Claude Code is a command-line tool; VS Code has an extension that integrates it into the editor.

- Install the CLI: follow the instructions at https://docs.claude.com/en/docs/claude-code — the
  short version is usually `npm install -g @anthropic-ai/claude-code` (needs Node.js installed
  first — https://nodejs.org if you don't have it), then run `claude` once from a terminal to log in.
- Install the VS Code extension: inside VS Code, open the Extensions panel (`Cmd/Ctrl+Shift+X`),
  search "Claude Code," and install it. It gives you Claude Code in a side panel instead of a
  separate terminal window, with the same underlying tool.

## 4. Open a terminal in this folder and start Claude Code

In VS Code: `Terminal > New Terminal` (it opens already in this folder). Run:

```
claude
```

It will automatically read `CLAUDE.md` for context. From here you can just talk to it the same way
you were talking to this Cowork session — ask it to read `PROGRESS.md` for more detail on anything,
make changes, run tests, etc.

## 5. Put it under version control

This preserves history going forward (every future change becomes a commit you can diff or revert),
which matters a lot once you start restructuring this into a multi-file app. From the terminal in
this folder:

```
git init
git add .
git commit -m "Import Gridiron Lab from Cowork session"
```

If you don't already have a GitHub/GitLab account and want a remote backup, create an empty repo
there and follow its instructions to `git remote add origin ...` and push — Claude Code can also
walk you through this interactively if you just ask it.

## 6. Previewing the game while you work

Since it's one static HTML file, you can just open it directly in a browser (double-click it, or
drag it into a browser window) after any edit. If you'd rather have it auto-reload on save, the VS
Code extension "Live Server" gives you that with one click ("Go Live" in the bottom status bar)
once installed — not required, just a convenience.

## What to tell Claude Code first

Once it's running, a good opener is something like: "Read CLAUDE.md and PROGRESS.md, then give me a
one-paragraph summary of where things stand" — that confirms it has picked up the full context
before you ask it to change anything.
