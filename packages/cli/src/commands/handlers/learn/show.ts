import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.show,
  Effect.fn("cli.learn.show")(function* (input) {
    const config = (yield* Global.Service).config
    const entry = yield* Effect.try(() => LearningStore.find(config, input.id)).pipe(Effect.orDie)
    const item = entry.item
    const header =
      entry.type === "change"
        ? `${entry.item.label} [${entry.item.status}]`
        : `proposed change to skill "${entry.item.skill}" [${entry.item.status}]: ${entry.item.reason}`
    process.stdout.write(
      [
        header,
        `file: ${item.path}`,
        "",
        "--- before",
        item.before ?? "(none)",
        "",
        "+++ after",
        item.after ?? "(deleted)",
      ].join(EOL) + EOL,
    )
  }),
)
