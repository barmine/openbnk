export * as LoopCheck from "./loop-check.js"

import type { SessionMessage } from "@openbnk/schema/session-message"
import { ModelProfilePlugin } from "../../plugin/model-profile.js"

// Adapted from QwenLM/qwen-code's loop protection (Apache-2.0), in its default "warn" mode: when the model
// repeats the same tool call with identical arguments THRESHOLD times in a row, it is told the result will not
// change, once per streak. The turn is never stopped. OPENBNK_PROFILE=0 or OPENBNK_LOOP_CHECK=0 turns it off.

export const THRESHOLD = 5

export const enabled = () => ModelProfilePlugin.enabled() && ModelProfilePlugin.enabled("OPENBNK_LOOP_CHECK")

/** A warning for a repeated identical tool call, or undefined. */
export function check(messages: ReadonlyArray<SessionMessage.Info>) {
  const start = messages.findLastIndex((message) => message.type === "user")
  // The newest call last; a warning already sent for this streak ends the scan.
  const calls: string[] = []
  for (const message of messages.slice(start + 1).toReversed()) {
    if (message.type === "synthetic" && message.metadata?.loopCheck === true) break
    if (message.type !== "assistant") continue
    for (const part of message.content.toReversed())
      if (part.type === "tool" && part.state.status !== "streaming")
        calls.push(`${part.name} ${JSON.stringify(part.state.input)}`)
  }
  const [latest] = calls
  if (!latest) return undefined
  const streak = calls.findIndex((call) => call !== latest)
  const count = streak < 0 ? calls.length : streak
  if (count < THRESHOLD) return undefined
  const name = latest.slice(0, latest.indexOf(" "))
  return `<system-reminder>\n\`${name}\` has been called ${count} times in a row with identical arguments, so its result will not change. Use the result you already have, or change the approach.\n</system-reminder>`
}
