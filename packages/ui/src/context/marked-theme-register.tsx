import { registerCustomTheme } from "@pierre/diffs"
import { OpenBnkTheme } from "./marked-theme"

let registered = false

export function registerOpenBnkTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("OpenBnk", () => Promise.resolve(OpenBnkTheme))
}
