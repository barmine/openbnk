import { expect, test } from "bun:test"
import { Env } from "../src/env"

test("session environment omits server credentials", () => {
  const previousPassword = process.env.OPENBNK_PASSWORD
  const previousLegacyPassword = process.env.OPENBNK_SERVER_PASSWORD
  const previousValue = process.env.OPENBNK_SESSION_ENV_TEST
  process.env.OPENBNK_PASSWORD = "password"
  process.env.OPENBNK_SERVER_PASSWORD = "legacy"
  process.env.OPENBNK_SESSION_ENV_TEST = "included"

  const environment = Env.session()

  if (previousPassword === undefined) delete process.env.OPENBNK_PASSWORD
  else process.env.OPENBNK_PASSWORD = previousPassword
  if (previousLegacyPassword === undefined) delete process.env.OPENBNK_SERVER_PASSWORD
  else process.env.OPENBNK_SERVER_PASSWORD = previousLegacyPassword
  if (previousValue === undefined) delete process.env.OPENBNK_SESSION_ENV_TEST
  else process.env.OPENBNK_SESSION_ENV_TEST = previousValue

  expect(environment.OPENBNK_PASSWORD).toBeUndefined()
  expect(environment.OPENBNK_SERVER_PASSWORD).toBeUndefined()
  expect(environment.OPENBNK_SESSION_ENV_TEST).toBe("included")
})
