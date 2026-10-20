export * as LearningReview from "./review.js"

import { LLMClient, LLMEvent, Message, SystemPart } from "@openbnk/ai"
import { TuiEvent } from "@openbnk/schema/tui-event"
import { makeLocationNode } from "@openbnk/util/effect/app-node"
import { Global } from "@openbnk/util/global"
import { Context, Effect, Layer, Schema, Stream } from "effect"
import { Bus } from "../bus.js"
import { llmClient } from "../effect/app-node-platform.js"
import { SessionContext } from "../session/context.js"
import type { SessionSchema } from "../session/schema.js"
import { SessionStore } from "../session/store.js"
import { Skill } from "../skill.js"
import { LearningStore } from "@openbnk/util/learning-store"

// Adapted from Hermes Agent's background review (agent/background_review.py): after enough work in a
// session, a second pass over the conversation decides what is worth keeping in memory and skills.

const MAX_TRANSCRIPT = 24_000
const MAX_SKILL_CONTEXT = 12_000

export interface Interface {
  /** Reviews a session and applies what it learned. Never fails; problems are logged. */
  readonly review: (sessionID: SessionSchema.ID) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@openbnk/LearningReview") {}

const SYSTEM = `You are the learning reviewer for a coding agent. You read a finished stretch of conversation between the user and the agent, and decide what the agent should carry into future sessions. You never talk to the user; you only output a JSON object.

There are two stores:
1. MEMORY (short, always loaded into every future session):
   - "user": who the user is - preferences, corrections, communication style, their setup.
   - "notes": durable facts about the environment, tools, and project conventions.
   Save only what will still matter in a future session. Never save task progress, one-off details, secrets, or things already stated in the existing memory.
2. SKILLS (loaded on demand): instructions for doing a CLASS of task the most efficient and correct way for THIS user.
   - Procedure first: the steps in order, with concrete commands and decision points. Pitfalls attach to the step they affect.
   - A pitfall is a general rule plus a short why, in the imperative. Not a story of what happened this session.
   - No dates, ticket numbers, or quotes as content. The same lesson twice is one rule.
   - Prefer, in order: update a skill that was used in this conversation; update an existing learned skill that covers the territory; create a new class-level skill. Never create a narrow one-session skill.
   - A skill is a full markdown file starting with frontmatter:
     ---
     name: kebab-case-name
     description: When to use this skill, in one sentence.
     ---

Signals worth acting on:
- The user corrected the agent's style, format, verbosity, workflow, or approach ("don't do X", "always Y", "remember this"). These are the most important signals.
- A non-trivial technique, fix, workaround, or command sequence emerged that a future session would benefit from.
- A skill that was used turned out wrong, incomplete, or outdated.
If none of these occurred, output empty lists. Doing nothing is better than saving noise.

Output ONLY a JSON object, no prose, in this shape:
{"memory":[{"action":"add","target":"user|notes","content":"..."},{"action":"replace","target":"user|notes","match":"unique substring of existing entry","content":"..."},{"action":"remove","target":"user|notes","match":"..."}],
 "skills":[{"action":"create|update","name":"skill-name","content":"full SKILL.md","reason":"one sentence"}]}`

type Operations = {
  readonly memory?: readonly LearningStore.MemoryAction[]
  readonly skills?: readonly {
    readonly action: "create" | "update"
    readonly name: string
    readonly content: string
    readonly reason?: string
  }[]
}

const Ops = Schema.Struct({
  memory: Schema.optional(Schema.Array(Schema.Unknown)),
  skills: Schema.optional(Schema.Array(Schema.Unknown)),
})

export const parse = (text: string): Operations | undefined => {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return undefined
  const json = (() => {
    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown
    } catch {
      return undefined
    }
  })()
  const decoded = Schema.decodeUnknownOption(Ops)(json)
  if (decoded._tag === "None") return undefined
  const memory = (decoded.value.memory ?? []).flatMap((item): LearningStore.MemoryAction[] => {
    const op = item as Record<string, unknown>
    const target = op.target === "user" || op.target === "notes" ? op.target : undefined
    if (!target) return []
    const content = typeof op.content === "string" ? op.content : ""
    const match = typeof op.match === "string" ? op.match : ""
    if (op.action === "add" && content) return [{ action: "add", target, content }]
    if (op.action === "replace" && content && match) return [{ action: "replace", target, match, content }]
    if (op.action === "remove" && match) return [{ action: "remove", target, match }]
    return []
  })
  const skills = (decoded.value.skills ?? []).flatMap((item) => {
    const op = item as Record<string, unknown>
    if ((op.action !== "create" && op.action !== "update") || typeof op.name !== "string") return []
    if (typeof op.content !== "string" || !op.content.trim()) return []
    return [
      {
        action: op.action as "create" | "update",
        name: op.name,
        content: op.content,
        reason: typeof op.reason === "string" ? op.reason : undefined,
      },
    ]
  })
  return { memory, skills }
}

