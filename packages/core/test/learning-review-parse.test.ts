import { describe, expect, test } from "bun:test"
import { LearningReview } from "../src/learning/review.js"

describe("learning review parse", () => {
  test("extracts operations from fenced JSON and drops invalid ones", () => {
    const ops = LearningReview.parse(
      'Here you go:\n```json\n{"memory":[{"action":"add","target":"user","content":"Likes tabs"},{"action":"add","target":"bogus","content":"x"}],"skills":[{"action":"create","name":"a","content":"---\\nname: a\\n---"},{"action":"create","name":"b"}]}\n```',
    )
    expect(ops?.memory).toEqual([{ action: "add", target: "user", content: "Likes tabs" }])
    expect(ops?.skills?.map((skill) => skill.name)).toEqual(["a"])
  })

  test("keeps project memory operations", () => {
    expect(LearningReview.parse('{"memory":[{"action":"add","target":"project","content":"x"}]}')?.memory).toEqual([
      { action: "add", target: "project", content: "x" },
    ])
  })

  test("returns undefined for non-JSON output", () => {
    expect(LearningReview.parse("Nothing to save.")).toBe(undefined)
  })
})
