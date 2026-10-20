import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { LearningStore } from "../src/learning-store.js"

const skill = (name: string, body: string) => `---\nname: ${name}\ndescription: test skill\n---\n\n${body}\n`

describe("learning store", () => {
  let config = ""
  beforeEach(() => {
    config = fs.mkdtempSync(path.join(os.tmpdir(), "openbnk-learning-"))
  })
  afterEach(() => fs.rmSync(config, { recursive: true, force: true }))

  test("memory add, replace, remove and undo", () => {
    const added = LearningStore.applyMemory(config, { action: "add", target: "user", content: "Prefers pnpm" }, "test")
    expect(LearningStore.entries(config, "user")).toEqual(["Prefers pnpm"])
    expect(LearningStore.applyMemory(config, { action: "add", target: "user", content: "Prefers pnpm" }, "test")).toBe(
      undefined,
    )
    LearningStore.applyMemory(
      config,
      { action: "replace", target: "user", match: "pnpm", content: "Prefers bun" },
      "test",
    )
    expect(LearningStore.entries(config, "user")).toEqual(["Prefers bun"])
    expect(() => LearningStore.undo(config, added!.id)).toThrow("File changed")
    const removed = LearningStore.applyMemory(config, { action: "remove", target: "user", match: "bun" }, "test")
    expect(LearningStore.entries(config, "user")).toEqual([])
    LearningStore.undo(config, removed!.id)
    expect(LearningStore.entries(config, "user")).toEqual(["Prefers bun"])
  })

  test("memory enforces the size limit", () => {
    expect(() =>
      LearningStore.applyMemory(config, { action: "add", target: "user", content: "x".repeat(2000) }, "test"),
    ).toThrow("Consolidate")
  })

  test("learned skills apply directly and can be undone", () => {
    const outcome = LearningStore.writeSkill(
      config,
      { name: "My Skill", content: skill("my-skill", "do it"), reason: "r" },
      "t",
    )
    expect(outcome?.type).toBe("applied")
    const file = LearningStore.learnedSkillFile(config, "my-skill")
    expect(fs.existsSync(file)).toBe(true)
    if (outcome?.type === "applied") LearningStore.undo(config, outcome.change.id)
    expect(fs.existsSync(file)).toBe(false)
  })

  test("user-owned skills become proposals until accepted", () => {
    const file = path.join(config, "skills", "mine", "SKILL.md")
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, skill("mine", "v1"))
    const outcome = LearningStore.writeSkill(
      config,
      { name: "mine", file, content: skill("mine", "v2"), reason: "r" },
      "t",
    )
    expect(outcome?.type).toBe("proposal")
    expect(fs.readFileSync(file, "utf8")).toContain("v1")
    if (outcome?.type === "proposal") LearningStore.resolveProposal(config, outcome.proposal.id, true)
    expect(fs.readFileSync(file, "utf8")).toContain("v2")
  })

  test("rejects skills without frontmatter", () => {
    expect(() =>
      LearningStore.writeSkill(config, { name: "bad", content: "no frontmatter", reason: "r" }, "t"),
    ).toThrow("frontmatter")
  })
})
