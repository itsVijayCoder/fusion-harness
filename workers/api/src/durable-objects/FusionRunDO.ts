import type { RunEvent, RunnerEvent } from "@fusion-harness/shared";
import type { Env } from "../env";

const eventCountKey = "event_count";

export class FusionRunDO {
  private readonly sockets = new Set<WebSocket>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/events")) {
      if (request.headers.get("upgrade") === "websocket") {
        return this.handleWebSocket();
      }

      return Response.json({ data: await this.readEvents(), environment: this.env.ENVIRONMENT });
    }

    if (url.pathname.endsWith("/start")) {
      const payload = await request.json().catch(() => ({}));
      await this.state.storage.put("start_payload", payload);
      const event = await this.appendEvent({
        type: "run.created",
        runId: readString(payload, "runId"),
        timestamp: new Date().toISOString(),
        data: {
          promptObjectKey: readString(payload, "promptObjectKey"),
        },
      });
      return Response.json({ status: "started", event }, { status: 202 });
    }

    if (url.pathname.endsWith("/runner-event")) {
      const event = (await request.json().catch(() => null)) as RunnerEvent | null;
      if (!event?.type || !event.runId) {
        return Response.json({ error: "Invalid runner event" }, { status: 400 });
      }

      const sequencedEvent = await this.appendEvent({
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
        data: event.data ?? {},
      });
      return Response.json({ status: "accepted", event: sequencedEvent }, { status: 202 });
    }

    return Response.json({ error: "Not found", environment: this.env.ENVIRONMENT }, { status: 404 });
  }

  private async handleWebSocket() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();
    this.sockets.add(server);
    server.addEventListener("close", () => this.sockets.delete(server));
    server.addEventListener("error", () => this.sockets.delete(server));
    server.send(JSON.stringify({ type: "snapshot", data: await this.readEvents() }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async appendEvent(event: RunnerEvent): Promise<RunEvent> {
    const nextIndex = ((await this.state.storage.get<number>(eventCountKey)) ?? 0) + 1;
    const sequencedEvent = { ...event, seq: nextIndex };
    await this.state.storage.put(`event:${String(nextIndex).padStart(8, "0")}`, sequencedEvent);
    await this.state.storage.put(eventCountKey, nextIndex);
    this.broadcast(sequencedEvent);
    return sequencedEvent;
  }

  private async readEvents() {
    const entries = await this.state.storage.list<RunEvent>({ prefix: "event:" });
    return [...entries.values()];
  }

  private broadcast(event: RunEvent) {
    const message = JSON.stringify(event);

    for (const socket of this.sockets) {
      try {
        socket.send(message);
      } catch {
        this.sockets.delete(socket);
      }
    }
  }
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) return "";
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : "";
}
