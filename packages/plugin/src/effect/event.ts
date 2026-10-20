import type { EventApi } from "@openbnk/client/effect/api"

export interface EventDomain extends Pick<EventApi<unknown>, "subscribe"> {}
