/**
 * WebSocket message protocol between client and server.
 * Defined here so both sides always agree on wire format; grows as
 * multiplayer features (Phase 3) are implemented.
 */
export const PROTOCOL_VERSION = 1;

export interface HelloMessage {
  type: "hello";
  protocolVersion: number;
}
