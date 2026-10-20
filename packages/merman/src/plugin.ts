import { Plugin } from "@openbnk/plugin/tui"
import { createMermaidCodeBlockRenderer } from "./markdown.js"
import { resolveOpenBnkDiagramPalette } from "./palette.js"

export default Plugin.define({
  id: "openbnk.merman",
  setup(context) {
    context.markdown.registerCodeBlockRenderer(
      "mermaid",
      createMermaidCodeBlockRenderer(context.renderer, () => ({
        colors: resolveOpenBnkDiagramPalette(context.theme, context.themeMode),
      })),
    )
  },
})
