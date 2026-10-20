import { Agent } from "@openbnk/core/agent"
import { AISDK } from "@openbnk/core/aisdk"
import { Command } from "@openbnk/core/command"
import { Config } from "@openbnk/core/config"
import { Credential } from "@openbnk/core/credential"
import { Database } from "@openbnk/core/database/database"
import { FileAccess } from "@openbnk/core/file-access"
import { LayerNodePlatform } from "@openbnk/util/effect/app-node-platform"
import { AppProcess } from "@openbnk/util/process"
import { LayerNode } from "@openbnk/util/effect/layer-node"
import { Bus } from "@openbnk/core/bus"
import { FileSystem } from "@openbnk/core/filesystem"
import { FSUtil } from "@openbnk/util/fs-util"
import { Form } from "@openbnk/core/form"
import { Generate } from "@openbnk/core/generate"
import { Integration } from "@openbnk/core/integration"
import { KV } from "@openbnk/core/kv"
import { Location } from "@openbnk/core/location"
import { ManagedPolicy } from "@openbnk/core/managed-policy"
import { Mcp } from "@openbnk/core/mcp/index"
import { Model } from "@openbnk/core/model"
import { Npm } from "@openbnk/util/npm"
import { Plugin } from "@openbnk/core/plugin"
import { PluginHooks } from "@openbnk/core/plugin/hooks"
import { Provider } from "@openbnk/core/provider"
import { Session } from "@openbnk/core/session"
import { PersistentPty } from "@openbnk/core/persistent-pty"
import { LocationServiceMap } from "@openbnk/core/location-service-map"
import { AppNodeBuilder } from "@openbnk/core/effect/app-node-builder"
import { Permission } from "@openbnk/core/permission"
import { Reference } from "@openbnk/core/reference"
import { Rpc } from "@openbnk/core/rpc"
import { Skill } from "@openbnk/core/skill"
import { SkillDiscovery } from "@openbnk/core/skill/discovery"
import { Watcher } from "@openbnk/core/filesystem/watcher"
import { Tool } from "@openbnk/core/tool"
import { Vcs } from "@openbnk/core/vcs"
import { WebSearch } from "@openbnk/core/websearch"
import { Worktree } from "@openbnk/core/worktree"
import { WorktreeStrategies } from "@openbnk/core/worktree/strategies"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"
import { emptyMcpLayer } from "../fixture/mcp"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: (name) => Effect.succeed({ directory: "", name }),
    resolve: (name) => Effect.succeed({ directory: "", name }),
    check: () => Effect.succeed(false),
    update: (name) => Effect.succeed({ directory: "", name }),
    which: () => Effect.undefined,
  }),
)

const generateLayer = Layer.succeed(Generate.Service, Generate.Service.of({ text: () => Effect.succeed("") }))

const configLayer = Config.testLayer()

const permissionLayer = Layer.succeed(
  Permission.Service,
  Permission.Service.of({
    close: Effect.void,
    ask: (input) => Effect.succeed({ id: input.id ?? Permission.ID.create(), effect: "ask" }),
    assert: () => Effect.void,
    reply: () => Effect.void,
    get: () => Effect.succeed(undefined),
    forSession: () => Effect.succeed([]),
    list: () => Effect.succeed([]),
  }),
)

export const makePluginTestLayer = (permission = permissionLayer) =>
  AppNodeBuilder.build(
    LayerNode.group([
      AppProcess.node,
      FileSystem.node,
      FSUtil.node,
      Location.node,
      Npm.node,
      Credential.node,
      Config.node,
      Database.node,
      FileAccess.node,
      Bus.node,
      Form.node,
      Generate.node,
      LayerNodePlatform.httpClient,
      Plugin.node,
      Agent.node,
      AISDK.node,
      Provider.node,
      Model.node,
      Command.node,
      Integration.node,
      KV.node,
      ManagedPolicy.node,
      Mcp.node,
      Session.node,
      PersistentPty.node,
      LocationServiceMap.node,
      Permission.node,
      PluginHooks.node,
      Reference.node,
      Rpc.node,
      Skill.node,
      SkillDiscovery.node,
      Tool.node,
      Vcs.node,
      Watcher.node,
      WebSearch.node,
      Worktree.node,
      WorktreeStrategies.node,
    ]),
    [
      Location.node.replace(tempLocationLayer),
      Npm.node.replace(npmLayer),
      Config.node.replace(configLayer),
      Mcp.node.replace(emptyMcpLayer),
      Generate.node.replace(generateLayer),
      Permission.node.replace(permission),
    ],
  ).pipe(Layer.provideMerge(configLayer))

export const PluginTestLayer = makePluginTestLayer()
