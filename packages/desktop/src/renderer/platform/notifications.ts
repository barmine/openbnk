import type { Platform } from "@openbnk/app/desktop"
import type { ElectronAPI } from "../api-types"

export function createDesktopNotify(api: ElectronAPI): Platform["notify"] {
  return async (title, description, onClick) => {
    const focused = await api.getWindowFocused().catch(() => document.hasFocus())

    if (focused) return

    const notification = new Notification(title, {
      body: description ?? "",
      icon: "https://openbnk.local/favicon-96x96-v3.png",
      silent: true,
    })

    notification.onclick = () => {
      void api.showWindow()
      void api.setWindowFocus()
      onClick?.()
      notification.close()
    }
  }
}
