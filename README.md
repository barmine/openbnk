# openbnk

A private, self-hosted fork of [opencode](https://github.com/anomalyco/opencode). It keeps the full
opencode agent harness (TUI, CLI, tools, MCP, plugins, skills) and makes three changes:

- **Local inference only.** The only built-in model provider is your own OpenAI-compatible server
  (see [Model server](#model-server)). Every model it serves (`GET /v1/models`) shows up automatically. Hosted
  providers are not registered.
- **No phone-home.** Nothing contacts opencode or Anomaly infrastructure: no models.dev catalog fetch,
  no update checks, no remote-access tunnel, no hosted MCP OAuth client document, and no Sentry. The
  agent can still use the internet on your behalf (web fetch, web search, MCP servers, plugin and skill
  installs).
- **Self-learning.** openbnk gets better the more you use it. See below.

## Install

You need Linux or macOS with `git`, `curl` and `unzip` installed.

1. Clone the repository:

   ```sh
   git clone https://github.com/christ-pher/openbnk.git
   cd openbnk
   ```

2. Run the installer:

   ```sh
   ./install
   ```

   It installs Bun if it's missing, builds openbnk from this checkout (this takes a minute or two),
   and installs the binary to `~/.local/bin/openbnk`.

3. When asked, enter your model server's URL, for example `http://my-server:8080/v1`. It is saved to
   `~/.config/openbnk/openbnk.json`. To skip the question, set `OPENBNK_BASE_URL` before running
   the installer. You are only asked on the first install.

4. Open a new terminal, go to a project directory, and run `openbnk`.

## Update

From your openbnk checkout, get the latest source and run the installer again:

```sh
cd openbnk
./update.sh
```

`update.sh` runs `git pull` and then `./install`.

The installer rebuilds the binary and replaces the old one. It never overwrites your existing config.

## Model server

openbnk talks to any OpenAI-compatible server. In order of precedence, the URL comes from:

1. `provider.bnk.options.baseURL` in a config file (`~/.config/openbnk/openbnk.json`, or a project's
   `openbnk.json`):

   ```json
   { "provider": { "bnk": { "options": { "baseURL": "http://my-server:8080/v1" } } } }
   ```

2. the `OPENBNK_BASE_URL` environment variable, with or without the trailing `/v1`
   (`OPENBNK_BASE_URL=http://my-server:8080 openbnk`).

There is no built-in default. With neither set, no models are listed.

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
