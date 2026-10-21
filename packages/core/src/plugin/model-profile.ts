export * as ModelProfilePlugin from "./model-profile.js"

import { define } from "@openbnk/plugin/effect/plugin"
import type { SessionHooks } from "@openbnk/plugin/effect/session"
import { Model } from "@openbnk/schema/model"
import { Effect } from "effect"

// Per-family request defaults for open-weight models, from the vendors' published guidance:
// - Qwen3.x thinking models: temperature 0.6, top_p 0.95, top_k 20, min_p 0 for precise coding; the
//   chat template drops earlier reasoning unless `preserve_thinking` is set, and Qwen3.6+ is trained to
//   reuse those traces in agent loops.
// - DeepSeek: R1-style reasoners want temperature 0.6/top_p 0.95; V3.2 recommends 1.0/0.95 for local
//   serving; earlier V3 releases are tuned for 0.3.
// For these families the Code Mode catalog (`execute` plus a typed listing of OpenBnk's own management
// tools, ~4K tokens on every request) is dropped: it is indirection a mid-size local model rarely uses
// well, and coding work only needs the direct tools.
// User-configured body values win over these defaults. OPENBNK_PROFILE=0 disables everything, and
// OPENBNK_PROFILE_SAMPLING=0 / _THINKING=0 / _CODEMODE=0 disable one part (used for A/B evaluation).

export type Family = "qwen" | "deepseek"

export const family = (ids: readonly (string | undefined)[]): Family | undefined => {
  const text = ids.join(" ").toLowerCase()
  if (text.includes("qwen") || text.includes("qwq")) return "qwen"
  if (text.includes("deepseek")) return "deepseek"
}

const off = (name: string) => ["0", "false", "off"].includes(process.env[name]?.toLowerCase() ?? "")
/** False when the profile (or one named part of it) is switched off through the environment. */
export const enabled = (name = "OPENBNK_PROFILE") => !off(name)

export const defaults = (kind: Family, id: string): Record<string, unknown> => {
  const sampling = off("OPENBNK_PROFILE_SAMPLING")
  const thinking = off("OPENBNK_PROFILE_THINKING")
  const lower = id.toLowerCase()
  if (kind === "qwen")
    return {
      ...(sampling ? {} : { temperature: 0.6, top_p: 0.95, top_k: 20, min_p: 0 }),
      ...(thinking ? {} : { chat_template_kwargs: { preserve_thinking: true } }),
    }
  if (sampling) return {}
  if (lower.includes("r1") || lower.includes("reason")) return { temperature: 0.6, top_p: 0.95 }
  if (/v3\.[2-9]|v[4-9]/.test(lower)) return { temperature: 1.0, top_p: 0.95 }
  return { temperature: 0.3 }
}

export const Plugin = define({
  id: "openbnk.model.profile",
  effect: Effect.fn("ModelProfilePlugin")(function* (ctx) {
    if (off("OPENBNK_PROFILE")) return
    yield* ctx.provider.transform((providers) => {
      for (const definition of providers.list())
        for (const model of definition.models.values()) {
          const kind = family([model.id, model.modelID, model.name, model.family])
          if (!kind) continue
          const merged = mergeDefaults(defaults(kind, model.id), model.body)
          if (Object.keys(merged).length === 0) continue
          providers.models.update(definition.provider.id, model.id, (item) => {
            item.body = merged
          })
        }
    })
    if (off("OPENBNK_PROFILE_CODEMODE")) return
    const hook = (event: SessionHooks["context"]) =>
      Effect.gen(function* () {
        const model =
          (yield* ctx.model.list()).data.find(
            (item) => item.providerID === event.model.providerID && item.id === event.model.id,
          ) ?? Model.Info.default(event.model.providerID, event.model.id)
        if (!family([model.id, model.modelID, model.name])) return
        if (!event.tools.execute) return
        const index = event.system.findIndex((part) => part.text.includes(CODE_MODE_HEADING))
        if (index < 0) return
        const text = stripCodeMode(event.system[index]!.text)
        if (text === undefined) return
        event.system[index] = { ...event.system[index]!, text }
        delete event.tools.execute
      }).pipe(Effect.catch(() => Effect.void))
    yield* ctx.session.hook("context", hook)
  }),
})

const CODE_MODE_HEADING = "# Code Mode\n"
// Blocks that follow the Code Mode catalog in the rendered system prompt; the catalog ends at the first one.
const AFTER_CODE_MODE = ["\n\nSkills provide specialized", "\n\nToday's date", "\n\nHere is some useful information"]

/** Removes the Code Mode section, or returns undefined when its end cannot be found reliably. */
export function stripCodeMode(text: string) {
  const start = text.indexOf(CODE_MODE_HEADING)
  if (start < 0) return undefined
  const end = AFTER_CODE_MODE.map((marker) => text.indexOf(marker, start)).filter((i) => i > start)
  if (end.length === 0) return undefined
  return text.slice(0, start).trimEnd() + text.slice(Math.min(...end))
}

function mergeDefaults(base: Record<string, unknown>, user: Record<string, unknown> | undefined) {
  const kwargs = { ...(base.chat_template_kwargs as object), ...(user?.chat_template_kwargs as object) }
  return {
    ...base,
    ...user,
    ...(Object.keys(kwargs).length ? { chat_template_kwargs: kwargs } : {}),
  }
}
