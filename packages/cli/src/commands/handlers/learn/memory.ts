import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.memory,
  Effect.fn("cli.learn.memory")(function* () {
    const config = (yield* Global.Service).config
    for (const target of ["user", "notes"] as const) {
      const entries = LearningStore.entries(config, target)
      process.stdout.write(`# ${target} (${LearningStore.memoryFile(config, target)})` + EOL)
      process.stdout.write((entries.length ? entries.map((entry) => `- ${entry}`).join(EOL) : "(empty)") + EOL + EOL)
    }
  }),
)
