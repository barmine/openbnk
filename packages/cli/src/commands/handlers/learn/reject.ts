import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.reject,
  Effect.fn("cli.learn.reject")(function* (input) {
    const config = (yield* Global.Service).config
    const proposal = yield* Effect.try(() => LearningStore.resolveProposal(config, input.id, false)).pipe(Effect.orDie)
    process.stdout.write(`rejected change to skill "${proposal.skill}"` + EOL)
  }),
)
