# Learnings UI and Stricter Review — Design

Status: draft · 2026-10-22 · extends `2026-10-20-self-learning-design.md`

## Intent

After two prompts in one project, the learning loop saved eight changes. One was right: the user
wants dev servers reachable on the LAN, and that should hold in every project. Two were wrong:
- A click-ripple effect wanted for one project was saved as a global preference about the user.
- An ASCII-shader page, which the user runs as a test prompt against the model and harness, was
  saved as a skill. That skill contaminates the test from then on.

Two causes:
- The review cannot tell "always" from "this time".
- All memory is global.

The user could also see what was learned only through the CLI.

This change makes the review stricter, adds memory that is scoped to a project, and adds a
Learnings screen to the TUI menus. In that screen the user browses what was learned and manages
it there.

## Goals

1. **Stricter review.**
   - A memory about the user is saved only when the user states it as general ("always",
     "I prefer", "remember this"), or when it recurs across sessions.
   - A skill is created only for a technique that transfers to other tasks. It is never created
     for the task itself, for a one-off build, or for a prompt that looks like a test or demo.
   - When in doubt, save nothing.
2. **Project-scoped memory.** A third memory target, `project`, holds conventions and choices that
   belong to one project. It is injected only into sessions of that project. One-off,
   project-specific choices go here instead of to `user`.
3. **Learnings screen in the TUI.**
   - It opens from the command palette and menus, next to the other settings entries.
   - It shows a list of learnings, each with a short name.
   - The selected learning's details show beside the list on wide terminals, or after Enter on
     narrow ones.
   - The screen offers the same actions as the `openbnk learn` CLI: view the content or diff,
     undo, accept or reject a proposal, and turn learning on or off.

## Non-goals

- Approval for memories about the user. The user considered it and chose to rely on the stricter
  review instead.
- Editing a learning's text in the UI.
- Desktop and web app UI.
- A consolidation or curator pass.
- Excluding a specific prompt from learning. The stricter skill rule covers the test-prompt case.

## Anti-goals

- A screen that lists raw history events so that the user cannot see what is currently in
  effect.
- Project notes that leak into other projects' sessions.
- Writing learned project memory into the project's repository. Learned memory must never become
  a tracked file.
- The TUI reading learning files directly instead of going through the server. The TUI can attach
  to a background server, and that server owns the config dir.

## Constraints

- Follow the root AGENTS.md:
  - Runtime dependency direction: the client never depends on core or server.
  - Run `bun run generate` in `packages/client` after changing the HttpApi. Never edit generated
    files.
  - TUI theme tokens are chosen by semantic role.
  - Add a TUI story for the new screen.
  - Tests follow `.openbnk/skills`.
- `LearningStore` (`packages/util/src/learning-store.ts`) stays the single place that reads and
  writes learning data. The CLI, the tools, the review and the new API all call it.
- The review must still work with a single local model of moderate capability. Prompts stay short
  and explicit.

## Design

### What a "learning" is (the list rows)

The list shows what is in effect now, not history:
- one row per memory entry (`user`, `notes`, and the current project's `project` entries)
- one row per learned skill
- one row per pending proposal, and one per accepted proposal

Each row has:
- a short name: the first words of the entry, or the skill name
- a kind tag: you, environment, project, skill, proposal, accepted
- the time it was learned

The details of the selected row show:
- the full text, or the SKILL.md content
- the most recent change that produced it: time, source (review or agent), and before/after diff
- for a proposal, its reason

Accept and reject apply only to proposals. A toggle on the screen turns learning on or off.

**Remove** replaces undo on rows:
- On a memory row, it removes that one entry through `applyMemory` with action `remove`. The
  removal is recorded as a change like any other.
- On a learned-skill row, it deletes the skill. The deletion is recorded as a change.

Whole-file history undo cannot work on older rows: it refuses once the file has changed since that
edit. So the UI does not use it. Every row can be removed, including rows that have no matching
change, such as hand-edited entries. The details pane shows the most recent change only when one
matches.

**Accepted proposals stay in the list** as rows with kind tag "accepted" (user's decision).
- Their details show the accepted diff.
- Their action is **Revert**. Revert restores the skill's `before` content, but only if the skill
  file still matches the accepted content. Otherwise it refuses and explains that the skill was
  edited since.
- A reverted row leaves the list.
- *(Claude's call: accepted rows stay until reverted, with no expiry. Rejected proposals don't
  get rows.)*

*(Claude's call: the list shows current state. The CLI's history and undo view stays in the CLI.)*

### Project memory

- **Storage:** `learning/projects/<project-id>/NOTES.md` under the global config dir, with a limit
  of about 2 KB. The project ID is the existing core project ID. *(Claude's call: under the config
  dir, not in the repo.)*
- **Who writes it:** the review and the `memory` tool get target `project`. It is valid only when
  the session's project is a real project (a VCS root), not core's shared global or fallback
  project.
  - Without a real project, the tool rejects `project`, and the review prompt omits it.
- **Which project the TUI shows:** the TUI's own directory determines the current project and is
  sent to the API, because a background server's directory is not the user's.
  *(Claude's call.)*
- **Injection:** the existing instruction plugin (`packages/core/src/config/plugin/instruction.ts`)
  injects it as a frozen block at session start, the same way as `USER.md` and `NOTES.md`.

### Review prompt

Rewrite the rules in `SYSTEM` (`packages/core/src/learning/review.ts`):
- the three-target split, with an explicit test to decide between `user` and `project`
- the general-statement or recurrence rule for `user`
- the transferable-technique rule for skills, with the test-prompt and one-off-build example
  named
- "doing nothing is the expected outcome for most reviews"

Recurrence across sessions can be checked with the existing `session_search` tool.

### Server API

Add Learning endpoints to the Protocol/Server HttpApi that wrap `LearningStore`:
- list current learnings, with project context
- get one learning's details
- undo
- accept
- reject
- get and set enabled

Then regenerate the client.

### TUI

- Add a dialog component in `packages/tui/src/component/` that uses the existing dialog and select
  patterns.
- Show a side panel when the terminal is wide enough, and an Enter-to-open detail view otherwise.
- Register it in the command palette or menus where the other settings dialogs are.
- Add a storybook story with fixtures covering:
  - an empty list
  - mixed kinds
  - a pending proposal
  - narrow and wide terminals

## Left to the builder

- Exact endpoint shapes and names.
- Keybindings inside the dialog, consistent with other dialogs.
- The width breakpoint for the side panel.
- How the short name is derived for memory entries.
- Updating the CLI to show project memory.
