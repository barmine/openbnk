import type { LearningItem, LearningState } from "@openbnk/client"
import { Plugin } from "@openbnk/plugin/tui"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { errorMessage } from "../../util/error"

// The details pane sits beside the list only when both fit; narrower terminals open details on Enter.
const WIDE = 100
const LIST_WIDTH = 46

const kindLabel: Record<LearningItem["kind"], string> = {
  user: "you",
  notes: "environment",
  project: "project",
  skill: "skill",
  proposal: "proposal",
  accepted: "accepted",
}

export type LearningsActions = {
  remove: (item: LearningItem) => Promise<LearningState>
  accept: (item: LearningItem) => Promise<LearningState>
  reject: (item: LearningItem) => Promise<LearningState>
  revert: (item: LearningItem) => Promise<LearningState>
  setEnabled: (enabled: boolean) => Promise<LearningState>
}

/** The Learnings screen: a list of what the agent has learned, with details and management actions. */
export function LearningsView(props: {
  context: Plugin.Context
  state: LearningState | undefined
  loadError?: unknown
  actions: LearningsActions
  onBack: () => void
}) {
  const theme = props.context.theme
  const dimensions = useTerminalDimensions()
  const [local, setLocal] = createSignal<LearningState>()
  const state = () => local() ?? props.state
  const items = () => state()?.items ?? []
  const [index, setIndex] = createSignal(0)
  const [open, setOpen] = createSignal(false)
  const [message, setMessage] = createSignal<{ text: string; error: boolean }>()
  const wide = () => dimensions().width >= WIDE
  const selected = createMemo(() => items()[Math.min(index(), items().length - 1)])

  const run =
    (label: string, action: (item: LearningItem) => Promise<LearningState>, allowed: (item: LearningItem) => boolean) =>
    () => {
      const item = selected()
      if (!item || !allowed(item)) return
      action(item)
        .then((next) => {
          setLocal(next)
          setIndex((value) => Math.max(0, Math.min(value, next.items.length - 1)))
          if (!next.items.some((entry) => entry.id === item.id)) setOpen(false)
          setMessage({ text: `${label} "${item.name}"`, error: false })
        })
        .catch((error) => setMessage({ text: errorMessage(error), error: true }))
    }
  const isMemoryOrSkill = (item: LearningItem) => item.kind !== "proposal" && item.kind !== "accepted"
  const move = (delta: number) => setIndex((value) => Math.max(0, Math.min(items().length - 1, value + delta)))

  props.context.keymap.layer(() => ({
    commands: [
      { bind: "up", title: "Previous learning", group: "Learnings", run: () => void move(-1) },
      { bind: "down", title: "Next learning", group: "Learnings", run: () => void move(1) },
      { bind: "return", title: "Show details", group: "Learnings", run: () => void (selected() && setOpen(true)) },
      {
        bind: "escape",
        title: "Back",
        group: "Learnings",
        run: () => (open() && !wide() ? setOpen(false) : props.onBack()),
      },
      {
        bind: "d",
        title: "Remove learning",
        group: "Learnings",
        run: run("Removed", props.actions.remove, isMemoryOrSkill),
      },
      {
        bind: "a",
        title: "Accept proposal",
        group: "Learnings",
        run: run("Accepted", props.actions.accept, (item) => item.kind === "proposal"),
      },
      {
        bind: "r",
        title: "Reject proposal",
        group: "Learnings",
        run: run("Rejected", props.actions.reject, (item) => item.kind === "proposal"),
      },
      {
        bind: "v",
        title: "Revert accepted change",
        group: "Learnings",
        run: run("Reverted", props.actions.revert, (item) => item.kind === "accepted"),
      },
      {
        bind: "t",
        title: "Turn learning on or off",
        group: "Learnings",
        run: () => {
          const enabled = !(state()?.enabled ?? true)
          props.actions
            .setEnabled(enabled)
            .then((next) => {
              setLocal(next)
              setMessage({ text: `Learning is ${enabled ? "on" : "off"}`, error: false })
            })
            .catch((error) => setMessage({ text: errorMessage(error), error: true }))
        },
      },
    ],
  }))

  const controls = createMemo(() => {
    const item = selected()
    return [
      "↑↓ select",
      ...(wide() || open() ? [] : ["enter details"]),
      ...(item && isMemoryOrSkill(item) ? ["d remove"] : []),
      ...(item?.kind === "proposal" ? ["a accept", "r reject"] : []),
      ...(item?.kind === "accepted" ? ["v revert"] : []),
      `t turn ${state()?.enabled === false ? "on" : "off"}`,
      "esc back",
    ]
  })

  return (
    <box width="100%" flexGrow={1} flexDirection="column" backgroundColor={theme.background.base}>
      <box flexShrink={0} paddingLeft={2} paddingRight={2} paddingTop={1} flexDirection="row" columnGap={2}>
        <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
          Learnings
        </text>
        <Show when={state()}>
          {(value) => (
            <text fg={theme.text.muted}>
              learning {value().enabled ? "on" : "off"} · {value().items.length} in effect
            </text>
          )}
        </Show>
      </box>
      <box flexGrow={1} flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} columnGap={2}>
        <Show when={wide() || !open()}>
          <box width={wide() ? LIST_WIDTH : "100%"} flexShrink={0} flexDirection="column">
            <Show when={props.loadError}>
              <text fg={theme.text.feedback.error.base} flexShrink={0}>
                Could not load learnings: {errorMessage(props.loadError)}
              </text>
            </Show>
            <Show when={!props.loadError && !state()}>
              <text fg={theme.text.muted} flexShrink={0}>
                Loading…
              </text>
            </Show>
            <Show when={state() && items().length === 0}>
              <text fg={theme.text.muted} flexShrink={0}>
                Nothing learned yet.
              </text>
              <text fg={theme.text.faint} flexShrink={0}>
                Memories and skills appear here as the agent learns from your sessions.
              </text>
            </Show>
            <scrollbox flexGrow={1}>
              <For each={items()}>
                {(item, position) => {
                  const active = () => position() === Math.min(index(), items().length - 1)
                  return (
                    <box
                      flexDirection="row"
                      columnGap={1}
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={active() ? theme.background.formfield.focused : undefined}
                      onMouseUp={() => setIndex(position())}
                    >
                      <text fg={active() ? theme.text.formfield.focused : theme.text.muted} flexShrink={0} width={12}>
                        {kindLabel[item.kind]}
                      </text>
                      <text fg={active() ? theme.text.formfield.focused : theme.text.base} flexGrow={1} wrapMode="none">
                        {item.name}
                      </text>
                      <text fg={active() ? theme.text.formfield.focused : theme.text.faint} flexShrink={0}>
                        {ago(item.time)}
                      </text>
                    </box>
                  )
                }}
              </For>
            </scrollbox>
          </box>
        </Show>
        <Show when={(wide() || open()) && selected()}>
          {(item) => <LearningDetails context={props.context} item={item()} />}
        </Show>
      </box>
      <box flexShrink={0} paddingLeft={2} paddingRight={2} flexDirection="column">
        <Show when={message()}>
          {(value) => (
            <text fg={value().error ? theme.text.feedback.error.base : theme.text.feedback.success.base}>
              {value().text}
            </text>
          )}
        </Show>
        <text fg={theme.text.muted} wrapMode="none">
          {controls().join(" · ")}
        </text>
        <box height={1} />
      </box>
    </box>
  )
}

