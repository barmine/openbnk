import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.on,
  Effect.fn("cli.learn.on")(function* () {
    const config = (yield* Global.Service).config
    LearningStore.setEnabled(config, true)
    process.stdout.write("self-learning enabled" + EOL)
  }),
)
