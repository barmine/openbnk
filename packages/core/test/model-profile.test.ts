import { describe, expect, test } from "bun:test"
import { ModelProfilePlugin } from "../src/plugin/model-profile.js"

describe("model profile", () => {
  test("detects families", () => {
    expect(ModelProfilePlugin.family(["Qwen3.8-Flash-Next"])).toBe("qwen")
    expect(ModelProfilePlugin.family(["deepseek-r1-distill"])).toBe("deepseek")
    expect(ModelProfilePlugin.family(["llama-3"])).toBe(undefined)
  })

  test("qwen defaults follow the published coding settings", () => {
    expect(ModelProfilePlugin.defaults("qwen", "qwen3.6")).toEqual({
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
      chat_template_kwargs: { preserve_thinking: true },
    })
    expect(ModelProfilePlugin.defaults("deepseek", "deepseek-r1")).toEqual({ temperature: 0.6, top_p: 0.95 })
    expect(ModelProfilePlugin.defaults("deepseek", "deepseek-v3.2")).toEqual({ temperature: 1.0, top_p: 0.95 })
  })

  test("strips the code mode block and keeps what follows", () => {
    const text = "intro\n\n# Code Mode\n\nUse execute\n## Available tools\n- x\n\nSkills provide specialized help\n<available_skills/>"
    expect(ModelProfilePlugin.stripCodeMode(text)).toBe("intro\n\nSkills provide specialized help\n<available_skills/>")
    expect(ModelProfilePlugin.stripCodeMode("intro\n# Code Mode\nno end marker")).toBe(undefined)
  })
})
