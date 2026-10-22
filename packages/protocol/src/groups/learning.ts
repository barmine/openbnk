import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { InvalidRequestError } from "../errors.js"
import { LocationQuery, locationQueryOpenApi } from "./location.js"

export const LearningChange = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  kind: Schema.Literals(["memory", "skill"]),
  label: Schema.String,
  path: Schema.String,
  before: Schema.NullOr(Schema.String),
  after: Schema.NullOr(Schema.String),
  status: Schema.Literals(["applied", "undone"]),
  source: Schema.String,
}).annotate({ identifier: "LearningChange" })

export const LearningProposal = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  skill: Schema.String,
  path: Schema.String,
  before: Schema.NullOr(Schema.String),
  after: Schema.String,
  reason: Schema.String,
  status: Schema.Literals(["pending", "accepted", "rejected", "reverted"]),
  source: Schema.String,
}).annotate({ identifier: "LearningProposal" })

export const LearningItem = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["user", "notes", "project", "skill", "proposal", "accepted"]),
  name: Schema.String,
  time: Schema.NullOr(Schema.Number),
  content: Schema.String,
  change: Schema.NullOr(LearningChange),
  proposal: Schema.NullOr(LearningProposal),
}).annotate({ identifier: "LearningItem" })

export const LearningState = Schema.Struct({
  enabled: Schema.Boolean,
  items: Schema.Array(LearningItem),
}).annotate({ identifier: "LearningState" })

const root = "/api/learning"
const ItemPayload = Schema.Struct({ id: Schema.String })

const action = (name: "remove" | "accept" | "reject" | "revert", description: string) =>
  HttpApiEndpoint.post(`learning.${name}`, `${root}/${name}`, {
    query: LocationQuery,
    payload: ItemPayload,
    success: LearningState,
    error: InvalidRequestError,
  })
    .annotateMerge(locationQueryOpenApi)
    .annotateMerge(OpenApi.annotations({ identifier: `learning.${name}`, summary: `${name} learning`, description }))

export const LearningGroup = HttpApiGroup.make("server.learning")
  .add(
    HttpApiEndpoint.get("learning.list", root, {
      query: LocationQuery,
      success: LearningState,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "learning.list",
          summary: "List learnings",
          description: "Memory entries, learned skills and proposals in effect for the requested location.",
        }),
      ),
  )
  .add(action("remove", "Remove one memory entry or learned skill."))
  .add(action("accept", "Accept a proposed change to a user-owned skill."))
  .add(action("reject", "Reject a proposed change to a user-owned skill."))
  .add(action("revert", "Revert an accepted change to a user-owned skill."))
  .add(
    HttpApiEndpoint.post("learning.enabled", `${root}/enabled`, {
      query: LocationQuery,
      payload: Schema.Struct({ enabled: Schema.Boolean }),
      success: LearningState,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "learning.enabled",
          summary: "Turn self-learning on or off",
          description: "Enable or disable the self-learning loop.",
        }),
      ),
  )
  .annotateMerge(OpenApi.annotations({ title: "learning", description: "Self-learning routes." }))
