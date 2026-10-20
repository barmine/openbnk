import path from "node:path"
import { OPENBNK_CHANNEL } from "./version"

export function databasePath(data: string) {
  const filename =
    process.env.OPENBNK_DB ??
    (["latest", "dev", "beta", "next", "prod"].includes(OPENBNK_CHANNEL) ||
    process.env.OPENBNK_DISABLE_CHANNEL_DB === "1" ||
    process.env.OPENBNK_DISABLE_CHANNEL_DB === "true"
      ? "openbnk.db"
      : `openbnk-${OPENBNK_CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  return filename === ":memory:" ? filename : path.resolve(data, filename)
}
