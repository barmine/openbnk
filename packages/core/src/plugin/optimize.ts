export * as OptimizePlugin from "./optimize.js"

import { define } from "@openbnk/plugin/effect/plugin"
import type { SessionHooks } from "@openbnk/plugin/effect/session"
import { Model } from "@openbnk/schema/model"
import { Effect } from "effect"
import { SessionSystemPrompt } from "../session/system-prompt.js"

import PROMPT_GPT from "./system-prompt/gpt.txt"
import PROMPT_ASTRA from "./system-prompt/gpt-astra.txt"
import PROMPT_KIMI from "./system-prompt/kimi.txt"
import PROMPT_META from "./system-prompt/meta.txt"
import PROMPT_TRINITY from "./system-prompt/trinity.txt"
import PROMPT_ANTHROPIC from "./system-prompt/anthropic.txt"
import PROMPT_QWEN from "./system-prompt/qwen.txt"
import { ModelProfilePlugin } from "./model-profile.js"

export const OpenAIPlugin = make("openbnk.prompt.openai", (model) => {
  const id = model.id.toLowerCase()
  if (!id.includes("gpt")) return undefined
  return id.includes("astra") ? PROMPT_ASTRA : PROMPT_GPT
})

export const AnthropicPlugin = make(
  "openbnk.prompt.anthropic",
  (model) => {
    const id = model.id.toLowerCase()
    if (!id.includes("claude")) return undefined
    return PROMPT_ANTHROPIC
  },
  "append",
)

// Both OpenAIToolsPlugin and AnthropicToolsPlugin are disabled intentionally until we can figure out a good ux for displaying
// heavy grep/glob usage done via shell or other mechanisms

export const OpenAIToolsPlugin = make("openbnk.optimize.openai.tools", (model, tools) => {
  const ids = [model.id, model.modelID, model.family].join(" ").toLowerCase()
  if (!ids.includes("gpt")) return undefined
  delete tools.grep
  delete tools.glob
  return undefined
})

export const AnthropicToolsPlugin = make("openbnk.optimize.anthropic.tools", (model, tools) => {
  const ids = [model.id, model.modelID, model.family].join(" ").toLowerCase()
  if (!ids.includes("claude")) return undefined
  delete tools.grep
  delete tools.glob
  return undefined
})

export const KimiPlugin = make("openbnk.prompt.kimi", (model) =>
  model.id.toLowerCase().includes("kimi") ? PROMPT_KIMI : undefined,
)
export const ArceePlugin = make("openbnk.prompt.arcee", (model) =>
  model.id.toLowerCase().includes("trinity") ? PROMPT_TRINITY : undefined,
)
export const MetaPlugin = make("openbnk.prompt.meta", (model) => {
  if (!model.id.toLowerCase().includes("muse")) return undefined
  return PROMPT_META.replaceAll("{{MODEL_NAME}}", model.name)
})

// Workflow, verification and finish-the-task guidance adapted from QwenLM/qwen-code (Apache-2.0). Without it
// Qwen gets the short generic prompt. OPENBNK_PROFILE=0 or OPENBNK_PROFILE_PROMPT=0 keeps the generic prompt.
export const QwenPlugin = make("openbnk.prompt.qwen", (model) => {
  if (!ModelProfilePlugin.enabled() || !ModelProfilePlugin.enabled("OPENBNK_PROFILE_PROMPT")) return undefined
  return ModelProfilePlugin.family([model.id, model.modelID, model.family]) === "qwen" ? PROMPT_QWEN : undefined
})

export const Plugins = [OpenAIPlugin, AnthropicPlugin, KimiPlugin, ArceePlugin, MetaPlugin, QwenPlugin] as const

function make(
  id: string,
  optimize: (model: Model.Info, tools: SessionHooks["context"]["tools"]) => string | undefined,
  mode: "override" | "append" = "override",
) {
  return define({
    id,
    effect: Effect.fn(`OptimizePlugin.${id}`)(function* (ctx) {
      const hook = (event: SessionHooks["context"]) =>
        Effect.gen(function* () {
          const model =
            (yield* ctx.model.list()).data.find(
              (model) => model.providerID === event.model.providerID && model.id === event.model.id,
            ) ?? Model.Info.default(event.model.providerID, event.model.id)
          // Curate tools before rendering their guidance, including for agents with a custom system prompt.
          const template = optimize(model, event.tools)
          if (!template) return
          if ((yield* ctx.agent.get({ agentID: event.agent })).data.system) return
          const system = event.system[0]
          if (!system) return
          const rendered = SessionSystemPrompt.render(template, Object.keys(event.tools))
          const text = mode === "append" ? `${system.text}\n\n${rendered}` : rendered
          event.system[0] = { ...system, text }
        }).pipe(Effect.catch(() => Effect.void))
      yield* ctx.session.hook("context", hook)
      yield* ctx.session.hook("compaction", hook)
      yield* ctx.session.hook("generate", hook)
    }),
  })
}
