import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.off,
  Effect.fn("cli.learn.off")(function* () {
    const config = (yield* Global.Service).config
    LearningStore.setEnabled(config, false)
    process.stdout.write("self-learning disabled" + EOL)
  }),
)
