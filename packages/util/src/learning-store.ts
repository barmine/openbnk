export * as LearningStore from "./learning-store.js"

import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

// Everything the self-learning loop persists lives under the global config dir:
//   learning/memory/{USER,NOTES}.md   curated memory, injected into every session
//   learning/projects/<id>/NOTES.md   project memory, injected only into that project's sessions
//   learning/history/<id>.json        every applied change, kept for undo
//   learning/proposals/<id>.json      pending changes to skills the user owns
//   skills/learned/<name>/SKILL.md    agent-written skills, discovered by the normal skill loader

export const DELIMITER = "\n§\n"

export const targets = {
  user: { file: "USER.md", limit: 1500, title: "What I know about the user" },
  notes: { file: "NOTES.md", limit: 2500, title: "My notes about the environment" },
  project: { file: "NOTES.md", limit: 2000, title: "My notes about this project" },
} as const
export type Target = keyof typeof targets

export type Change = {
  readonly id: string
  readonly time: number
  readonly kind: "memory" | "skill"
  readonly label: string
  readonly path: string
  readonly before: string | null
  readonly after: string | null
  readonly status: "applied" | "undone"
  readonly source: string
}

export type Proposal = {
  readonly id: string
  readonly time: number
  readonly skill: string
  readonly path: string
  readonly before: string | null
  readonly after: string
  readonly reason: string
  readonly status: "pending" | "accepted" | "rejected" | "reverted"
  readonly source: string
}

export class LearningError extends Error {}

export const paths = (config: string) => ({
  root: path.join(config, "learning"),
  memory: path.join(config, "learning", "memory"),
  projects: path.join(config, "learning", "projects"),
  history: path.join(config, "learning", "history"),
  proposals: path.join(config, "learning", "proposals"),
  learned: path.join(config, "skills", "learned"),
  disabled: path.join(config, "learning", "disabled"),
})

/** The project target needs a real project; the shared global project would leak notes across directories. */
export const memoryFile = (config: string, target: Target, projectID?: string) => {
  if (target !== "project") return path.join(paths(config).memory, targets[target].file)
  if (!projectID || projectID === "global") throw new LearningError("Project memory needs a project (a git repository)")
  return path.join(paths(config).projects, projectID, targets.project.file)
}

export const enabled = (config: string) =>
  !fs.existsSync(paths(config).disabled) && !["0", "false"].includes(process.env.OPENBNK_LEARNING ?? "")

export const setEnabled = (config: string, value: boolean) => {
  const file = paths(config).disabled
  if (value) return fs.rmSync(file, { force: true })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, "")
}

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null)

