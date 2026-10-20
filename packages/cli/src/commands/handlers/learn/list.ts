import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.list,
  Effect.fn("cli.learn.list")(function* () {
    const config = (yield* Global.Service).config
    const date = (time: number) => new Date(time).toISOString().replace("T", " ").slice(0, 16)
    const pending = LearningStore.proposals(config).filter((item) => item.status === "pending")
    const changes = LearningStore.changes(config).slice(0, 30)
    const lines = [
      `self-learning: ${LearningStore.enabled(config) ? "on" : "off"}`,
      "",
      `Pending proposals (${pending.length}):`,
      ...(pending.length
        ? pending.map((item) => `  ${item.id}  ${date(item.time)}  skill "${item.skill}": ${item.reason}`)
        : ["  none"]),
      "",
      "Recent changes:",
      ...(changes.length
        ? changes.map(
            (item) => `  ${item.id}  ${date(item.time)}  ${item.status === "undone" ? "(undone) " : ""}${item.label}`,
          )
        : ["  none"]),
      "",
      "openbnk learn show <id> | undo <id> | accept <id> | reject <id>",
    ]
    process.stdout.write(lines.join(EOL) + EOL)
  }),
)
