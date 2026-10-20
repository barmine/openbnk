import os from "node:os"
import path from "node:path"

// Each isolated home gets its own XDG_CACHE_HOME, where Bun would otherwise keep its transpiler cache,
// so every spawned CLI process would transpile the source from scratch. Share one cache instead.
export const transpilerCache = path.join(os.tmpdir(), "openbnk-test-transpiler-cache")

export function isolatedEnv(root: string, overrides: Record<string, string | undefined> = {}) {
  return {
    ...process.env,
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: transpilerCache,
    HOME: root,
    OPENBNK_CLI_CONFIG_CONTENT: undefined,
    OPENBNK_CONFIG_CONTENT: "{}",
    OPENBNK_CONFIG_DIR: path.join(root, "config"),
    OPENBNK_DB: path.join(root, "openbnk.db"),
    OPENBNK_DISABLE_FILEWATCHER: "true",
    OPENBNK_DISABLE_MODELS_FETCH: "true",
    OPENBNK_TEST_HOME: root,
    XDG_CACHE_HOME: path.join(root, "cache"),
    XDG_CONFIG_HOME: path.join(root, "xdg-config"),
    XDG_DATA_HOME: path.join(root, "data"),
    XDG_STATE_HOME: path.join(root, "state"),
    ...overrides,
  }
}