const write = (file: string, content: string | null) => {
  if (content === null) return fs.rmSync(file, { force: true })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const id = () => `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`

const record = (config: string, change: Omit<Change, "id" | "time" | "status">) => {
  const entry: Change = { ...change, id: id(), time: Date.now(), status: "applied" }
  write(path.join(paths(config).history, `${entry.id}.json`), JSON.stringify(entry, null, 2))
  return entry
}

const listJson = <T>(directory: string) =>
  fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((name) => name.endsWith(".json"))
        .map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")) as T)
    : []

// Memory -------------------------------------------------------------------

export const entries = (config: string, target: Target, projectID?: string) => {
  const content = read(memoryFile(config, target, projectID))
  if (!content) return []
  return content
    .replace(/^# .*\n+/, "")
    .split(DELIMITER)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const render = (target: Target, items: readonly string[]) =>
  items.length === 0 ? null : `# ${targets[target].title}\n\n${items.join(DELIMITER)}\n`

export type MemoryAction =
  | { readonly action: "add"; readonly target: Target; readonly content: string }
  | { readonly action: "replace"; readonly target: Target; readonly match: string; readonly content: string }
  | { readonly action: "remove"; readonly target: Target; readonly match: string }

export const applyMemory = (config: string, input: MemoryAction, source: string, projectID?: string) => {
  const file = memoryFile(config, input.target, projectID)
  const before = read(file)
  const items = entries(config, input.target, projectID)
  const find = (match: string) => {
    const exact = items.indexOf(match.trim())
    if (exact >= 0) return exact
    const hits = items.flatMap((item, index) => (item.includes(match) ? [index] : []))
    if (hits.length === 0) throw new LearningError(`No ${input.target} memory entry contains "${match}"`)
    if (hits.length > 1) throw new LearningError(`"${match}" matches ${hits.length} entries; use a longer match`)
    return hits[0]!
  }
  const next = (() => {
    if (input.action === "add") {
      if (items.includes(input.content.trim())) return items
      return [...items, input.content.trim()]
    }
    const index = find(input.match)
    if (input.action === "remove") return items.filter((_, i) => i !== index)
    return items.map((item, i) => (i === index ? input.content.trim() : item))
  })()
  const after = render(input.target, next)
  const limit = targets[input.target].limit
  if ((after?.length ?? 0) > limit)
    throw new LearningError(
      `${targets[input.target].file} would be ${after!.length} chars (limit ${limit}). ` +
        `Consolidate: replace or remove existing entries first, then retry.`,
    )
  if (after === before) return undefined
  write(file, after)
  const label =
    input.action === "add"
      ? `remembered (${input.target}): ${input.content.trim().slice(0, 60)}`
      : `${input.action === "remove" ? "forgot" : "updated memory"} (${input.target}): ${input.match.slice(0, 60)}`
  return record(config, { kind: "memory", label, path: file, before, after, source })
}

// Skills -------------------------------------------------------------------

export const SKILL_LIMIT = 15_000

export const normalizeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

export const isLearned = (config: string, file: string) => {
  const relative = path.relative(paths(config).learned, path.resolve(file))
  return !relative.startsWith("..") && !path.isAbsolute(relative)
}

export const learnedSkillFile = (config: string, name: string) => path.join(paths(config).learned, name, "SKILL.md")

export const learnedSkills = (config: string) => {
  const root = paths(config).learned
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root)
    .map((name) => ({ name, file: learnedSkillFile(config, name) }))
    .filter((item) => fs.existsSync(item.file))
    .map((item) => ({ ...item, content: fs.readFileSync(item.file, "utf8") }))
}

const validateSkill = (content: string) => {
  if (content.length > SKILL_LIMIT) throw new LearningError(`Skill is ${content.length} chars (limit ${SKILL_LIMIT})`)
  if (!/^---\n[\s\S]*?\bdescription:\s*\S[\s\S]*?\n---\n/.test(content))
    throw new LearningError("Skill must start with YAML frontmatter containing name and description")
}

/** Writes a learned skill directly, or files a proposal when the skill belongs to the user. */
export const writeSkill = (
  config: string,
  input: { readonly name: string; readonly file?: string; readonly content: string | null; readonly reason: string },
  source: string,
) => {
  const name = normalizeName(input.name)
  if (!name) throw new LearningError("Skill name is empty")
  const file = input.file ?? learnedSkillFile(config, name)
  if (input.content !== null) validateSkill(input.content)
  const before = read(file)
  if (before === input.content) return undefined
  if (!isLearned(config, file)) {
    if (input.content === null) throw new LearningError("Only learned skills can be deleted")
    const proposal: Proposal = {
      id: id(),
      time: Date.now(),
      skill: name,
      path: file,
      before,
      after: input.content,
      reason: input.reason,
      status: "pending",
      source,
    }
    write(path.join(paths(config).proposals, `${proposal.id}.json`), JSON.stringify(proposal, null, 2))
    return { type: "proposal" as const, proposal }
  }
  if (input.content === null) fs.rmSync(path.dirname(file), { recursive: true, force: true })
  else write(file, input.content)
  const verb = input.content === null ? "deleted" : before === null ? "created" : "updated"
  return {
    type: "applied" as const,
    change: record(config, {
      kind: "skill",
      label: `${verb} skill "${name}"`,
      path: file,
      before,
      after: input.content,
      source,
    }),
  }
}

// History and proposals ------------------------------------------------------

export const changes = (config: string) => listJson<Change>(paths(config).history).toSorted((a, b) => b.time - a.time)

export const proposals = (config: string) =>
  listJson<Proposal>(paths(config).proposals).toSorted((a, b) => b.time - a.time)

const findByPrefix = <T extends { id: string }>(items: readonly T[], prefix: string) => {
  const hits = items.filter((item) => item.id.startsWith(prefix))
  if (hits.length !== 1) throw new LearningError(hits.length ? `"${prefix}" is ambiguous` : `No entry "${prefix}"`)
  return hits[0]!
}

export const find = (config: string, prefix: string) => {
  const all = [
    ...changes(config).map((item) => ({ type: "change" as const, item })),
    ...proposals(config).map((item) => ({ type: "proposal" as const, item })),
  ]
  const hits = all.filter((entry) => entry.item.id.startsWith(prefix))
  if (hits.length !== 1) throw new LearningError(hits.length ? `"${prefix}" is ambiguous` : `No entry "${prefix}"`)
  return hits[0]!
}

export const undo = (config: string, prefix: string) => {
  const change = findByPrefix(changes(config), prefix)
  if (change.status === "undone") throw new LearningError("Already undone")
  if (read(change.path) !== change.after)
    throw new LearningError("File changed since this edit; undo the newer changes first")
  if (change.before === null && change.kind === "skill")
    fs.rmSync(path.dirname(change.path), { recursive: true, force: true })
  else write(change.path, change.before)
  const updated: Change = { ...change, status: "undone" }
  write(path.join(paths(config).history, `${change.id}.json`), JSON.stringify(updated, null, 2))
  return updated
}

export const resolveProposal = (config: string, prefix: string, accept: boolean) => {
  const proposal = findByPrefix(proposals(config), prefix)
  if (proposal.status !== "pending") throw new LearningError(`Proposal is already ${proposal.status}`)
  if (accept) {
    if (read(proposal.path) !== proposal.before)
      throw new LearningError("Skill changed since this proposal was made; reject it and let it be re-proposed")
    write(proposal.path, proposal.after)
    record(config, {
      kind: "skill",
      label: `accepted change to skill "${proposal.skill}"`,
      path: proposal.path,
      before: proposal.before,
      after: proposal.after,
      source: "user",
    })
  }
  const updated: Proposal = { ...proposal, status: accept ? "accepted" : "rejected" }
  write(path.join(paths(config).proposals, `${proposal.id}.json`), JSON.stringify(updated, null, 2))
  return updated
}

// Items: what is in effect now, for the Learnings screen ---------------------

export type Item = {
  readonly id: string
  readonly kind: Target | "skill" | "proposal" | "accepted"
  readonly name: string
  readonly time: number | null
  readonly content: string
  readonly change: Change | null
  readonly proposal: Proposal | null
}

export const items = (config: string, projectID?: string): Item[] => {
  const applied = changes(config).filter((change) => change.status === "applied")
  const hasProject = Boolean(projectID) && projectID !== "global"
  const memory = (["user", "notes", ...(hasProject ? (["project"] as const) : [])] as const).flatMap((target) => {
    const file = memoryFile(config, target, projectID)
    return entries(config, target, projectID).map((content, index): Item => {
      // The change that introduced the entry: the one whose result has it and whose starting point did not.
      const change =
        applied.find(
          (item) => item.path === file && item.after?.includes(content) && !item.before?.includes(content),
        ) ?? null
      return {
        id: `mem:${target}:${index}`,
        kind: target,
        name: firstLine(content),
        time: change?.time ?? null,
        content,
        change,
        proposal: null,
      }
    })
  })
  const skills = learnedSkills(config).map((skill): Item => {
    const change = applied.find((item) => item.path === skill.file) ?? null
    return {
      id: `skill:${skill.name}`,
      kind: "skill",
      name: skill.name,
      time: change?.time ?? null,
      content: skill.content,
      change,
      proposal: null,
    }
  })
  const listed = proposals(config)
    .filter((proposal) => proposal.status === "pending" || proposal.status === "accepted")
    .map(
      (proposal): Item => ({
        id: `proposal:${proposal.id}`,
        kind: proposal.status === "pending" ? "proposal" : "accepted",
        name: proposal.skill,
        time: proposal.time,
        content: proposal.after,
        change: null,
        proposal,
      }),
    )
  return [...memory, ...skills, ...listed].toSorted((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity))
}

const firstLine = (content: string) => content.split("\n")[0]!.slice(0, 60)

/** Removes one memory entry or learned skill by its item ID; the removal is recorded like any change. */
export const removeItem = (config: string, itemID: string, projectID?: string, source = "user") => {
  const item = items(config, projectID).find((entry) => entry.id === itemID)
  if (!item) throw new LearningError(`No learning "${itemID}"`)
  if (item.kind === "skill") {
    const outcome = writeSkill(config, { name: item.name, content: null, reason: "removed by the user" }, source)
    return outcome?.type === "applied" ? outcome.change : undefined
  }
  if (item.kind === "proposal" || item.kind === "accepted")
    throw new LearningError("Proposals are accepted, rejected or reverted, not removed")
  return applyMemory(config, { action: "remove", target: item.kind, match: item.content }, source, projectID)
}

/** Restores a user-owned skill to its content before an accepted proposal, unless it was edited since. */
export const revertAccepted = (config: string, prefix: string) => {
  const proposal = findByPrefix(proposals(config), prefix)
  if (proposal.status !== "accepted") throw new LearningError(`Proposal is ${proposal.status}, not accepted`)
  if (read(proposal.path) !== proposal.after)
    throw new LearningError("Skill was edited since you accepted this change; revert it by hand")
  write(proposal.path, proposal.before)
  const change = record(config, {
    kind: "skill",
    label: `reverted accepted change to skill "${proposal.skill}"`,
    path: proposal.path,
    before: proposal.after,
    after: proposal.before,
    source: "user",
  })
  write(
    path.join(paths(config).proposals, `${proposal.id}.json`),
    JSON.stringify({ ...proposal, status: "reverted" }, null, 2),
  )
  return change
}
