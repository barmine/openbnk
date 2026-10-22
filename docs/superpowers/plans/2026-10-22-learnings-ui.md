# Learnings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the learning review stricter, add project-scoped memory, and add a Learnings screen
to the TUI where learnings can be browsed and managed.

**Architecture:** All learning data stays in `LearningStore` (`packages/util`). A new
location-scoped `server.learning` HttpApi group wraps the store. Being location-scoped gives the
handler the session's project. The TUI gets a feature plugin page, modeled on
`feature-plugins/system/stats.tsx`, that calls the generated client.

**Tech Stack:** Bun, Effect HttpApi, SolidJS/OpenTUI.

**Spec:** `docs/superpowers/specs/2026-10-22-learnings-ui-design.md`

## Global Constraints

- Runtime dependencies:
  - The client never depends on core or server.
  - Run `bun run generate` in `packages/client` after changing the API. Never edit generated files.
- Theme tokens are chosen by semantic role:
  - kind tags and labels use `text.muted` or `formfield` tokens
  - errors use `text.feedback.error`
- Project memory never goes into the repo. It lives at
  `<config>/learning/projects/<projectID>/NOTES.md` with a limit of 2000 characters.
- The `project` target is invalid when the project ID is `global`.
- Tests run from package directories. Read `.openbnk/skills/unit-tests` and `tui-tests` first.
  The canonical check is `bun run check` from the repo root.

## Review Focus

1. Undo or remove after a hand edit of `USER.md`. Remove must still work on the entry text.
2. A session outside a git repo. There must be no `project` target, no project rows, and no
   project injection.
3. Revert of an accepted proposal after the user edited the skill. Revert must refuse with a
   message and leave the file untouched.
4. An empty learning store. The screen shows an empty state, not an error.
5. A narrow terminal (under 100 columns). The detail view opens on Enter instead of in the side
   panel.

---

### Task 1: Store — project target, items list, remove, revert

**Files:**
- Modify: `packages/util/src/learning-store.ts`
- Test: `packages/util/test/learning-store.test.ts`

**Interfaces — Produces:**
- `Target` becomes `"user" | "notes" | "project"`.
- `memoryFile(config, target, projectID?)`: `project` maps to
  `learning/projects/<projectID>/NOTES.md` and throws `LearningError` when `projectID` is
  missing or `"global"`.
- `entries` and `applyMemory` take an optional `projectID` as their last argument.
  `MemoryAction` is unchanged.
- `type Item = { id: string; kind: "user" | "notes" | "project" | "skill" | "proposal" | "accepted"; name: string; time: number | null; content: string; change: Change | null; proposal: Proposal | null }`
  - IDs:
    - memory entries: `mem:<target>:<index>`
    - skills: `skill:<name>`
    - proposals: `proposal:<id>`
  - `name`: the first 60 characters of the entry's first line, or the skill name.
  - `change`: the newest applied change whose `after` contains the entry. For a skill, the newest
    applied change on its path.
- `items(config, projectID?) => Item[]`, newest first. Items without a time sort last.
- `removeItem(config, itemID, projectID?, source = "user") => Change | undefined`
  - memory: `applyMemory` with `remove` and `match` = the full entry text
  - skill: `writeSkill` with `content: null`
  - a proposal ID throws `LearningError`
- `revertAccepted(config, proposalID) => Change`
  - Writes `before` if `read(path) === after`. Otherwise throws
    `"Skill was edited since you accepted this change; revert it by hand"`.
  - Sets the proposal status to `"reverted"`.
  - `Proposal.status` gains `"reverted"`.

- [ ] Step 1: write the failing tests:
  - `items` lists user and notes entries, learned skills, pending and accepted proposals; omits
    rejected and reverted ones
  - project entries appear only for the matching `projectID`
  - `memoryFile(config, "project", "global")` throws
  - `removeItem` removes the second of three entries when the first was hand-edited
  - `revertAccepted` restores `before`, then the row disappears
  - `revertAccepted` refuses after the file is edited and leaves it untouched
- [ ] Step 2: run `cd packages/util && bun test test/learning-store.test.ts` and expect FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run the tests and expect PASS. Run `bun typecheck`, then commit
  `feat(util): learning items, project memory and revert`.

### Task 2: Core — project memory wiring and stricter review

**Files:**
- Modify:
  - `packages/core/src/config/plugin/instruction.ts:44`: add the project file to `memoryFiles`
    when `location.project.id !== "global"`.
  - `packages/core/src/tool/plugin/learning.ts`: the `memory` tool's `target` accepts
    `project`. Pass the session's project ID. Reject the target with a clear message for the
    global project.
  - `packages/core/src/learning/review.ts`:
    - rewrite `SYSTEM` per the spec
    - `parse` accepts `target: "project"`
    - the review passes the session's project ID, and drops `project` actions for the global
      project
  - the CLI handlers `learn/list.ts` and `learn/memory.ts`: print project memory for the
    current directory's project, if one exists
