// TODO: Keep additional network capabilities inside Schema and Protocol as the client grows; /effect must never import
// Core or Server. Preserve these datatype exports so internal model reorganizations do not require caller migrations.
import type { Effect } from "effect"
import type { OpenBnk } from "./client.js"

export * from "./generated/index"
export { OpenBnk } from "./client.js"
export type {
  AgentApi,
  AppApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcClient,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export { Agent } from "@openbnk/schema/agent"
export { Command } from "@openbnk/schema/command"
export { Config } from "@openbnk/schema/config"
export { Credential } from "@openbnk/schema/credential"
export { Event } from "@openbnk/schema/event"
export { EventLog } from "@openbnk/schema/event-log"
export { FileSystem } from "@openbnk/schema/filesystem"
export { Form } from "@openbnk/schema/form"
export { Integration } from "@openbnk/schema/integration"
export { Location } from "@openbnk/schema/location"
export { Model } from "@openbnk/schema/model"
export { Permission } from "@openbnk/schema/permission"
export { PermissionSaved } from "@openbnk/schema/permission-saved"
export { Project } from "@openbnk/schema/project"
export { Worktree } from "@openbnk/schema/worktree"
export { Vcs } from "@openbnk/schema/vcs"
export { Provider } from "@openbnk/schema/provider"
export { Pty } from "@openbnk/schema/pty"
export { Question } from "@openbnk/schema/question"
export { Reference } from "@openbnk/schema/reference"
export { WebSearch } from "@openbnk/schema/websearch"
export { AbsolutePath, RelativePath } from "@openbnk/schema/schema"
export { Session } from "@openbnk/schema/session"
export { SessionInbox } from "@openbnk/schema/session-inbox"
export { SessionMessage } from "@openbnk/schema/session-message"
export { Skill } from "@openbnk/schema/skill"
export { Prompt } from "@openbnk/schema/prompt"
export { PromptInput } from "@openbnk/schema/prompt-input"
export type { OpenBnkEvent } from "@openbnk/protocol/groups/event"
export type OpenBnkClient = Effect.Success<ReturnType<typeof OpenBnk.make>>
