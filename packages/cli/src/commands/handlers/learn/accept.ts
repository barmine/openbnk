import { EOL } from "os"
import { Effect } from "effect"
import { Global } from "@openbnk/util/global"
import { LearningStore } from "@openbnk/util/learning-store"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"

export default Runtime.handler(
  Commands.commands.learn.commands.accept,
  Effect.fn("cli.learn.accept")(function* (input) {
    const config = (yield* Global.Service).config
    const proposal = yield* Effect.try(() => LearningStore.resolveProposal(config, input.id, true)).pipe(Effect.orDie)
    process.stdout.write(`accepted change to skill "${proposal.skill}"` + EOL)
  }),
)
