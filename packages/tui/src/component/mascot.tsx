import { For } from "solid-js"
import { useTheme } from "../context/theme"
import { mascot } from "../mascot/art"

export function Mascot() {
  const theme = useTheme()
  return (
    <box flexShrink={0}>
      <For each={mascot}>
        {(line) => (
          <text fg={theme.text.action.primary.base} selectable={false}>
            {line}
          </text>
        )}
      </For>
    </box>
  )
}
