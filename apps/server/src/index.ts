import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { PROTOCOL_VERSION, type BlockType, type ClientMessage } from "@blockforge/shared";
import { SessionRegistry, toPlayerInfo, type PlayerSession } from "./state/playerSession.js";
import { ServerWorld } from "./state/serverWorld.js";

const PORT = Number(process.env.PORT ?? 8080);
// Must match the client's seed — packages/shared's TerrainGenerator makes
// both sides deterministic from it, so only edits need to cross the wire.
const WORLD_SEED = 1337;
// A bit more generous than the client's 6-block raycast reach, to absorb
// network latency between an input and the playerState update that
// carries the position used for this check.
const MAX_EDIT_REACH = 8;

const sessions = new SessionRegistry();
const world = new ServerWorld(WORLD_SEED);

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
  let session: PlayerSession | null = null;

  socket.on("message", (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed input
    }

    if (!session) {
      if (message.type !== "join") return; // must join (nickname) before anything else
      const nickname = message.nickname.trim().slice(0, 24) || "Player";
      session = { id: randomUUID(), nickname, socket, position: [0, 0, 0], yaw: 0, pitch: 0 };
      const joined = session;
      sessions.add(joined);

      sessions.send(joined, {
        type: "welcome",
        protocolVersion: PROTOCOL_VERSION,
        playerId: joined.id,
        seed: WORLD_SEED,
        players: sessions.all().filter((s) => s.id !== joined.id).map(toPlayerInfo),
      });
      sessions.broadcast({ type: "playerJoined", player: toPlayerInfo(joined) }, joined.id);
      return;
    }

    switch (message.type) {
      case "playerState": {
        session.position = message.position;
        session.yaw = message.yaw;
        session.pitch = message.pitch;
        sessions.broadcast(
          { type: "playerState", playerId: session.id, position: message.position, yaw: message.yaw, pitch: message.pitch },
          session.id,
        );
        break;
      }
      case "blockEdit": {
        void handleBlockEdit(session, message.x, message.y, message.z, message.block);
        break;
      }
      case "requestChunkEdits": {
        void handleRequestChunkEdits(session, message.cx, message.cz);
        break;
      }
    }
  });

  socket.on("close", () => {
    if (!session) return;
    sessions.remove(session.id);
    sessions.broadcast({ type: "playerLeft", playerId: session.id });
  });
});

async function handleBlockEdit(
  session: PlayerSession,
  x: number,
  y: number,
  z: number,
  block: BlockType,
): Promise<void> {
  const dx = x + 0.5 - session.position[0];
  const dy = y + 0.5 - session.position[1];
  const dz = z + 0.5 - session.position[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance > MAX_EDIT_REACH) {
    const actual = await world.getBlock(x, y, z);
    sessions.send(session, { type: "blockEditRejected", x, y, z, block: actual });
    return;
  }

  await world.setBlock(x, y, z, block);
  // Broadcast to everyone including the sender: applying the same block
  // twice is a no-op, and this keeps every client's state provably in
  // sync with the server's rather than trusting the sender's own apply.
  sessions.broadcast({ type: "blockUpdate", x, y, z, block });
}

async function handleRequestChunkEdits(session: PlayerSession, cx: number, cz: number): Promise<void> {
  const edits = await world.getChunkEdits(cx, cz);
  sessions.send(session, { type: "chunkEdits", cx, cz, edits });
}

console.log(`[server] blockforge server listening on ws://localhost:${PORT}`);
