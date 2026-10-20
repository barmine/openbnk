import { NodeFileSystem } from "@effect/platform-node"
import { compile, emitEffectImported, emitEffectShape, emitPromise, write } from "@openbnk/httpapi-codegen"
import { ClientApi, effectOmitEndpoints, groupNames, promiseOmitEndpoints } from "@openbnk/protocol/client"
import { Agent } from "@openbnk/schema/agent"
import { Command } from "@openbnk/schema/command"
import { Config } from "@openbnk/schema/config"
import { Credential } from "@openbnk/schema/credential"
import { Event } from "@openbnk/schema/event"
import { EventLog } from "@openbnk/schema/event-log"
import { FileDiff } from "@openbnk/schema/file-diff"
import { FileSystem } from "@openbnk/schema/filesystem"
import { Form } from "@openbnk/schema/form"
import { Instruction } from "@openbnk/schema/instruction"
import { InstructionEntry } from "@openbnk/schema/instruction-entry"
import { Integration } from "@openbnk/schema/integration"
import { Location } from "@openbnk/schema/location"
import { Mcp } from "@openbnk/schema/mcp"
import { Model } from "@openbnk/schema/model"
import { Money } from "@openbnk/schema/money"
import { Permission } from "@openbnk/schema/permission"
import { PermissionSaved } from "@openbnk/schema/permission-saved"
import { Plugin } from "@openbnk/schema/plugin"
import { Project } from "@openbnk/schema/project"
import { Worktree } from "@openbnk/schema/worktree"
import { AgentAttachment, FileAttachment, Prompt, PromptMention } from "@openbnk/schema/prompt"
import { PromptInput } from "@openbnk/schema/prompt-input"
import { Provider } from "@openbnk/schema/provider"
import { Pty } from "@openbnk/schema/pty"
import { PtyTicket } from "@openbnk/schema/pty-ticket"
import { Question } from "@openbnk/schema/question"
import { Reference } from "@openbnk/schema/reference"
import { AbsolutePath, RelativePath } from "@openbnk/schema/schema"
import { Session } from "@openbnk/schema/session"
import { SessionMessage } from "@openbnk/schema/session-message"
import { SessionInbox } from "@openbnk/schema/session-inbox"
import { Shell } from "@openbnk/schema/shell"
import { Skill } from "@openbnk/schema/skill"
import { Snapshot } from "@openbnk/schema/snapshot"
import { Vcs } from "@openbnk/schema/vcs"
import { WebSearch } from "@openbnk/schema/websearch"
import { Workspace } from "@openbnk/schema/workspace"
import { Effect, Schema } from "effect"
import { fileURLToPath } from "url"

