import { WebSocketServer } from "ws";
import { PROTOCOL_VERSION, type HelloMessage } from "@blockforge/shared";

const PORT = Number(process.env.PORT ?? 8080);

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
  console.log("[server] client connected");

  const hello: HelloMessage = { type: "hello", protocolVersion: PROTOCOL_VERSION };
  socket.send(JSON.stringify(hello));

  socket.on("close", () => {
    console.log("[server] client disconnected");
  });
});

console.log(`[server] blockforge server listening on ws://localhost:${PORT}`);
