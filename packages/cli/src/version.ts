import { Option, Schema } from "effect"

declare const OPENBNK_VERSION: string
declare const OPENBNK_CHANNEL: string
declare const OPENBNK_ARTIFACT: string
declare const OPENBNK_RELEASE_HIGHLIGHTS: string

const version = typeof OPENBNK_VERSION === "string" ? OPENBNK_VERSION : "local"
const channel = typeof OPENBNK_CHANNEL === "string" ? OPENBNK_CHANNEL : "local"
const artifact = typeof OPENBNK_ARTIFACT === "string" ? OPENBNK_ARTIFACT : "cli"
// Stable release builds embed the release notes' Highlights; every other build has none.
const highlights =
  typeof OPENBNK_RELEASE_HIGHLIGHTS === "string"
    ? Option.getOrElse(
        Schema.decodeUnknownOption(
          Schema.fromJsonString(Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String }))),
        )(OPENBNK_RELEASE_HIGHLIGHTS),
        () => [],
      )
    : []

export {
  version as OPENBNK_VERSION,
  channel as OPENBNK_CHANNEL,
  artifact as OPENBNK_ARTIFACT,
  highlights as OPENBNK_HIGHLIGHTS,
}
export const OPENBNK_LOCAL = channel === "local"
