import type { EventApi } from "@openbnk/client/promise/api"

export interface EventDomain extends Pick<EventApi, "subscribe"> {}
