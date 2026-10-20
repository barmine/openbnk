import { ensurePluginRuntime, provides } from "@openbnk/plugin/runtime"
import { Plugin, PluginContextProvider, usePlugin } from "@openbnk/plugin/tui"
import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure"

ensurePluginRuntime()
ensureRuntimePluginSupport({
  additional: {
    "@openbnk/plugin/tui": { Plugin, PluginContextProvider, usePlugin },
  },
  preserve: provides,
})
