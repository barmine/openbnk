import { BnkPlugin } from "./provider/bnk.js"
import { DynamicProviderPlugin } from "./provider/dynamic.js"
import { PromptCacheKeyPlugin } from "./provider/prompt-cache-key.js"
import type { PluginInternal } from "./internal.js"

// Third-party hosted providers are intentionally not registered: inference only goes to the
// local BNK server (or providers the user explicitly declares in config).
export const ProviderPlugins: PluginInternal.InternalPlugin[] = [BnkPlugin, PromptCacheKeyPlugin, DynamicProviderPlugin]
