import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.undo,
  Effect.fn("cli.learn.undo")(function* (input) {
    const config = (yield* Global.Service).config
    const change = yield* Effect.try(() => LearningStore.undo(config, input.id)).pipe(Effect.orDie)
    process.stdout.write(`undone: ${change.label}` + EOL)
  }),
)
