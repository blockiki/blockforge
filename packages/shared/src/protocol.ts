import type { BlockType } from "./blocks.js";
import type { MobInfo } from "./mob.js";

/**
 * WebSocket message protocol between client and server. Defined here so
 * both sides always agree on wire format. The server is the single
 * source of truth for world state and player positions (architecture
 * principle #1) — every message here exists either to tell the server
 * what a client wants to do, or to tell clients what actually happened.
 */
export const PROTOCOL_VERSION = 3;

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

export interface ChatMessage {
  type: "chat";
  text: string;
}

export type ClientMessage =
  | JoinMessage
  | PlayerStateMessage
  | BlockEditMessage
  | RequestChunkEditsMessage
  | ChatMessage;

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

export interface ChatBroadcastMessage {
  type: "chat";
  playerId: string;
  nickname: string;
  text: string;
}

export interface MobSpawnedMessage {
  type: "mobSpawned";
  mob: MobInfo;
}

/** Sent periodically by the server's tick loop, same interpolation idea
 * as PlayerStateBroadcastMessage but for mobs. */
export interface MobStateMessage {
  type: "mobState";
  id: string;
  position: Vec3;
  yaw: number;
}

export interface MobRemovedMessage {
  type: "mobRemoved";
  id: string;
}

/** Sent only to the owning player — health/hunger are private state, no
 * one else needs them. */
export interface PlayerVitalsMessage {
  type: "playerVitals";
  health: number;
  hunger: number;
}

/** Sent to the owning player when health hits 0, so their client can
 * snap the camera back to the respawn point. */
export interface PlayerRespawnMessage {
  type: "playerRespawn";
  position: Vec3;
}

export type ServerMessage =
  | WelcomeMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerStateBroadcastMessage
  | BlockUpdateMessage
  | BlockEditRejectedMessage
  | ChunkEditsMessage
  | ChatBroadcastMessage
  | MobSpawnedMessage
  | MobStateMessage
  | MobRemovedMessage
  | PlayerVitalsMessage
  | PlayerRespawnMessage;
