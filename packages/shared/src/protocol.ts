import type { BlockType } from "./blocks.js";

/**
 * WebSocket message protocol between client and server. Defined here so
 * both sides always agree on wire format. The server is the single
 * source of truth for world state and player positions (architecture
 * principle #1) — every message here exists either to tell the server
 * what a client wants to do, or to tell clients what actually happened.
 */
export const PROTOCOL_VERSION = 2;

export type Vec3 = readonly [number, number, number];

export interface PlayerInfo {
  id: string;
  nickname: string;
  position: Vec3;
  yaw: number;
  pitch: number;
}

// ---- Client -> Server ----

export interface JoinMessage {
  type: "join";
  nickname: string;
}

/** Sent at a fixed client tick rate; the server just relays it to others. */
export interface PlayerStateMessage {
  type: "playerState";
  position: Vec3;
  yaw: number;
  pitch: number;
}

/** A block change the client wants to make — applied optimistically on
 * the client immediately (prediction), then confirmed or reverted once
 * the server's reply arrives (reconciliation). */
export interface BlockEditMessage {
  type: "blockEdit";
  x: number;
  y: number;
  z: number;
  block: BlockType;
}

/** Chunk terrain is regenerated locally from the shared seed; only the
 * player-made diff needs to come from the server. */
export interface RequestChunkEditsMessage {
  type: "requestChunkEdits";
  cx: number;
  cz: number;
}

export type ClientMessage = JoinMessage | PlayerStateMessage | BlockEditMessage | RequestChunkEditsMessage;

// ---- Server -> Client ----

export interface WelcomeMessage {
  type: "welcome";
  protocolVersion: number;
  playerId: string;
  seed: number;
  players: PlayerInfo[];
}

export interface PlayerJoinedMessage {
  type: "playerJoined";
  player: PlayerInfo;
}

export interface PlayerLeftMessage {
  type: "playerLeft";
  playerId: string;
}

export interface PlayerStateBroadcastMessage {
  type: "playerState";
  playerId: string;
  position: Vec3;
  yaw: number;
  pitch: number;
}

/** Broadcast to everyone once the server has validated and applied an edit. */
export interface BlockUpdateMessage {
  type: "blockUpdate";
  x: number;
  y: number;
  z: number;
  block: BlockType;
}

/** Sent back to the requester only, when their blockEdit was rejected
 * (out of reach, out of bounds, ...) — carries the server's true current
 * block so the client can revert its optimistic change exactly. */
export interface BlockEditRejectedMessage {
  type: "blockEditRejected";
  x: number;
  y: number;
  z: number;
  block: BlockType;
}

export interface ChunkEditsMessage {
  type: "chunkEdits";
  cx: number;
  cz: number;
  edits: Record<string, number>;
}

export type ServerMessage =
  | WelcomeMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerStateBroadcastMessage
  | BlockUpdateMessage
  | BlockEditRejectedMessage
  | ChunkEditsMessage;
