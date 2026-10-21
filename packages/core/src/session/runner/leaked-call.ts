export * as LeakedCall from "./leaked-call.js"

import type { SessionMessage } from "@openbnk/schema/session-message"

// Qwen sometimes writes a tool call in its native XML format (`<function=edit><parameter=path>...`) into its
// reasoning or text instead of as a structured call, and the server returns it with finish reason "stop". The
// step then looks finished and the session goes idle with the work undone. qwen-code parses such calls out of
// the visible text (xml-tool-call-fallback.ts, Apache-2.0); here the reasoning is checked too, because that is
// where the call landed in the observed case, and the model is asked to issue the call properly.

const CALL = /<function=([\w.-]+)>[\s\S]*?<\/function>|<invoke name="([\w.-]+)">[\s\S]*?<\/invoke>/g

/** The names of tool calls written as text in the reply's last 20000 characters, if any. */
export function find(message: SessionMessage.Assistant, tools: ReadonlyArray<string>) {
  if (message.content.some((part) => part.type === "tool")) return []
  const text = message.content
    .flatMap((part) => (part.type === "text" || part.type === "reasoning" ? [part.text] : []))
    .join("\n")
    .slice(-20_000)
  // Calls inside fenced code are examples, not attempts.
  const outside = text.replace(/```[\s\S]*?```/g, "")
  const names = [...outside.matchAll(CALL)].map((match) => match[1] ?? match[2]!)
  return [...new Set(names.filter((name) => tools.includes(name)))]
}

export const prompt = (names: ReadonlyArray<string>) =>
  `<system-reminder>\nYour previous response wrote ${names.map((name) => `\`${name}\``).join(", ")} as text (in the <function=...> format), so it was not executed. Nothing ran. Make the call again as a real tool call now.\n</system-reminder>`
