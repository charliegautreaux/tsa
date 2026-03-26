export class AirportHub {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, { airports: Set<string> }> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (url.pathname === "/broadcast") {
      const data = await request.json() as { airport: string; payload: unknown };
      this.broadcast(data.airport, data.payload);
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }

  private handleWebSocket(_request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);
    this.sessions.set(server, { airports: new Set() });

    server.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; airports?: string[] };

        if (msg.type === "subscribe" && Array.isArray(msg.airports)) {
          const session = this.sessions.get(server);
          if (session) {
            for (const code of msg.airports) {
              session.airports.add(code.toUpperCase());
            }
            server.send(JSON.stringify({
              type: "subscribed",
              airports: Array.from(session.airports),
            }));
          }
        }

        if (msg.type === "unsubscribe" && Array.isArray(msg.airports)) {
          const session = this.sessions.get(server);
          if (session) {
            for (const code of msg.airports) {
              session.airports.delete(code.toUpperCase());
            }
          }
        }
      } catch {
        server.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    // Start heartbeat alarm
    this.state.storage.setAlarm(Date.now() + 30_000);

    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(airportCode: string, payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const [ws, session] of this.sessions) {
      if (session.airports.has(airportCode.toUpperCase())) {
        try {
          ws.send(message);
        } catch {
          this.sessions.delete(ws);
        }
      }
    }
  }

  async alarm(): Promise<void> {
    // Heartbeat every 30s
    const heartbeat = JSON.stringify({
      type: "heartbeat",
      ts: new Date().toISOString(),
    });

    for (const [ws] of this.sessions) {
      try {
        ws.send(heartbeat);
      } catch {
        this.sessions.delete(ws);
      }
    }

    // Schedule next heartbeat if there are active sessions
    if (this.sessions.size > 0) {
      this.state.storage.setAlarm(Date.now() + 30_000);
    }
  }
}
