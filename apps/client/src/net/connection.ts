import type { ClientMessage, ServerMessage } from "@blockforge/shared";

type MessageHandler = (message: ServerMessage) => void;

/** Thin WebSocket wrapper: joins with a nickname on connect, then just
 * forwards typed messages both ways — no protocol logic lives here. */
export class Connection {
  private socket: WebSocket | null = null;
  private readonly handlers: MessageHandler[] = [];

  connect(url: string, nickname: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener(
        "open",
        () => {
          this.send({ type: "join", nickname });
          resolve();
        },
        { once: true },
      );
      socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
      socket.addEventListener("close", () => {
        console.warn("[net] disconnected from server");
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data as string) as ServerMessage;
          for (const handler of this.handlers) handler(message);
        } catch {
          // ignore malformed frames
        }
      });
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
