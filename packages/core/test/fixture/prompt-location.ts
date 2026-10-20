import type { FileSystem } from "@openbnk/core/filesystem"
import { Bus } from "@openbnk/core/bus"
import { Image } from "@openbnk/core/image"
import { LocationServiceMap } from "@openbnk/core/location-service-map"
import type { LocationServices } from "@openbnk/core/location-services"
import { Plugin } from "@openbnk/core/plugin"
import { PluginHooks } from "@openbnk/core/plugin/hooks"
import { Skill } from "@openbnk/core/skill"
import type { Location } from "@openbnk/schema/location"
import { makeGlobalNode } from "@openbnk/util/effect/app-node"
import { LayerNode } from "@openbnk/util/effect/layer-node"
import { Effect, Layer, LayerMap } from "effect"

// Plain-prompt unit fixtures use virtual directories.
export const promptLocationNode = makeGlobalNode({
  service: LocationServiceMap.Service,
  layer: Layer.effect(
    LocationServiceMap.Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      return yield* LayerMap.make(
        (_ref: Location.Ref) =>
          LayerNode.compile(LayerNode.group([PluginHooks.node, Image.node, Skill.node, Plugin.node]), {
            replacements: [
              Bus.node.replace(Layer.succeed(Bus.Service, bus)),
              Plugin.node.replace(Layer.mock(Plugin.Service, { awaitActivation: Effect.void })),
            ],
          }) as unknown as Layer.Layer<LocationServices, FileSystem.DirectoryNotFoundError>,
      )
    }),
  ),
  deps: [Bus.node],
})
