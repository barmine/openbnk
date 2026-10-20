export * as LearningSearch from "./search.js"

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import { makeLocationNode } from "@openbnk/util/effect/app-node"
import { Database } from "../database/database.js"
import { SessionMessageTable, SessionTable } from "../session/sql.js"

export type Hit = {
  readonly sessionID: string
  readonly title: string | null
  readonly directory: string
  readonly time: number
  readonly role: string
  readonly snippet: string
}

export interface Interface {
  /** Case-insensitive text search over user and assistant messages of top-level sessions. */
  readonly search: (input: { readonly query: string; readonly limit?: number }) => Effect.Effect<readonly Hit[]>
}

export class Service extends Context.Service<Service, Interface>()("@openbnk/LearningSearch") {}

const snippet = (text: string, query: string) => {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  const start = Math.max(0, index - 200)
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 500).replace(/\s+/g, " ")}${text.length > start + 500 ? "…" : ""}`
}

const textOf = (data: unknown) => {
  const value = data as { text?: unknown; content?: unknown }
  if (typeof value.text === "string") return value.text
  if (!Array.isArray(value.content)) return ""
  return value.content
    .flatMap((part: { type?: unknown; text?: unknown }) =>
      part?.type === "text" && typeof part.text === "string" ? [part.text] : [],
    )
    .join("\n")
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const search = Effect.fn("LearningSearch.search")(function* (input: { query: string; limit?: number }) {
      const query = input.query.trim()
      if (!query) return []
      const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`)
      const rows = yield* db
        .select({
          sessionID: SessionMessageTable.session_id,
          role: SessionMessageTable.type,
          time: SessionMessageTable.time_created,
          data: SessionMessageTable.data,
          title: SessionTable.title,
          directory: SessionTable.directory,
        })
        .from(SessionMessageTable)
        .innerJoin(SessionTable, eq(SessionTable.id, SessionMessageTable.session_id))
        .where(
          and(
            inArray(SessionMessageTable.type, ["user", "assistant"]),
            isNull(SessionTable.parent_id),
            sql`${SessionMessageTable.data} like ${`%${escaped}%`} escape '\\'`,
          ),
        )
        .orderBy(desc(SessionMessageTable.time_created))
        .limit(200)
        .all()
        .pipe(Effect.orDie)
      const seen = new Map<string, number>()
      return rows
        .flatMap((row) => {
          const text = textOf(row.data)
          if (!text.toLowerCase().includes(query.toLowerCase())) return []
          const count = seen.get(row.sessionID) ?? 0
          if (count >= 2) return []
          seen.set(row.sessionID, count + 1)
          return [
            {
              sessionID: row.sessionID,
              title: row.title,
              directory: String(row.directory),
              time: Number(row.time),
              role: row.role,
              snippet: snippet(text, query),
            },
          ]
        })
        .slice(0, input.limit ?? 10)
    })
    return Service.of({ search })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Database.node] })
