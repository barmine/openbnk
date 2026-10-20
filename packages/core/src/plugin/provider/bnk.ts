import { Effect, Schema } from "effect"
import { createLocalProviderPlugin } from "./local.js"

const RemoteModel = Schema.Struct({
  id: Schema.String,
  max_model_len: Schema.optional(Schema.NullOr(Schema.Int)),
  context_length: Schema.optional(Schema.NullOr(Schema.Int)),
})

const Response = Schema.Struct({ data: Schema.Array(RemoteModel) })

// The only built-in provider: an OpenAI-compatible local inference server. Every model it serves
// from /v1/models is exposed. Override the origin with provider.bnk.options.baseURL in config.
export const make = createLocalProviderPlugin({
  id: "openbnk.provider.bnk",
  providerID: "bnk",
  name: "BNK Local",
  origin: "http://10.0.75.254:8080",
  discover: (client) =>
    Effect.gen(function* () {
      const response = yield* client.getJson("/v1/models", Response)
      return response.data.filter((model) => model.id.length > 0).toSorted((a, b) => a.id.localeCompare(b.id))
    }),
  model: (item) => ({
    id: item.id,
    tools: true,
    context: item.max_model_len ?? item.context_length,
  }),
})

export const BnkPlugin = make()