- Test: `packages/core/test/learning/review.test.ts` (create it if absent)

**Required SYSTEM content**, in the existing style:
- MEMORY targets:
  - `user`: only when the user states it as general ("always", "I prefer", "remember", "from
    now on"), or when `session_search` shows it in an earlier session
  - `notes`: environment facts true across projects
  - `project`: choices and conventions of this project only
- A test sentence: "If the user would be surprised to see it applied in a different project, it
  is not `user`."
- SKILLS: only a technique that transfers to other tasks. Never the task itself, a one-off build,
  a demo, or a prompt that looks like a test of the agent (for example "make an ASCII shader
  page").
- "Most reviews should output empty lists."

- [ ] Step 1: failing test: `parse` keeps `{"action":"add","target":"project","content":"x"}`.
- [ ] Step 2: implement all of the above.
- [ ] Step 3: run `cd packages/core && bun test test/learning && bun typecheck`, then commit
  `feat(core): project memory and stricter learning review`.

### Task 3: API — learning group

**Files:**
- Create:
  - `packages/protocol/src/groups/learning.ts`: `LearningGroup`, location-scoped like `SkillGroup`
  - `packages/server/src/handlers/learning.ts`
- Modify:
  - `packages/protocol/src/api.ts`: add it to `LocationGroups` and `.add(...)`
  - `packages/server/src/handlers.ts`
- Schemas: define `LearningItem`, `LearningChange` and `LearningProposal` in the protocol group
  file, mirroring the store types.

**Endpoints** (identifiers):

| Identifier | Method and path | Payload | Returns |
|---|---|---|---|
| `learning.list` | `GET /api/learning` | | `{ enabled: boolean, items: LearningItem[] }` |
| `learning.remove` | `POST /api/learning/remove` | `{ id }` | |
| `learning.accept` | `POST /api/learning/accept` | `{ id }` | |
| `learning.reject` | `POST /api/learning/reject` | `{ id }` | |
| `learning.revert` | `POST /api/learning/revert` | `{ id }` | |
| `learning.enabled` | `POST /api/learning/enabled` | `{ enabled }` | |

- The handler resolves `Global` config and the Location's project ID.
- `LearningError` maps to `InvalidRequestError`, with its message.

- [ ] Step 1: implement.
- [ ] Step 2: run `cd packages/client && bun run generate`.
- [ ] Step 3: run `bun typecheck` in protocol, server and client, then commit
  `feat(server): learning API`.

### Task 4: TUI — Learnings page

**Files:**
- Create:
  - `packages/tui/src/feature-plugins/system/learnings.tsx`: the plugin plus a `LearningsView`
    component that takes `items`, `enabled` and action callbacks, so the story can render it
  - `packages/tui/src/feature-plugins/system/storybook/learnings.tsx`
- Modify:
  - `packages/tui/src/plugin/builtins.ts`
  - `storybook/index.tsx`

**Behavior:**
- Register it as a route page like stats, with command `learnings.open`, title "Learnings",
  group "System", slash `learnings`, and `palette: true`.
- Layout:
  - On the left, a list of rows showing the `[kind]` tag, the name, and a relative time.
  - On terminals of 100 columns or more, the details of the selected row show on the right.
  - On narrower terminals, Enter opens the details full width, and Escape goes back.
- The details show the full content, the change time and source, and a before/after diff when
  there is a change. For a proposal they show the reason.
- Keys:
  - `d`: remove
  - `a` / `r`: accept / reject, on proposals only
  - `v`: revert, on accepted rows only
  - `t`: toggle learning on or off
  - `escape`: back
- After each action the list refreshes, and errors appear in a feedback line.

**Story:** fixtures with:
- an empty state
- mixed kinds
- a pending proposal
- an accepted proposal

Story keys toggle empty versus full, and reset the fixture.

- [ ] Step 1: implement the view, plugin and story.
- [ ] Step 2: run `cd packages/tui && bun typecheck`.
- [ ] Step 3: run the story at narrow and wide sizes:
  `OPENBNK_STORY=learnings bun run dev:live`.
- [ ] Step 4: commit `feat(tui): learnings screen`.

### Task 5: Verify and finish

- [ ] Run `bun run check` from the repo root.
- [ ] Build and install. Open `/learnings` against the live server. Confirm that the empty state
  shows, and that a `remember …` prompt makes a row appear that can be removed.
