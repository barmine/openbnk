export const available = true

export async function resolveBinary() {
  return process.env.OPENBNK_PTY_BIN || "openbnk-pty"
}
