import type { OpenBnk } from "./client.js"

export * from "./generated/index.js"
export { OpenBnk } from "./client.js"
export type {
  AgentApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcCallOptions,
  RpcClient,
  RpcEventPayload,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export type { EventSubscribeOutput as OpenBnkEvent } from "./generated/types.js"
export type OpenBnkClient = ReturnType<typeof OpenBnk.make>
