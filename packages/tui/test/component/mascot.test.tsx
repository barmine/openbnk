/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { Mascot } from "../../src/component/mascot"
import { ThemeProvider } from "../../src/context/theme"
import { MASCOT_WIDTH, mascot } from "../../src/mascot/art"
import { stringWidth } from "../../src/util/string-width"
import { emptyThemeSource } from "../fixture/fixture"

test("mascot lines share one display width of single-width block characters", () => {
  for (const line of mascot) {
    expect(stringWidth(line)).toBe(MASCOT_WIDTH)
    expect(line).toMatch(/^[█▀▄ ]+$/)
  }
})

test("mascot renders every line unchanged", async () => {
  const app = await testRender(
    () => (
      <ThemeProvider mode="dark" source={emptyThemeSource}>
        <Mascot />
      </ThemeProvider>
    ),
    { width: 40, height: 8 },
  )

  try {
    app.renderer.start()
    await app.waitForFrame((frame) => frame.includes(mascot[0]!.trim()))
    const frame = app.captureCharFrame()
    for (const line of mascot) expect(frame).toContain(line.trimEnd())
  } finally {
    app.renderer.destroy()
  }
})
