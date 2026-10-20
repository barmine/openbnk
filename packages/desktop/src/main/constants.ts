import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENBNK_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENBNK_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "OpenBnk Dev",
  beta: "OpenBnk Beta",
  prod: "OpenBnk",
}

const appIDs: Record<string, string> = {
  dev: "ai.openbnk.desktop.dev",
  beta: "ai.openbnk.desktop.beta",
  prod: "ai.openbnk.desktop",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "OpenBnk Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "ai.openbnk.desktop.dev"
