import { expect, test } from "bun:test"
import { selectTheme, selectThemeMode, supportsThemeMode, themeModes } from "@openbnk/theme/tui"
import { getOpenBnkTheme } from "../../../src/theme"

test("selects complete light and dark themes independently", () => {
  const light = selectTheme(getOpenBnkTheme(), "light")
  const dark = selectTheme(getOpenBnkTheme(), "dark")
  expect(selectTheme(getOpenBnkTheme())).toEqual(light)
  expect(light.hue).toEqual(getOpenBnkTheme().light.hue)
  expect(dark.text).toEqual(getOpenBnkTheme().base.text)
  expect(dark.hue).toEqual(getOpenBnkTheme().dark.hue)
  expect(selectThemeMode(getOpenBnkTheme(), "dark")).toEqual({ theme: dark, mode: "dark" })
})

test("selects the available mode when the requested mode is missing", () => {
  const lightOnly = { base: getOpenBnkTheme().base, light: getOpenBnkTheme().light } as const
  const darkOnly = { base: getOpenBnkTheme().base, dark: getOpenBnkTheme().dark } as const

  expect(themeModes(lightOnly)).toEqual(["light"])
  expect(themeModes(darkOnly)).toEqual(["dark"])
  expect(supportsThemeMode(lightOnly, "light")).toBeTrue()
  expect(supportsThemeMode(lightOnly, "dark")).toBeFalse()
  expect(selectThemeMode(lightOnly, "dark")).toEqual({ theme: selectTheme(getOpenBnkTheme(), "light"), mode: "light" })
  expect(selectThemeMode(darkOnly, "light")).toEqual({ theme: selectTheme(getOpenBnkTheme(), "dark"), mode: "dark" })
})
