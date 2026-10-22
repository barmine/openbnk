import type { LearningItem, LearningState } from "@openbnk/client"
import type { Plugin } from "@openbnk/plugin/tui"
import { createSignal, Show } from "solid-js"
import { LearningsView, type LearningsActions } from "../learnings"
import type { Story } from "./index"
import { StoryFooter } from "./footer"

const hour = 3_600_000
const skill = (name: string, body: string) => `---\nname: ${name}\ndescription: ${body}\n---\n\n1. ${body}\n`

const fixture = (): LearningItem[] => {
  const now = Date.now()
  const change = (source: string, time: number) => ({
    id: `c${time}`,
    time,
    kind: "memory" as const,
    label: "remembered",
    path: "/config/learning/memory/USER.md",
    before: null,
    after: null,
    status: "applied" as const,
    source,
  })
  const proposal = (status: "pending" | "accepted", time: number) => ({
    id: `p-${status}`,
    time,
    skill: "deploy",
    path: "/config/skills/deploy/SKILL.md",
    before: skill("deploy", "Run bun run build, then push the tag."),
    after: skill("deploy", "Run bun run check first, then bun run build, then push the tag."),
    reason: "The build was pushed twice with failing type checks.",
    status,
    source: "review:ses_1",
  })
  return [
    {
      id: "mem:user:0",
      kind: "user",
      name: "Serve dev servers on the LAN with Bun",
      time: now - hour,
      content: "Prefers local web servers to be built with Bun and made reachable from the LAN.",
      change: change("review:ses_1", now - hour),
      proposal: null,
    },
    {
      id: "mem:notes:0",
      kind: "notes",
      name: "Agent-started background shells may be reaped",
      time: now - 3 * hour,
      content:
        "Agent-started background shell processes may be reaped when the agent session resumes; verify long-running dev servers with pgrep and curl.",
      change: change("agent", now - 3 * hour),
      proposal: null,
    },
    {
      id: "mem:project:0",
      kind: "project",
      name: "Click ripples on the landing canvas",
      time: now - 26 * hour,
      content: "Click ripples on the landing canvas.",
      change: null,
      proposal: null,
    },
    {
      id: "skill:bun-lan-dev-server",
      kind: "skill",
      name: "bun-lan-dev-server",
      time: now - 2 * hour,
      content: skill("bun-lan-dev-server", "Bind Bun.serve to 0.0.0.0 and print the LAN URL."),
      change: null,
      proposal: null,
    },
    {
      id: "proposal:p-pending",
      kind: "proposal",
      name: "deploy",
      time: now - 5 * 60_000,
      content: "",
      change: null,
      proposal: proposal("pending", now - 5 * 60_000),
    },
    {
      id: "proposal:p-accepted",
      kind: "accepted",
      name: "deploy",
      time: now - 50 * hour,
      content: "",
      change: null,
      proposal: proposal("accepted", now - 50 * hour),
    },
  ]
}

function LearningsStory(props: { context: Plugin.Context }) {
  const [items, setItems] = createSignal(fixture())
  const [enabled, setEnabled] = createSignal(true)
  const [version, setVersion] = createSignal(0)
  // Actions only change this fixture, so the story is safe to explore repeatedly.
  const state = (): LearningState => ({ enabled: enabled(), items: items() })
  const drop = (item: LearningItem) => {
    setItems((list) => list.filter((entry) => entry.id !== item.id))
    return Promise.resolve(state())
  }
  const actions: LearningsActions = {
    remove: drop,
    reject: drop,
    revert: (item) =>
      item.id === "proposal:p-accepted" && version() % 2 === 1
        ? Promise.reject(new Error("Skill was edited since you accepted this change; revert it by hand"))
        : drop(item),
    accept: (item) => {
      setItems((list) =>
        list.map((entry) => (entry.id === item.id ? { ...entry, kind: "accepted" as const, time: Date.now() } : entry)),
      )
      return Promise.resolve(state())
    },
    setEnabled: (value) => {
      setEnabled(value)
      return Promise.resolve(state())
    },
  }
  const reset = (list: LearningItem[]) => {
    setItems(list)
    setVersion((value) => value + 1)
  }

  props.context.keymap.layer(() => ({
    commands: [
      {
        bind: "e",
        title: "Toggle empty fixture",
        group: "Storybook",
        run: () => reset(items().length ? [] : fixture()),
      },
      { bind: "x", title: "Reset fixture", group: "Storybook", run: () => reset(fixture()) },
    ],
  }))

  return (
    <box width="100%" height="100%" flexDirection="column">
      <box flexGrow={1} flexDirection="column">
        <Show when={version() + 1} keyed>
          <LearningsView
            context={props.context}
            state={state()}
            actions={actions}
            onBack={() => props.context.ui.router.navigate({ type: "plugin", name: "storybook" })}
          />
        </Show>
      </box>
      <StoryFooter
        context={props.context}
        title="storybook / learnings"
        details={[`${items().length} items`, version() % 2 === 1 ? "revert refuses" : "revert succeeds"]}
        controls={[
          { shortcut: "e", label: "toggle empty" },
          { shortcut: "x", label: "reset (flips revert outcome)" },
        ]}
      />
    </box>
  )
}

export const learningsStory: Story = {
  id: "learnings",
  title: "Learnings",
  render: (context) => <LearningsStory context={context} />,
}