const clip = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const llm = yield* LLMClient.Service
    const context = yield* SessionContext.Service
    const store = yield* SessionStore.Service
    const skills = yield* Skill.Service
    const config = (yield* Global.Service).config

    const transcript = Effect.fn("LearningReview.transcript")(function* (sessionID: SessionSchema.ID) {
      const messages = yield* store.context(sessionID).pipe(Effect.orElseSucceed(() => []))
      const used = new Set<string>()
      const lines = messages.flatMap((message) => {
        if (message.type === "user") return [`USER: ${message.text.trim()}`]
        if (message.type === "skill") {
          used.add(message.name)
          return [`[skill loaded: ${message.name}]`]
        }
        if (message.type !== "assistant") return []
        return message.content.flatMap((part) => {
          if (part.type === "text") return part.text.trim() ? [`AGENT: ${part.text.trim()}`] : []
          if (part.type !== "tool") return []
          if (part.name === "skill" && "input" in part.state && typeof part.state.input === "object")
            used.add(String((part.state.input as Record<string, unknown>).id ?? ""))
          const error = part.state.status === "error" ? ` -> ERROR: ${clip(part.state.error, 300)}` : ""
          return [`AGENT TOOL ${part.name}(${clip("input" in part.state ? part.state.input : "", 300)})${error}`]
        })
      })
      const text = lines.join("\n\n")
      return {
        used,
        text: text.length > MAX_TRANSCRIPT ? `…${text.slice(-MAX_TRANSCRIPT)}` : text,
      }
    })

    const skillContext = Effect.fn("LearningReview.skillContext")(function* (used: ReadonlySet<string>) {
      const learned = LearningStore.learnedSkills(config)
      const all = yield* skills.list()
      const loaded = all.filter((skill) => used.has(skill.id) && !LearningStore.isLearned(config, skill.path))
      const sections = [
        ...loaded.map((skill) => `### Skill used this session (user-owned): ${skill.id}\n${skill.content}`),
        ...learned.map((skill) => `### Learned skill: ${skill.name}\n${skill.content}`),
      ]
      const others = all
        .filter((skill) => !used.has(skill.id) && !LearningStore.isLearned(config, skill.path))
        .map((skill) => `- ${skill.id}: ${skill.description ?? ""}`)
      let budget = MAX_SKILL_CONTEXT
      const kept = sections.flatMap((section) => {
        if (section.length > budget) return []
        budget -= section.length
        return [section]
      })
      return [
        kept.join("\n\n") || "(no learned skills yet)",
        others.length ? `\nOther installed skills (name: description):\n${others.join("\n")}` : "",
      ].join("\n")
    })

    const run = Effect.fn("LearningReview.run")(function* (sessionID: SessionSchema.ID) {
      if (!LearningStore.enabled(config)) return
      yield* Effect.logInfo("learning review started", { sessionID })
      const session = yield* store.get(sessionID)
      if (!session || session.parentID) return
      const { used, text } = yield* transcript(sessionID)
      if (!text.includes("USER:")) return
      const selection = yield* context.selectTitle(session)
      const model = selection?.primary ?? selection?.selected
      if (!selection || !model) return
      const memory = (["user", "notes"] as const)
        .map((target) => {
          const items = LearningStore.entries(config, target)
          return `${target}:\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "(empty)"}`
        })
        .join("\n\n")
      const prompt = [
        `## Current memory\n${memory}`,
        `## Skills\n${yield* skillContext(used)}`,
        `## Conversation to review\n${text}`,
        "Now output the JSON object.",
      ].join("\n\n")
      const prepared = yield* context.request.title({
        session,
        agent: selection.agent.id,
        model,
        system: [SystemPart.make(SYSTEM)],
        messages: [Message.user(prompt)],
      })
      if (prepared.event.result !== undefined) return
      const chunks: string[] = []
      yield* llm
        .stream(prepared.request, prepared.options)
        .pipe(Stream.runForEach((event) => Effect.sync(() => LLMEvent.is.textDelta(event) && chunks.push(event.text))))
      const ops = parse(chunks.join(""))
      yield* Effect.logInfo("learning review finished", {
        sessionID,
        memory: ops?.memory?.length ?? 0,
        skills: ops?.skills?.length ?? 0,
      })
      if (!ops) return yield* Effect.logWarning("learning review returned no usable JSON", { sessionID })
      const source = `review:${sessionID}`
      const notices: string[] = []
      for (const op of ops.memory ?? []) {
        const change = yield* Effect.try(() => LearningStore.applyMemory(config, op, source)).pipe(
          Effect.tapError((error) => Effect.logInfo("learning memory op skipped", { error: String(error) })),
          Effect.orElseSucceed(() => undefined),
        )
        if (change) notices.push(change.label)
      }
      const byID = new Map(all(yield* skills.list()))
      for (const op of ops.skills ?? []) {
        const existing = byID.get(LearningStore.normalizeName(op.name)) ?? byID.get(op.name)
        const outcome = yield* Effect.try(() =>
          LearningStore.writeSkill(
            config,
            { name: op.name, file: existing, content: op.content, reason: op.reason ?? "" },
            source,
          ),
        ).pipe(
          Effect.tapError((error) => Effect.logInfo("learning skill op skipped", { error: String(error) })),
          Effect.orElseSucceed(() => undefined),
        )
        if (outcome?.type === "applied") notices.push(outcome.change.label)
        if (outcome?.type === "proposal")
          notices.push(`proposed change to "${outcome.proposal.skill}" (needs approval)`)
      }
      if (notices.length === 0) return
      yield* bus
        .publish(TuiEvent.ToastShow, {
          title: "learned",
          message: `${notices.join("; ")} · openbnk learn to review or undo`,
          variant: "info",
          duration: 6000,
        })
        .pipe(Effect.ignore)
    })

    const review = (sessionID: SessionSchema.ID) =>
      run(sessionID).pipe(
        Effect.catchCause((cause) => Effect.logWarning("learning review failed", { sessionID, cause })),
      )

    return Service.of({ review })
  }),
)

const all = (skills: readonly Skill.Info[]) =>
  skills.map((skill) => [skill.id as string, skill.path as string] as const)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Bus.node, llmClient, SessionContext.node, SessionStore.node, Skill.node, Global.node],
})
