import { Location } from "@openbnk/core/location"
import { InvalidRequestError } from "@openbnk/protocol/errors"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"

export const LearningHandler = HttpApiBuilder.group(Api, "server.learning", (handlers) =>
  Effect.gen(function* () {
    const config = (yield* Global.Service).config
    const state = Effect.fn("server.learning.state")(function* () {
      const location = yield* Location.Service
      return {
        enabled: LearningStore.enabled(config),
        items: LearningStore.items(config, location.project.id),
      }
    })
    // Runs a store operation and returns the refreshed state; store refusals become 400s with their message.
    const act = (run: (config: string, projectID: string) => unknown) =>
      Effect.fn("server.learning.act")(function* () {
        const location = yield* Location.Service
        yield* Effect.try({
          try: () => run(config, location.project.id),
          catch: (error) =>
            new InvalidRequestError({
              message: error instanceof LearningStore.LearningError ? error.message : String(error),
            }),
        })
        return yield* state()
      })
    const proposalID = (id: string) => id.replace(/^proposal:/, "")
    return handlers
      .handle("learning.list", () => state())
      .handle("learning.remove", (ctx) =>
        act((config, projectID) => LearningStore.removeItem(config, ctx.payload.id, projectID))(),
      )
      .handle("learning.accept", (ctx) =>
        act((config) => LearningStore.resolveProposal(config, proposalID(ctx.payload.id), true))(),
      )
      .handle("learning.reject", (ctx) =>
        act((config) => LearningStore.resolveProposal(config, proposalID(ctx.payload.id), false))(),
      )
      .handle("learning.revert", (ctx) =>
        act((config) => LearningStore.revertAccepted(config, proposalID(ctx.payload.id)))(),
      )
      .handle("learning.enabled", (ctx) =>
        Effect.suspend(() => {
          LearningStore.setEnabled(config, ctx.payload.enabled)
          return state()
        }),
      )
  }),
)
