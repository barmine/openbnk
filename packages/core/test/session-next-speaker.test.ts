import { describe, expect, test } from "bun:test"
import { Agent } from "@openbnk/schema/agent"
import { Model } from "@openbnk/schema/model"
import { Provider } from "@openbnk/schema/provider"
import { SessionMessage } from "@openbnk/schema/session-message"
import { DateTime } from "effect"
import { LeakedCall } from "../src/session/runner/leaked-call.js"
import { LoopCheck } from "../src/session/runner/loop-check.js"
import { NextSpeaker } from "../src/session/runner/next-speaker.js"

let seq = 0
const created = { created: DateTime.makeUnsafe(0) }

const user = (text: string) =>
  SessionMessage.User.make({ id: SessionMessage.ID.make(`msg_user_${seq++}`), type: "user", text, time: created })

const assistant = (content: SessionMessage.AssistantContent[], agent = "build") =>
  SessionMessage.Assistant.make({
    id: SessionMessage.ID.make(`msg_assistant_${seq++}`),
    type: "assistant",
    agent: Agent.ID.make(agent),
    model: { id: Model.ID.make("qwen"), providerID: Provider.ID.make("bnk") },
    content,
    time: created,
  })

const text = (value: string) => SessionMessage.AssistantText.make({ type: "text", text: value })

const tool = (name: string, input: Record<string, unknown>) =>
  SessionMessage.AssistantTool.make({
    type: "tool",
    id: `call_${seq++}`,
    name,
    state: { status: "completed", input, content: [{ type: "text", text: "ok" }] },
    time: created,
  })

const compaction = () =>
  SessionMessage.CompactionCompleted.make({
    id: SessionMessage.ID.make(`msg_compaction_${seq++}`),
    type: "compaction",
    status: "completed",
    reason: "auto",
    summary: "## Objective\n- fix it",
    time: created,
  })

const synthetic = (metadata: Record<string, unknown>) =>
  SessionMessage.Synthetic.make({
    id: SessionMessage.ID.make(`msg_synthetic_${seq++}`),
    type: "synthetic",
    text: "x",
    metadata,
    time: created,
  })

describe("next speaker", () => {
  test("asks the model about a finished-looking reply", () => {
    expect(NextSpeaker.decide([user("fix it"), assistant([text("Now I'll fix orders.py.")])])).toEqual({
      type: "ask",
      reply: "Now I'll fix orders.py.",
    })
  })

  test("continues an empty reply without asking", () => {
    expect(NextSpeaker.decide([user("fix it"), assistant([tool("read", { path: "a" })]), assistant([])])).toEqual({
      type: "continue",
    })
  })

  test("stops on a closing question, a read-only agent, or after the cap", () => {
    expect(NextSpeaker.decide([user("x"), assistant([text("Should I also update the tests?")])]).type).toBe("stop")
    expect(NextSpeaker.decide([user("x"), assistant([text("I'll implement it once approved.")], "plan")]).type).toBe(
      "stop",
    )
    const nudged = [user("x"), assistant([text("Next I'll run it.")]), synthetic({ nextSpeaker: true })]
    const capped = [...nudged, assistant([text("Next I'll run it.")]), synthetic({ nextSpeaker: true })]
    expect(NextSpeaker.decide([...nudged, assistant([text("Next I'll run it.")])]).type).toBe("ask")
    expect(NextSpeaker.decide([...capped, assistant([text("Next I'll run it.")])]).type).toBe("stop")
  })

  test("a completed compaction starts the turn when history loads from it", () => {
    // After an automatic compaction, history starts at the checkpoint and holds no user message.
    expect(NextSpeaker.decide([compaction(), assistant([])])).toEqual({ type: "continue" })
    expect(NextSpeaker.decide([compaction(), assistant([text("Now I'll fix orders.py.")])])).toEqual({
      type: "ask",
      reply: "Now I'll fix orders.py.",
    })
    expect(NextSpeaker.decide([compaction(), assistant([text("Done?")])]).type).toBe("stop")
    // A user message after the checkpoint is the newer boundary, so an earlier nudge no longer counts.
    const nudged = [compaction(), assistant([text("Next I'll run it.")]), synthetic({ nextSpeaker: true })]
    expect(NextSpeaker.decide([...nudged, user("x"), assistant([text("Next I'll run it.")])]).type).toBe("ask")
  })

  test("reads the side query's answer", () => {
    expect(NextSpeaker.parse('{"reasoning": "announced a fix", "next_speaker": "model"}')).toBe(true)
    expect(NextSpeaker.parse('```json\n{"reasoning":"done","next_speaker":"user"}\n```')).toBe(false)
    expect(NextSpeaker.parse("not json")).toBe(false)
  })
})

describe("loop check", () => {
  const same = () => assistant([tool("shell", { command: "pytest" })])

  test("warns after five identical calls in a row, once per streak", () => {
    const four = [user("x"), same(), same(), same(), same()]
    expect(LoopCheck.check(four)).toBe(undefined)
    expect(LoopCheck.check([...four, same()])).toContain("`shell` has been called 5 times in a row")
    expect(LoopCheck.check([...four, same(), synthetic({ loopCheck: true }), same()])).toBe(undefined)
  })

  test("a different call breaks the streak", () => {
    const other = assistant([tool("shell", { command: "ls" })])
    expect(LoopCheck.check([user("x"), same(), same(), same(), other, same(), same()])).toBe(undefined)
  })
})

describe("leaked tool calls", () => {
  const reasoning = (value: string) => SessionMessage.AssistantReasoning.make({ type: "reasoning", text: value })
  // The shape observed from Qwen3.8 in a benchmark run: the edit call landed in the reasoning stream.
  const leaked =
    "Now fix orders.py.\n<tool_call>\n<function=edit>\n<parameter=oldString>\n            self.stock.release(sku, qty)\n</parameter>\n<parameter=path>\n/work/orders.py\n</parameter>\n</function>\n</tool_call>"

  test("finds a call written into the reasoning", () => {
    const message = assistant([reasoning(leaked), text("Let me go through the discrepancies one by one and fix them.")])
    expect(LeakedCall.find(message, ["edit", "read"])).toEqual(["edit"])
    expect(LeakedCall.prompt(["edit"])).toContain("`edit` as text")
  })

  test("ignores unknown tools, fenced examples, and replies that made real calls", () => {
    expect(LeakedCall.find(assistant([reasoning(leaked)]), ["read"])).toEqual([])
    expect(LeakedCall.find(assistant([text("```\n" + leaked + "\n```")]), ["edit"])).toEqual([])
    expect(LeakedCall.find(assistant([reasoning(leaked), tool("read", { path: "a" })]), ["edit"])).toEqual([])
  })
})
