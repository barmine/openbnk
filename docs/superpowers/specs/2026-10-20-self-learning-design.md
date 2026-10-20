# openbnk Self-Learning Loop — Design

Status: draft for approval · 2026-10-20

## Intent

openbnk should get better the more it is used. Its model is inspired by Hermes Agent's learning
loop (NousResearch/hermes-agent):

- It keeps curated memory about the user and their environment.
- It writes and refines skills from experience.
- It can recall how past sessions handled something.

All of this runs against the user's local inference server. Nothing is sent anywhere else.

The user's goal is "the best harness possible". Success means that corrections the user gives
once ("don't do X", "use this command here") stop needing to be repeated, and that recurring
kinds of task start right the first time.

## Goals

1. **Persistent memory.** There are two bounded notes files, loaded into every session.
2. **Background review.** Periodically, and when a session ends, a background model pass
   reviews the conversation and updates memory and skills. It never blocks the user's session.
3. **Self-written skills.** The agent creates and patches skills in a dedicated "learned"
   skills folder, using the existing SKILL.md format.
4. **Past-session recall.** The agent can run a full-text search over past session messages
   through a tool.
5. **Mixed control** (the user's chosen split):
   - **Auto-applied:** memory changes, and changes to skills in the learned folder. Each change
     shows a one-line notice in the session with an undo option.
   - **Needs approval:** any change to a skill that the user installed or wrote. These changes
     are queued as proposals until the user accepts or rejects them.
   - **Always undoable:** every applied change is versioned. A `openbnk learn` CLI command and
     a TUI view list recent changes and pending proposals, and allow undo, accept and reject.

## Non-goals (for this version)

- Offline prompt evolution (DSPy/GEPA, which is the hermes-agent-self-evolution repo).
  This is a possible later phase.
- User modeling via an external service such as Honcho.
- A skills marketplace or hub.
- A periodic "curator" pass that consolidates the whole library.
- Learning in the desktop or web app UI. The CLI/TUI comes first. The server-side pieces must
  not prevent adding these later.

## Anti-goals (failure even if it "works")

- Network calls to anything other than the configured model provider.
- Silent edits to user-owned skills.
- Slowing down or interrupting the user's main session. Review must be asynchronous.
- A hoarding library: one narrow skill per session, incident narratives, or duplicated rules.
- Breaking the model's prompt cache mid-session. Memory is loaded into the prompt once, as a
  snapshot at session start. Writes made during a session take effect in the next session.
  This matches Hermes.

## Constraints

- openbnk conventions apply (Effect services, plugin `define`, Bun APIs). See the root AGENTS.md.
- The design must stay merge-friendly with upstream. New code goes in new files where possible,
  and changes to upstream files are kept small.
- It must work with a single local model of moderate capability. Prompts must be short and
  explicit, and they must tolerate a review pass that does nothing or fails.
- It must not change behavior for subagent sessions or for the review sessions themselves.
  Review sessions never trigger review, which prevents recursion.

## Design

### Storage (under openbnk's global config dir, `Global.config`, overridable by `OPENBNK_CONFIG_DIR`)

```
learning/
  memory/USER.md          # who the user is: preferences, style, setup     (limit ~1.5 KB)
  memory/NOTES.md         # environment facts, project quirks, conventions  (limit ~2.5 KB)
  history/                # versioned record of every applied change (for undo)
  proposals/              # pending changes to user-owned skills
skills/learned/<name>/SKILL.md   # agent-written skills; discovered by the existing skill loader
```

Entries in the memory files are delimited so that the tool can add, replace or remove a single
entry. The size limits are enforced by the tool: when a write would exceed a limit, the tool
asks the model to consolidate entries instead of rejecting the write outright.

### Tools (new core tool plugins)

- `memory`: `add` | `replace` | `remove`, with `target` set to `user` | `notes`.
- `skill_manage`: `create` | `patch` | `write_file` | `delete`. The tool decides what happens
  based on where the skill lives:
  - A skill under `skills/learned/` is changed immediately and versioned.
  - Any other skill (one the user installed or wrote) gets a proposal written to `proposals/`.
    The tool tells the model that the change is pending user approval.
- `session_search`: a full-text query over past sessions' message text. It returns matching
  snippets with session titles and dates. The model can then read further using the existing
  session/history access.

All three tools are available to the main agent as well as to the review pass, so the user can
also say "remember this" directly.

### Background review

- **Trigger:** the review runs after every N tool-using steps (default 10, configurable), when a
  session goes idle, and when a session ends. These are counted per session.
- **Execution:** the review is a separate, hidden session with the same model. Its input is the
  parent conversation plus a review prompt adapted from Hermes's memory, skill and combined
  review prompts (see `agent/background_review.py` in hermes-agent). The prompt covers:
  - signals to look for: corrections, frustration, techniques, wrong or outdated skills
  - a preference order: patch a loaded skill, then extend an existing one, then create a new one
  - the "lesson layer" writing rules
  - read-before-write
- The review session only has these tools: `memory`, `skill_manage`, `session_search`, and
  read-only skill viewing. It is excluded from session lists and stats, and it never triggers
  its own review.
- **Placement:** it hooks in next to the existing background session-title generation in the
  session runner (`packages/core/src/session/runner/llm.ts`). It is fire-and-forget and
  per-session deduplicated, using the same pattern as title generation.
- **Failure handling:** a failed or empty review is logged and ignored.

### Visibility and control

- **Notices:** every applied change emits a bus event. The TUI shows it as a one-line notice
  in the session, for example `learned: updated skill "rust-build" · undo`. A proposal shows as
  `learned: proposed change to "my-skill" · review`.
- **`openbnk learn` CLI:**
  - `list`: recent changes and pending proposals
  - `show <id>`: the diff
  - `undo <id>`
  - `accept <id>`
  - `reject <id>`
  - `off` / `on`
- **TUI:** a dialog with the same list, actions and diffs.
- **Config:** `learning.enabled` (default true), `learning.reviewInterval` (default 10),
  `learning.memoryLimits`.

### Memory injection

At session start, the contents of `USER.md` and `NOTES.md` are added to the system instructions
as a frozen block. They use the existing instruction mechanism (`session/instructions.ts`).

## Calls made by Claude (not explicitly decided by the user)

- The two files are named `USER.md` and `NOTES.md`, with the size limits listed above.
- The review runs every 10 tool steps, plus when a session goes idle and when it ends.
- The learned skills folder is `skills/learned/` under the global config dir, so it is global
  rather than per project.
- All three tools are also exposed to the main agent, not just to the review pass.
- `session_search` is implemented as full-text search over the existing local session database.
- CLI first, then a TUI dialog. Desktop and web UI are out of scope for now.

## Left to the builder

- The exact Effect service layout, event names, and how proposals are stored (a full file or a
  diff).
- The full-text index mechanism (SQLite FTS5 table vs. LIKE fallback) and backfill of existing
  sessions.
- How the TUI renders the notice and the dialog layout, following the TUI theme-token rules in
  AGENTS.md.
- Tests, following existing package test conventions.
