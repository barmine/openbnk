export * as LearningTools from "./learning.js"

import { ToolFailure } from "@openbnk/ai"
import type { Context } from "@openbnk/plugin/effect/plugin"
import { TuiEvent } from "@openbnk/schema/tui-event"
import { Global } from "@openbnk/util/global"
import { Effect, Schema } from "effect"
import { Bus } from "../../bus.js"
import { LearningSearch } from "../../learning/search.js"
import { LearningStore } from "@openbnk/util/learning-store"
import { Skill } from "../../skill.js"

export const MemoryInput = Schema.Struct({
  action: Schema.Literals(["add", "replace", "remove"]),
  target: Schema.Literals(["user", "notes"]).annotate({
    description:
      "user: who the user is, their preferences and style. notes: environment facts, project quirks, conventions.",
  }),
  content: Schema.optional(Schema.String).annotate({ description: "The entry text, for add and replace" }),
  match: Schema.optional(Schema.String).annotate({
    description: "A unique substring of the existing entry, for replace and remove",
  }),
})

export const SkillInput = Schema.Struct({
  action: Schema.Literals(["create", "update", "delete"]),
  name: Schema.String.annotate({ description: "Skill name (kebab-case). For update, the ID of an existing skill." }),
  content: Schema.optional(Schema.String).annotate({
    description:
      "Full SKILL.md content for create/update, starting with YAML frontmatter containing name and description",
  }),
  reason: Schema.String.annotate({ description: "One sentence: what was learned that motivates this change" }),
})

export const SearchInput = Schema.Struct({
  query: Schema.String.annotate({ description: "Text to look for in past conversations" }),
  limit: Schema.optional(Schema.Number),
})

const Output = Schema.Struct({ result: Schema.String })

export const memoryDescription = [
  "Save durable facts to persistent memory that is loaded into every future session.",
  "Use target=user for the user's preferences, corrections, style and setup; target=notes for environment facts, tool quirks and project conventions.",
  "Save only what will still matter in future sessions. Do not save task progress or anything already in AGENTS.md.",
  "Memory is size-limited: when full, replace or remove stale entries to consolidate.",
  "Changes take effect from the next session.",
].join("\n")

export const skillDescription = [
  "Create or improve a skill: reusable instructions for doing a class of task the right way for this user.",
  "Write procedure first (steps, commands, decision points), with pitfalls stated as general rules plus a short why.",
  "Prefer updating an existing skill over creating a narrow new one. Read a skill with the skill tool before updating it.",
  "Skills the agent created are changed immediately. Changes to skills the user installed or wrote are queued for the user's approval.",
].join("\n")

export const searchDescription =
  "Search past conversations with the user for how something was discussed or solved before. Returns snippets with session titles and dates."

export const Plugin = {
  id: "openbnk.tool.learning",
  effect: Effect.fn("LearningTools.Plugin")(function* (ctx: Context) {
    const global = yield* Global.Service
    const bus = yield* Bus.Service
    const skills = yield* Skill.Service
    const search = yield* LearningSearch.Service
    const config = global.config
    const fail = (message: string) => (error: unknown) =>
      new ToolFailure({ message: error instanceof LearningStore.LearningError ? error.message : message, error })
    const notify = (message: string) =>
      bus
        .publish(TuiEvent.ToastShow, { title: "learned", message, variant: "info", duration: 4000 })
        .pipe(Effect.ignore)

    yield* ctx.tool
      .transform((editor) => {
        if (!LearningStore.enabled(config)) return
        editor.add({
          name: "memory",
          options: { codemode: false },
          description: memoryDescription,
          input: MemoryInput,
          output: Output,
          execute: (input) =>
            Effect.gen(function* () {
              const action: LearningStore.MemoryAction =
                input.action === "add"
                  ? { action: "add", target: input.target, content: input.content ?? "" }
                  : input.action === "replace"
                    ? {
                        action: "replace",
                        target: input.target,
                        match: input.match ?? "",
                        content: input.content ?? "",
                      }
                    : { action: "remove", target: input.target, match: input.match ?? "" }
              if (action.action !== "remove" && !action.content.trim())
                return yield* new ToolFailure({ message: "content is required" })
              const change = yield* Effect.try({
                try: () => LearningStore.applyMemory(config, action, "agent"),
                catch: fail("Unable to update memory"),
              })
              if (change) yield* notify(`${change.label} · undo: openbnk learn undo ${change.id}`)
              const result = change ? `Saved. (${change.label})` : "No change needed."
              return { output: { result }, content: result }
            }),
        })
        editor.add({
          name: "skill_manage",
          options: { codemode: false },
          description: skillDescription,
          input: SkillInput,
          output: Output,
          execute: (input) =>
            Effect.gen(function* () {
              if (input.action !== "delete" && !input.content)
                return yield* new ToolFailure({ message: "content is required for create and update" })
              const existing = input.action === "create" ? undefined : yield* skills.get(Skill.ID.make(input.name))
              const outcome = yield* Effect.try({
                try: () =>
                  LearningStore.writeSkill(
                    config,
                    {
                      name: input.name,
                      file: existing?.path,
                      content: input.action === "delete" ? null : input.content!,
                      reason: input.reason,
                    },
                    "agent",
                  ),
                catch: fail("Unable to update skill"),
              })
              if (!outcome) return { output: { result: "No change needed." }, content: "No change needed." }
              if (outcome.type === "proposal") {
                yield* notify(`proposed a change to "${outcome.proposal.skill}" · review: openbnk learn`)
                const result = `Skill "${outcome.proposal.skill}" belongs to the user, so the change was queued for their approval (proposal ${outcome.proposal.id}).`
                return { output: { result }, content: result }
              }
              yield* notify(`${outcome.change.label} · undo: openbnk learn undo ${outcome.change.id}`)
              const result = `Done: ${outcome.change.label}.`
              return { output: { result }, content: result }
            }),
        })
        editor.add({
          name: "session_search",
          options: { codemode: false },
          description: searchDescription,
          input: SearchInput,
          output: Output,
          execute: (input) =>
            search.search({ query: input.query, limit: input.limit }).pipe(
              Effect.map((hits) => {
                const result =
                  hits.length === 0
                    ? "No past conversations matched."
                    : hits
                        .map(
                          (hit) =>
                            `[${new Date(hit.time).toISOString().slice(0, 10)}] ${hit.title ?? "untitled"} (${hit.directory}) ${hit.role}: ${hit.snippet}`,
                        )
                        .join("\n\n")
                return { output: { result }, content: result }
              }),
            ),
        })
      })
      .pipe(Effect.orDie)
  }),
}