const promiseContract = compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints })
const effectContract = compile(ClientApi, { groupNames, omitEndpoints: effectOmitEndpoints })
const effectTypeReferences = [
  ...namespaceTypes("Agent", "@openbnk/schema/agent", Agent),
  ...namespaceTypes("Command", "@openbnk/schema/command", Command),
  ...namespaceTypes("Config", "@openbnk/schema/config", Config),
  ...namespaceTypes("Credential", "@openbnk/schema/credential", Credential),
  ...namespaceTypes("Event", "@openbnk/schema/event", Event),
  ...namespaceTypes("EventLog", "@openbnk/schema/event-log", EventLog),
  ...namespaceTypes("FileDiff", "@openbnk/schema/file-diff", FileDiff),
  ...namespaceTypes("FileSystem", "@openbnk/schema/filesystem", FileSystem),
  ...namespaceTypes("Form", "@openbnk/schema/form", Form),
  ...namespaceTypes("Instruction", "@openbnk/schema/instruction", Instruction),
  ...namespaceTypes("InstructionEntry", "@openbnk/schema/instruction-entry", InstructionEntry),
  ...namespaceTypes("Integration", "@openbnk/schema/integration", Integration),
  typeReference("Location.PublicRef", "@openbnk/schema/location", Location.PublicRef),
  typeReference("Location.PublicInfo", "@openbnk/schema/location", Location.PublicInfo),
  ...namespaceTypes("Mcp", "@openbnk/schema/mcp", Mcp),
  ...namespaceTypes("Model", "@openbnk/schema/model", Model),
  ...namespaceTypes("Money", "@openbnk/schema/money", Money),
  ...namespaceTypes("Permission", "@openbnk/schema/permission", Permission),
  ...namespaceTypes("PermissionSaved", "@openbnk/schema/permission-saved", PermissionSaved),
  ...namespaceTypes("Plugin", "@openbnk/schema/plugin", Plugin),
  ...namespaceTypes("Project", "@openbnk/schema/project", Project),
  ...namespaceTypes("Worktree", "@openbnk/schema/worktree", Worktree),
  ...namespaceTypes("PromptInput", "@openbnk/schema/prompt-input", PromptInput),
  ...namespaceTypes("Provider", "@openbnk/schema/provider", Provider),
  ...namespaceTypes("Pty", "@openbnk/schema/pty", Pty),
  ...namespaceTypes("PtyTicket", "@openbnk/schema/pty-ticket", PtyTicket),
  ...namespaceTypes("Question", "@openbnk/schema/question", Question),
  ...namespaceTypes("Reference", "@openbnk/schema/reference", Reference),
  ...namespaceTypes("Session", "@openbnk/schema/session", Session),
  ...namespaceTypes("SessionMessage", "@openbnk/schema/session-message", SessionMessage),
  ...namespaceTypes("SessionInbox", "@openbnk/schema/session-inbox", SessionInbox),
  ...namespaceTypes("Shell", "@openbnk/schema/shell", Shell),
  ...namespaceTypes("Skill", "@openbnk/schema/skill", Skill),
  ...namespaceTypes("Snapshot", "@openbnk/schema/snapshot", Snapshot),
  ...namespaceTypes("Vcs", "@openbnk/schema/vcs", Vcs),
  ...namespaceTypes("WebSearch", "@openbnk/schema/websearch", WebSearch),
  ...namespaceTypes("Workspace", "@openbnk/schema/workspace", Workspace),
  typeReference("Prompt", "@openbnk/schema/prompt", Prompt),
  typeReference("PromptMention", "@openbnk/schema/prompt", PromptMention),
  typeReference("FileAttachment", "@openbnk/schema/prompt", FileAttachment),
  typeReference("AgentAttachment", "@openbnk/schema/prompt", AgentAttachment),
  typeReference("AbsolutePath", "@openbnk/schema/schema", AbsolutePath),
  typeReference("RelativePath", "@openbnk/schema/schema", RelativePath),
]

await Effect.runPromise(
  Effect.all(
    [
      write(
        emitPromise(promiseContract, {
          mutableOutputs: true,
        }),
        fileURLToPath(new URL("../src/promise/generated", import.meta.url)),
      ),
      write(
        emitEffectImported(effectContract, {
          module: "../../contract",
          api: "ClientApi",
          shapeModule: "../api/api.js",
        }),
        fileURLToPath(new URL("../src/effect/generated", import.meta.url)),
      ),
      write(
        emitEffectShape(effectContract, {
          typeReferences: effectTypeReferences,
          outputTypes: {
            "event.subscribe": {
              name: "OpenBnkEvent",
              import: 'import type { OpenBnkEvent } from "@openbnk/protocol/groups/event"',
            },
          },
        }),
        fileURLToPath(new URL("../src/effect/api", import.meta.url)),
      ),
    ],
    { concurrency: 3, discard: true },
  ).pipe(Effect.provide(NodeFileSystem.layer)),
)

function namespaceTypes(namespace: string, module: string, values: object) {
  return Object.entries(values).flatMap(([name, schema]) =>
    Schema.isSchema(schema) ? [typeReference(`${namespace}.${name}`, module, schema)] : [],
  )
}

function typeReference(name: string, module: string, schema: Schema.Top) {
  return {
    schema,
    name,
    import: `import type { ${name.split(".")[0]} } from ${JSON.stringify(module)}`,
  }
}
