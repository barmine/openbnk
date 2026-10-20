# openbnk

A private, self-hosted fork of [opencode](https://github.com/anomalyco/opencode). It keeps the full
opencode agent harness (TUI, CLI, tools, MCP, plugins, skills) and makes three changes:

- **Local inference only.** The only built-in model provider is your OpenAI-compatible server at
  `http://10.0.75.254:8080/v1`. Every model it serves (`GET /v1/models`) shows up automatically. Hosted
  providers are not registered.
- **No phone-home.** Nothing contacts opencode or Anomaly infrastructure: no models.dev catalog fetch,
  no update checks, no remote-access tunnel, no hosted MCP OAuth client document, and no Sentry. The
  agent can still use the internet on your behalf (web fetch, web search, MCP servers, plugin and skill
  installs).
- **Self-learning.** openbnk gets better the more you use it. See below.

## Install

On any Linux or macOS machine that has `git`, `curl` and `unzip`, plus `gh` logged in to GitHub:

```sh
bash <(gh api repos/christ-pher/openbnk/contents/install -H "Accept: application/vnd.github.raw")
```

Or from a checkout, run `./install`. The installer:

1. installs Bun if it's missing,
2. clones the source to `~/.local/share/openbnk/src`,
3. builds a native binary,
4. installs it to `~/.local/bin/openbnk`.

To update, re-run the installer.

To point at a different model server, set this in `~/.config/openbnk/openbnk.json`:

```json
{ "provider": { "bnk": { "options": { "baseURL": "http://my-server:8080/v1" } } } }
```

## Self-learning

This is modelled on [Hermes Agent](https://github.com/NousResearch/hermes-agent)'s learning loop.

- **Memory.** There are two small notes files, loaded into every session:
  - `~/.config/openbnk/learning/memory/USER.md`: your preferences, corrections and setup.
  - `~/.config/openbnk/learning/memory/NOTES.md`: environment and project facts.

  The agent maintains them with its `memory` tool. You can also just say "remember this".
- **Background review.** After every 10 model steps in a session (`OPENBNK_LEARNING_INTERVAL`), once
  the session goes idle, a background pass on your local model re-reads the conversation. It saves
  corrections, techniques and fixes to memory or skills. A toast in the TUI tells you what it learned.
- **Self-written skills.** The agent creates and refines skills in `~/.config/openbnk/skills/learned/`.
  These load like any other skill.
- **Your skills are protected.** Changes the agent wants to make to skills you installed or wrote are
  queued as proposals for you to approve.
- **Past-session recall.** The `session_search` tool searches the text of your previous conversations.

Every change is versioned and can be undone:

```sh
openbnk learn list          # recent changes and pending proposals
openbnk learn show <id>     # before/after
openbnk learn undo <id>     # roll back an applied change
openbnk learn accept <id>   # apply a proposed change to one of your skills
openbnk learn reject <id>
openbnk learn memory        # print current memory
openbnk learn off | on      # disable/enable learning (or OPENBNK_LEARNING=0)
```

The design is in `docs/superpowers/specs/2026-10-20-self-learning-design.md`.

## Development

```sh
bun install
bun run dev                 # run the TUI from source
bun run dev run "hello"     # one-shot prompt
```

The `upstream` remote tracks opencode. Merge upstream changes with
`git fetch upstream && git merge upstream/dev`. Expect conflicts in renamed files.

License: MIT (see LICENSE), inherited from opencode.
