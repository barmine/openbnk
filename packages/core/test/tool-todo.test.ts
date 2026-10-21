import { describe, expect, test } from "bun:test"
import { Effect, Layer, Stream } from "effect"
import { AppNodeBuilder } from "@openbnk/core/effect/app-node-builder"
import { Config } from "@openbnk/core/config"
import { Image } from "@openbnk/core/image"
import { Session } from "@openbnk/core/session"
import { Tool } from "@openbnk/core/tool"
import { TodoTool } from "@openbnk/core/tool/plugin/todo"
import { Document, Info, type Entry } from "@openbnk/schema/config"
import { ConfigExperimental } from "@openbnk/schema/config/experimental"
import { testEffect } from "./lib/effect"
import { imagePassthrough } from "./lib/image"
import { permissionLayer } from "./lib/permission"
import { executeTool, registerToolPlugin, toolDefinitions, toolIdentity } from "./lib/tool"

const sessionID = Session.ID.make("ses_todo_tool_test")
const enabled = new ConfigExperimental.Info({ todo: true })
const todos = [
  { content: "Write tests", status: "in_progress" },
  { content: "Ship it", status: "pending" },
  { content: "Read the code", status: "completed" },
  { content: "Rewrite everything", status: "cancelled" },
] as const

const it = testEffect(AppNodeBuilder.build(Tool.node, [Image.node.replace(imagePassthrough)]))

const setup = (experimental: ConfigExperimental.Info | undefined) =>
  Effect.gen(function* () {
    yield* registerToolPlugin(TodoTool.Plugin, { event: { subscribe: () => Stream.never } }).pipe(
      Effect.provide(Layer.mock(Config.Service)({ entries: () => Effect.succeed([document(experimental)]) })),
      Effect.provide(permissionLayer({ assert: () => Effect.void })),
    )
    return yield* Tool.Service
  })

const names = (registry: Tool.Interface) =>
  toolDefinitions(registry).pipe(Effect.map((definitions) => definitions.map((definition) => definition.name)))

describe("TodoTool", () => {
  it.effect("is on by default with the model profile", () =>
    Effect.gen(function* () {
      expect(yield* names(yield* setup(undefined))).toContain(TodoTool.name)
    }),
  )

  it.effect("is absent when experimental.todo is false", () =>
    Effect.gen(function* () {
      expect(yield* names(yield* setup(new ConfigExperimental.Info({ todo: false })))).not.toContain(TodoTool.name)
    }),
  )

  test("reminds the model about unfinished items only", () => {
    expect(TodoTool.reminder(todos)).toBe(
      [
        "",
        "",
        "<system-reminder>",
        "The current task still has unfinished todo items:",
        "- [in_progress] Write tests",
        "- [pending] Ship it",
        "Keep the todo list current and continue the task. Do not treat a successful intermediate tool call as task completion.",
        "</system-reminder>",
      ].join("\n"),
    )
    expect(TodoTool.reminder([{ content: "Done", status: "completed" }])).toBe("")
  })

  it.effect("registers todowrite on the native tool list and summarizes the update", () =>
    Effect.gen(function* () {
      const registry = yield* setup(enabled)
      const definition = (yield* toolDefinitions(registry)).find((tool) => tool.name === TodoTool.name)

      expect(definition?.inputSchema).toHaveProperty("properties.todos.type", "array")
      expect(definition?.inputSchema).toHaveProperty("properties.todos.items.required", ["content", "status"])
      expect(
        yield* executeTool(registry, {
          sessionID,
          ...toolIdentity,
          call: { type: "tool-call", id: "call-todo", name: TodoTool.name, input: { todos } },
        }),
      ).toEqual({
        status: "completed",
        output: { todos },
        content: [
          {
            type: "text",
            text:
              'Todos updated: 1/4 completed, 1 in progress, 1 pending, 1 cancelled. In progress: "Write tests"' +
              TodoTool.reminder(todos),
          },
        ],
        metadata: { todos },
      })
    }),
  )
})

function document(experimental: ConfigExperimental.Info | undefined): Entry {
  return new Document({ type: "document", info: new Info(experimental ? { experimental } : {}) })
}