function LearningDetails(props: { context: Plugin.Context; item: LearningItem }) {
  const theme = props.context.theme
  const diff = createMemo(() => {
    const proposal = props.item.proposal
    return proposal ? lineDiff(proposal.before ?? "", proposal.after) : undefined
  })
  const source = () => {
    const raw = props.item.proposal?.source ?? props.item.change?.source
    if (!raw) return "added by hand or before history was kept"
    if (props.item.kind === "accepted") return "proposed by the agent, accepted by you"
    if (raw.startsWith("review:")) return "learned by background review"
    if (raw === "agent") return "saved by the agent during a session"
    return `by ${raw}`
  }
  return (
    <box flexGrow={1} flexDirection="column" border={["left"]} borderColor={theme.border.base} paddingLeft={2}>
      <text fg={theme.text.base} attributes={TextAttributes.BOLD} flexShrink={0}>
        {props.item.name}
      </text>
      <text fg={theme.text.muted} flexShrink={0}>
        {kindLabel[props.item.kind]} · {props.item.time ? new Date(props.item.time).toLocaleString() : "unknown time"} ·{" "}
        {source()}
      </text>
      <Show when={props.item.proposal?.reason}>
        {(reason) => (
          <text fg={theme.text.muted} flexShrink={0}>
            Why: {reason()}
          </text>
        )}
      </Show>
      <box height={1} />
      <scrollbox flexGrow={1}>
        <Show
          when={diff()}
          fallback={
            <text fg={theme.text.base} wrapMode="word">
              {props.item.content}
            </text>
          }
        >
          {(lines) => (
            <For each={lines()}>
              {(line) => (
                <text
                  fg={
                    line.type === "added"
                      ? theme.diff.text.added
                      : line.type === "removed"
                        ? theme.diff.text.removed
                        : theme.text.muted
                  }
                  wrapMode="word"
                >
                  {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                  {line.text}
                </text>
              )}
            </For>
          )}
        </Show>
      </scrollbox>
    </box>
  )
}

function ago(time: number | null) {
  if (!time) return ""
  const minutes = Math.round((Date.now() - time) / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 60 / 24)}d`
}

/** A line diff by longest common subsequence; skill files are capped at 15k chars, so this stays small. */
export function lineDiff(before: string, after: string) {
  const a = before.split("\n")
  const b = after.split("\n")
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
  const lines: { type: "same" | "added" | "removed"; text: string }[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) (lines.push({ type: "same", text: a[i++]! }), j++)
    else if (i < a.length && (j === b.length || table[i + 1]![j]! >= table[i]![j + 1]!))
      lines.push({ type: "removed", text: a[i++]! })
    else lines.push({ type: "added", text: b[j++]! })
  }
  return lines
}

function LearningsPage(props: { context: Plugin.Context; onClose: () => void }) {
  const client = props.context.client
  const location = props.context.location
  const [state] = createResource(() => client.learning.list({ location }))
  const actions: LearningsActions = {
    remove: (item) => client.learning.remove({ location, id: item.id }),
    accept: (item) => client.learning.accept({ location, id: item.id }),
    reject: (item) => client.learning.reject({ location, id: item.id }),
    revert: (item) => client.learning.revert({ location, id: item.id }),
    setEnabled: (enabled) => client.learning.enabled({ location, enabled }),
  }
  return (
    <box width="100%" height="100%" flexDirection="column">
      <LearningsView
        context={props.context}
        state={state.error ? undefined : state()}
        loadError={state.error}
        actions={actions}
        onBack={props.onClose}
      />
    </box>
  )
}

export default Plugin.define({
  id: "openbnk.learnings",
  setup(context) {
    const [previous, setPrevious] = createSignal({ ...context.ui.router.current() })
    context.ui.router.register({
      name: "learnings",
      render: () => <LearningsPage context={context} onClose={() => context.ui.router.navigate(previous())} />,
    })
    context.ui.slot({
      append: "app",
      render() {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "learnings.open",
              title: "Learnings",
              group: "System",
              slash: { name: "learnings" },
              palette: true,
              run() {
                const current = context.ui.router.current()
                if (current.type === "plugin" && current.name === "learnings") return
                // The router exposes a mutable store; retain the route before navigating.
                setPrevious({ ...current })
                context.ui.dialog.clear()
                context.ui.router.navigate({ type: "plugin", name: "learnings" })
              },
            },
          ],
        }))
        return null
      },
    })
  },
})
