export * as NextSpeaker from "./next-speaker.js"

import type { SessionMessage } from "@openbnk/schema/session-message"
import { ModelProfilePlugin } from "../../plugin/model-profile.js"

// Adapted from QwenLM/qwen-code's next-speaker check (Apache-2.0). When the model ends its turn with no tool
// call, a short side query asks the same model whether its last reply finished, asked the user something, or
// announced work it never started ("Now I'll fix X" and then stop). In the last case the session continues with
// "Please continue." at most MAX_CONTINUES times in a row without a tool call. OPENBNK_PROFILE=0 or OPENBNK_NEXT_SPEAKER=0
// turns it off.

export const MAX_CONTINUES = 2
export const CONTINUE = "Please continue."

export const PROMPT = `Analyze *only* the content and structure of your immediately preceding response (your last turn in the conversation history). Based *strictly* on that response, determine who should logically speak next: the 'user' or the 'model' (you).
**Decision Rules (apply in order):**
1.  **Model Continues:** If your last response explicitly states an immediate next action *you* intend to take (e.g., "Next, I will...", "Now I'll process...", "Moving on to analyze...", indicates an intended tool call that didn't execute), OR if the response seems clearly incomplete (cut off mid-thought without a natural conclusion), then the **'model'** should speak next.
2.  **Question to User:** If your last response ends with a direct question specifically addressed *to the user*, then the **'user'** should speak next.
3.  **Waiting for User:** If your last response completed a thought, statement, or task *and* does not meet the criteria for Rule 1 (Model Continues) or Rule 2 (Question to User), it implies a pause expecting user input or reaction. In this case, the **'user'** should speak next.

Reply with only a JSON object: {"reasoning": "<one sentence>", "next_speaker": "user" | "model"}`

// Agents that only plan or answer are expected to end with "I'll ..." without acting.
const READ_ONLY_AGENTS = new Set(["plan", "explore", "title", "summary", "compaction"])

export const enabled = () => ModelProfilePlugin.enabled() && ModelProfilePlugin.enabled("OPENBNK_NEXT_SPEAKER")

export type Decision =
  | { readonly type: "stop" }
  | { readonly type: "continue" }
  /** Ask the model about `reply`, its last response. */
  | { readonly type: "ask"; readonly reply: string }

/** What to do when the model ends its turn, before any model call. */
export function decide(messages: ReadonlyArray<SessionMessage.Info>): Decision {
  // History loads from the latest completed compaction, so after an automatic one the turn may hold no
  // user message: the checkpoint is the turn's start then. Without this, the first reply after a
  // compaction could end the session silently, which DeepSeek's empty or announce-only replies often did.
  const index = messages.findLastIndex(
    (message) => message.type === "user" || (message.type === "compaction" && message.status === "completed"),
  )
  if (index < 0) return { type: "stop" }
  const turn = messages.slice(index + 1)
  const last = turn.findLast((message) => message.type === "assistant")
  if (!last || last.error || READ_ONLY_AGENTS.has(last.agent)) return { type: "stop" }
  // The cap bounds nudges without progress, not per turn: a long task can need more than MAX_CONTINUES over an
  // hour of work, so counting restarts after the model's last tool call.
  const progress = turn.findLastIndex(
    (message) => message.type === "assistant" && message.content.some((part) => part.type === "tool"),
  )
  const sent = turn
    .slice(progress + 1)
    .filter((message) => message.type === "synthetic" && message.metadata?.nextSpeaker === true).length
  if (sent >= MAX_CONTINUES) return { type: "stop" }
  const reply = last.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim()
  // An empty reply gives the user nothing to act on.
  if (reply.length === 0) return { type: "continue" }
  // A closing question is addressed to the user; no need to ask the model.
  if (/\?\s*$/.test(reply)) return { type: "stop" }
  return { type: "ask", reply: reply.length > 6000 ? reply.slice(-6000) : reply }
}

// DeepSeek Harness treats an empty completion as a retryable error (EMPTY_RESPONSE). An empty reply here re-runs the
// step with no message added, and is left out of later requests, up to MAX_EMPTY_RETRIES times in a row. After
// that, decide() continues with CONTINUE as before.
export const MAX_EMPTY_RETRIES = 3

/** A completed reply with no text and no tool call. Its reasoning alone gives the user nothing to act on. */
export const isEmpty = (message: SessionMessage.Info) =>
  message.type === "assistant" &&
  message.error === undefined &&
  message.content.every((part) => part.type === "reasoning" || (part.type === "text" && part.text.trim() === ""))

/** How many replies in a row, ending with the last message, came back empty. */
export function emptyStreak(messages: ReadonlyArray<SessionMessage.Info>) {
  return messages.length - 1 - messages.findLastIndex((message) => !isEmpty(message))
}

/** Reads the side query's answer. Anything unclear lets the session stop, as qwen-code does. */
export function parse(text: string) {
  return text.match(/"next_speaker"\s*:\s*"(user|model)"/)?.[1] === "model"
}
