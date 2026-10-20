import type { OpenBnkEvent } from "@openbnk/client"
import { useClient } from "./client"

type EventMetadata = {
  directory: string | undefined
}
type OpenBnkEventMap = { [Type in OpenBnkEvent["type"]]: Extract<OpenBnkEvent, { type: Type }> }

export function useEvent() {
  const client = useClient()

  function subscribe(handler: (event: OpenBnkEvent, metadata: EventMetadata) => void) {
    return client.event.listen(({ details }) => {
      if (details.type === "server.connected") return
      handler(details, { directory: details.location?.directory })
    })
  }

  function on<T extends OpenBnkEvent["type"]>(
    type: T,
    handler: (event: OpenBnkEventMap[T], metadata: EventMetadata) => void,
  ) {
    return client.event.on(type, (event) => {
      handler(event, { directory: event.location?.directory })
    })
  }

  return {
    subscribe,
    on,
  }
}
